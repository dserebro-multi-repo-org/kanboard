import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { SharpImageEngine, Thumbnail } from '../../../src/core/thumbnail.js';

const engine = SharpImageEngine.create();
if (engine === null) throw new Error('sharp is not loadable');

const raw = { width: 200, height: 100, channels: 3 as const, background: { r: 200, g: 30, b: 30 } };
const fixtures = {
  jpeg: () => sharp({ create: raw }).jpeg().toBuffer(),
  png: () => sharp({ create: raw }).png().toBuffer(),
  gif: () => sharp({ create: raw }).gif().toBuffer(),
};

describe('SharpImageEngine', () => {
  for (const format of ['jpeg', 'png', 'gif'] as const) {
    it(`resizes a ${format} image with the Thumbnail geometry`, async () => {
      const blob = await fixtures[format]();
      const output = Thumbnail.createFromString(blob, engine as SharpImageEngine).resize(50, 50).toBuffer();
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('png');
      expect([meta.width, meta.height]).toEqual([50, 50]);
      const { data } = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(Math.abs((data[0] as number) - 200)).toBeLessThan(12);
      expect(Math.abs((data[1] as number) - 30)).toBeLessThan(12);
    });
  }

  it('keeps the ratio when only the width is given', async () => {
    const output = Thumbnail.createFromString(await fixtures.jpeg(), engine as SharpImageEngine).resize(100, 0).toBuffer();
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([100, 50]);
  });

  it('encodes JPEG and GIF', async () => {
    const image = (engine as SharpImageEngine).createCanvas(8, 8);
    expect((await sharp((engine as SharpImageEngine).encodeJpeg(image)).metadata()).format).toBe('jpeg');
    expect((await sharp((engine as SharpImageEngine).encodeGif(image)).metadata()).format).toBe('gif');
  });

  it('returns null for garbage and the default engine decodes JPEG', async () => {
    expect((engine as SharpImageEngine).decode(Buffer.from('nope'))).toBeNull();
    const thumb = Thumbnail.createFromString(await fixtures.jpeg()).resize(20, 10);
    expect(thumb.toBuffer().subarray(1, 4).toString()).toBe('PNG');
  });
});
