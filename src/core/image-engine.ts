import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Image processing contract used by {@link Thumbnail}. It mirrors the few GD primitives of the PHP implementation
 * (`getimagesizefromstring`, `imagecreatefromstring`, `imagecreatetruecolor`, `imagecopyresampled`, `imagepng`)
 * so a native library (for example `sharp`) can be plugged in without touching the thumbnail logic.
 */
export interface RasterImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row major. */
  readonly data: Uint8Array;
}

export interface ImageEngine {
  /** Dimensions of an encoded image, null when the format is not recognised (`getimagesizefromstring`). */
  getImageSize(blob: Buffer): { width: number; height: number } | null;
  /** Decode an image, null when it cannot be decoded (`imagecreatefromstring`). */
  decode(blob: Buffer): RasterImage | null;
  /** Opaque black canvas (`imagecreatetruecolor`). */
  createCanvas(width: number, height: number): RasterImage;
  /** `imagecopyresampled()` without alpha blending: the source rectangle is resampled onto the destination rectangle. */
  copyResampled(
    dst: RasterImage,
    src: RasterImage,
    dstX: number,
    dstY: number,
    srcX: number,
    srcY: number,
    dstW: number,
    dstH: number,
    srcW: number,
    srcH: number,
  ): void;
  /** `imagepng()`; `compression` is the zlib level, -1 for the default one. */
  encodePng(image: RasterImage, compression: number): Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Dimensions of PNG, GIF and JPEG blobs (the formats handled by `getimagesize`). */
function sniffSize(blob: Buffer): { width: number; height: number } | null {
  if (blob.length >= 24 && blob.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { width: blob.readUInt32BE(16), height: blob.readUInt32BE(20) };
  }

  if (blob.length >= 10 && (blob.subarray(0, 6).toString('ascii') === 'GIF87a' || blob.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    return { width: blob.readUInt16LE(6), height: blob.readUInt16LE(8) };
  }

  if (blob.length > 4 && blob[0] === 0xff && blob[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < blob.length) {
      if (blob[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = blob[offset + 1] as number;
      if (marker === 0xff) {
        offset++;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: blob.readUInt16BE(offset + 5), width: blob.readUInt16BE(offset + 7) };
      }
      offset += 2 + blob.readUInt16BE(offset + 2);
    }
  }

  return null;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decode a non-interlaced 8 bit PNG (grey, grey+alpha, RGB, RGBA, palette). */
function decodePng(blob: Buffer): RasterImage | null {
  if (blob.length < 33 || !blob.subarray(0, 8).equals(PNG_SIGNATURE)) return null;

  let width = 0;
  let height = 0;
  let colorType = -1;
  let palette: Uint8Array = Buffer.alloc(0);
  let transparency: Uint8Array = Buffer.alloc(0);
  const idat: Buffer[] = [];

  let offset = 8;
  while (offset + 8 <= blob.length) {
    const length = blob.readUInt32BE(offset);
    const type = blob.subarray(offset + 4, offset + 8).toString('ascii');
    const data = blob.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) return null;
      colorType = data[9] as number;
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }

  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (channels === undefined || width === 0 || height === 0 || idat.length === 0) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;

  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] as number;
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x] as number;
      const left = x >= channels ? (pixels[y * stride + x - channels] as number) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + x] as number) : 0;
      const upLeft = y > 0 && x >= channels ? (pixels[(y - 1) * stride + x - channels] as number) : 0;
      let out: number;
      switch (filter) {
        case 0:
          out = value;
          break;
        case 1:
          out = value + left;
          break;
        case 2:
          out = value + up;
          break;
        case 3:
          out = value + Math.floor((left + up) / 2);
          break;
        case 4:
          out = value + paeth(left, up, upLeft);
          break;
        default:
          return null;
      }
      pixels[y * stride + x] = out & 0xff;
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const o = i * 4;
    if (colorType === 6) {
      data.set([pixels[p] as number, pixels[p + 1] as number, pixels[p + 2] as number, pixels[p + 3] as number], o);
    } else if (colorType === 2) {
      data.set([pixels[p] as number, pixels[p + 1] as number, pixels[p + 2] as number, 255], o);
    } else if (colorType === 0) {
      const g = pixels[p] as number;
      data.set([g, g, g, 255], o);
    } else if (colorType === 4) {
      const g = pixels[p] as number;
      data.set([g, g, g, pixels[p + 1] as number], o);
    } else {
      const index = pixels[p] as number;
      data.set([palette[index * 3] ?? 0, palette[index * 3 + 1] ?? 0, palette[index * 3 + 2] ?? 0, transparency[index] ?? 255], o);
    }
  }

  return { width, height, data };
}

/**
 * Dependency free engine: sizes of PNG/GIF/JPEG, PNG decoding and encoding (zlib), bilinear resampling.
 * GIF and JPEG decoding needs a native library: plug a custom {@link ImageEngine} (for example based on
 * `sharp`) with `setDefaultImageEngine()`. Pixel values differ slightly from GD's resampling filter.
 */
export class PngImageEngine implements ImageEngine {
  getImageSize(blob: Buffer): { width: number; height: number } | null {
    return sniffSize(blob);
  }

  decode(blob: Buffer): RasterImage | null {
    return decodePng(blob);
  }

  createCanvas(width: number, height: number): RasterImage {
    const data = new Uint8Array(width * height * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    return { width, height, data };
  }

  copyResampled(
    dst: RasterImage,
    src: RasterImage,
    dstX: number,
    dstY: number,
    srcX: number,
    srcY: number,
    dstW: number,
    dstH: number,
    srcW: number,
    srcH: number,
  ): void {
    const scaleX = srcW / dstW;
    const scaleY = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      const ty = dstY + y;
      if (ty < 0 || ty >= dst.height) continue;
      const sy = Math.min(Math.max(srcY + (y + 0.5) * scaleY - 0.5, 0), src.height - 1);
      const y0 = Math.floor(sy);
      const y1 = Math.min(y0 + 1, src.height - 1);
      const fy = sy - y0;

      for (let x = 0; x < dstW; x++) {
        const tx = dstX + x;
        if (tx < 0 || tx >= dst.width) continue;
        const sx = Math.min(Math.max(srcX + (x + 0.5) * scaleX - 0.5, 0), src.width - 1);
        const x0 = Math.floor(sx);
        const x1 = Math.min(x0 + 1, src.width - 1);
        const fx = sx - x0;

        for (let c = 0; c < 4; c++) {
          const top = (src.data[(y0 * src.width + x0) * 4 + c] as number) * (1 - fx) + (src.data[(y0 * src.width + x1) * 4 + c] as number) * fx;
          const bottom = (src.data[(y1 * src.width + x0) * 4 + c] as number) * (1 - fx) + (src.data[(y1 * src.width + x1) * 4 + c] as number) * fx;
          dst.data[(ty * dst.width + tx) * 4 + c] = Math.round(top * (1 - fy) + bottom * fy);
        }
      }
    }
  }

  encodePng(image: RasterImage, compression: number): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(image.width, 0);
    header.writeUInt32BE(image.height, 4);
    header[8] = 8; // bit depth
    header[9] = 6; // RGBA
    const stride = image.width * 4;
    const raw = Buffer.alloc((stride + 1) * image.height);
    for (let y = 0; y < image.height; y++) {
      raw[y * (stride + 1)] = 0;
      raw.set(image.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    }

    return Buffer.concat([
      PNG_SIGNATURE,
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw, { level: compression })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}
