import { createRequire } from 'node:module';
import { MessageChannel, receiveMessageOnPort, Worker, type MessagePort } from 'node:worker_threads';
import { sniffSize, type ImageEngine, type RasterImage } from './image-engine.js';

/** Default JPEG quality, the one used by GD's `imagejpeg()` when no quality is given. */
export const DEFAULT_JPEG_QUALITY = 75;

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const sharp = require(workerData.sharpPath);
const port = workerData.port;
const ops = {
  async decode({ blob }) {
    const { data, info } = await sharp(blob).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data) };
  },
  async resize({ data, width, height, srcX, srcY, srcW, srcH, dstW, dstH }) {
    const out = await sharp(data, { raw: { width, height, channels: 4 } })
      .extract({ left: srcX, top: srcY, width: srcW, height: srcH })
      .resize(dstW, dstH, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer();
    return new Uint8Array(out);
  },
  async encode({ data, width, height, format, quality, compression }) {
    let image = sharp(data, { raw: { width, height, channels: 4 } });
    if (format === 'jpeg') image = image.removeAlpha().jpeg({ quality });
    else if (format === 'gif') image = image.gif();
    else image = image.png({ compressionLevel: compression });
    return new Uint8Array(await image.toBuffer());
  },
};
parentPort.on('message', async ({ op, args, signal }) => {
  try {
    port.postMessage({ ok: true, result: await ops[op](args) });
  } catch (error) {
    port.postMessage({ ok: false, error: String(error && error.message ? error.message : error) });
  }
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
});
`;

/** Runs sharp (promise based) in a worker thread and blocks on the answer, to fit the synchronous ImageEngine contract. */
class SyncSharp {
  private readonly worker: Worker;
  private readonly port: MessagePort;

  constructor(sharpPath: string) {
    const { port1, port2 } = new MessageChannel();
    this.port = port1;
    this.worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { sharpPath, port: port2 }, transferList: [port2] });
    this.worker.unref();
    port1.unref();
  }

  call<T>(op: string, args: Record<string, unknown>): T {
    const signal = new Int32Array(new SharedArrayBuffer(4));
    this.worker.postMessage({ op, args, signal });
    Atomics.wait(signal, 0, 0);
    const message = receiveMessageOnPort(this.port)?.message as { ok: boolean; result?: T; error?: string } | undefined;
    if (message === undefined || !message.ok) throw new Error(message?.error ?? 'sharp worker failed');
    return message.result as T;
  }
}

function resolveSharp(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const path = require.resolve('sharp');
    require(path); // make sure the native binding loads
    return path;
  } catch {
    return null;
  }
}

/**
 * Engine based on `sharp`: decodes JPEG, GIF (first frame) and PNG, resamples with Lanczos and encodes JPEG, GIF and PNG.
 * Use {@link SharpImageEngine.create} to get an instance, or null when sharp is not loadable.
 */
export class SharpImageEngine implements ImageEngine {
  private constructor(private readonly sharp: SyncSharp) {}

  static create(): SharpImageEngine | null {
    const path = resolveSharp();
    return path === null ? null : new SharpImageEngine(new SyncSharp(path));
  }

  getImageSize(blob: Buffer): { width: number; height: number } | null {
    return sniffSize(blob);
  }

  decode(blob: Buffer): RasterImage | null {
    try {
      return this.sharp.call<RasterImage>('decode', { blob });
    } catch {
      return null;
    }
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
    if (dstW < 1 || dstH < 1 || srcW < 1 || srcH < 1) return;
    const resized = this.sharp.call<Uint8Array>('resize', {
      data: src.data,
      width: src.width,
      height: src.height,
      srcX,
      srcY,
      srcW,
      srcH,
      dstW,
      dstH,
    });

    for (let y = 0; y < dstH; y++) {
      const ty = dstY + y;
      if (ty < 0 || ty >= dst.height) continue;
      for (let x = 0; x < dstW; x++) {
        const tx = dstX + x;
        if (tx < 0 || tx >= dst.width) continue;
        const from = (y * dstW + x) * 4;
        dst.data.set(resized.subarray(from, from + 4), (ty * dst.width + tx) * 4);
      }
    }
  }

  encodePng(image: RasterImage, compression: number): Buffer {
    return this.encode(image, 'png', DEFAULT_JPEG_QUALITY, compression);
  }

  encodeJpeg(image: RasterImage, quality = DEFAULT_JPEG_QUALITY): Buffer {
    return this.encode(image, 'jpeg', quality, -1);
  }

  encodeGif(image: RasterImage): Buffer {
    return this.encode(image, 'gif', DEFAULT_JPEG_QUALITY, -1);
  }

  private encode(image: RasterImage, format: 'png' | 'jpeg' | 'gif', quality: number, compression: number): Buffer {
    // zlib level -1 means "default" (6); sharp wants 0-9.
    const level = compression < 0 ? 6 : Math.min(compression, 9);
    const out = this.sharp.call<Uint8Array>('encode', { data: image.data, width: image.width, height: image.height, format, quality, compression: level });
    return Buffer.from(out);
  }
}
