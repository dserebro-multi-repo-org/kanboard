import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PngImageEngine, Thumbnail, type ImageEngine, type RasterImage } from '../../../src/core/thumbnail.js';

const engine = new PngImageEngine();

/** Solid PNG of the given size and colour. */
function solid(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const image = engine.createCanvas(width, height);
  for (let i = 0; i < width * height; i++) image.data.set(rgba, i * 4);
  return engine.encodePng(image, -1);
}

function decoded(png: Buffer): RasterImage {
  const image = engine.decode(png);
  if (image === null) throw new Error('not a png');
  return image;
}

describe('Thumbnail', () => {
  it('reads the size of a PNG', () => {
    expect(engine.getImageSize(solid(30, 20, [0, 0, 0, 255]))).toEqual({ width: 30, height: 20 });
    expect(engine.getImageSize(Buffer.from('nope'))).toBeNull();
  });

  it('resizes with a fixed width keeping the ratio', () => {
    const output = Thumbnail.createFromString(solid(200, 100, [10, 20, 30, 255])).resize(50, 0).toBuffer();
    const image = decoded(output);
    expect([image.width, image.height]).toEqual([50, 25]);
    expect(Array.from(image.data.subarray(0, 4))).toEqual([10, 20, 30, 255]);
  });

  it('resizes with a fixed height keeping the ratio', () => {
    const image = decoded(Thumbnail.createFromString(solid(200, 100, [1, 2, 3, 255])).resize(0, 40).toBuffer());
    expect([image.width, image.height]).toEqual([80, 40]);
  });

  it('uses 100x100 when no dimension is given and crops to the exact box otherwise', () => {
    const square = decoded(Thumbnail.createFromString(solid(300, 200, [9, 9, 9, 255])).resize(0, 0).toBuffer());
    expect([square.width, square.height]).toEqual([100, 100]);
    const wide = decoded(Thumbnail.createFromString(solid(100, 400, [9, 9, 9, 255])).resize(250, 100).toBuffer());
    expect([wide.width, wide.height]).toEqual([250, 100]);
    const tall = decoded(Thumbnail.createFromString(solid(400, 100, [9, 9, 9, 255])).resize().toBuffer());
    expect([tall.width, tall.height]).toEqual([250, 100]);
    expect(Array.from(tall.data.subarray(0, 4))).toEqual([9, 9, 9, 255]);
  });

  it('keeps the alpha channel', () => {
    const image = decoded(Thumbnail.createFromString(solid(10, 10, [255, 0, 0, 128])).resize(5, 5).toBuffer());
    expect(image.data[3]).toBe(128);
  });

  it('writes to a file and to an output callback', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'kb-thumb-'));
    try {
      const file = path.join(dir, 'in.png');
      const out = path.join(dir, 'out.png');
      Thumbnail.createFromString(solid(20, 20, [5, 5, 5, 255])).resize(10, 10).toFile(file);
      Thumbnail.createFromFile(file).resize(4, 4).toFile(out);
      expect(readFileSync(out).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

      const chunks: Buffer[] = [];
      Thumbnail.createFromFile(out).resize(2, 2).toOutput((c) => chunks.push(c));
      expect(decoded(Buffer.concat(chunks)).width).toBe(2);

      const asString = Thumbnail.createFromFile(out).resize(2, 2).toString();
      expect(asString.startsWith('\x89PNG')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails clearly on unreadable images and before resize', () => {
    expect(() => Thumbnail.createFromString(Buffer.from('garbage')).resize()).toThrow('Unable to read the image');
    expect(() => Thumbnail.createFromString(solid(2, 2, [0, 0, 0, 255])).toBuffer()).toThrow('has not been resized');
    expect(() => Thumbnail.createFromString(solid(1, 100, [0, 0, 0, 255])).resize(10, 0).toBuffer()).not.toThrow();
  });

  it('delegates to a custom ImageEngine', () => {
    const calls: string[] = [];
    const custom: ImageEngine = {
      getImageSize: () => (calls.push('size'), { width: 400, height: 200 }),
      decode: () => (calls.push('decode'), { width: 400, height: 200, data: new Uint8Array(0) }),
      createCanvas: (w, h) => (calls.push(`canvas ${w}x${h}`), { width: w, height: h, data: new Uint8Array(0) }),
      copyResampled: (_d, _s, dx, dy, sx, sy, dw, dh, sw, sh) => void calls.push(`copy ${dx},${dy},${sx},${sy},${dw},${dh},${sw},${sh}`),
      encodePng: (_i, compression) => (calls.push(`png ${compression}`), Buffer.from('x')),
    };
    // 400x200 into 100x100: source ratio 2 > 1 so the width is cropped: dstWidth 200, dstX -50
    expect(Thumbnail.createFromString(Buffer.alloc(0), custom).resize(100, 100).toBuffer().toString()).toBe('x');
    expect(calls).toEqual(['size', 'decode', 'canvas 100x100', 'copy -50,0,0,0,200,100,400,200', 'png -1']);
  });
});
