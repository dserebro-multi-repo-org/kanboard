import { readFileSync, writeFileSync } from 'node:fs';
import { PngImageEngine, type ImageEngine, type RasterImage } from './image-engine.js';
import { SharpImageEngine } from './sharp-image-engine.js';

export type { ImageEngine, RasterImage } from './image-engine.js';
export { PngImageEngine } from './image-engine.js';
export { SharpImageEngine } from './sharp-image-engine.js';

/** `sharp` based engine (JPEG, GIF, PNG) when loadable, the built-in PNG only engine otherwise. */
let defaultEngine: ImageEngine = SharpImageEngine.create() ?? new PngImageEngine();

/** Replace the image engine used by new thumbnails (for example with a `sharp` based implementation). */
export function setDefaultImageEngine(engine: ImageEngine): void {
  defaultEngine = engine;
}

/**
 * Thumbnail generator, port of `app/Core/Thumbnail.php`. The GD calls are delegated to an {@link ImageEngine}.
 * Files are read and written synchronously, like the PHP API.
 */
export class Thumbnail {
  protected compression = -1;
  protected metadata: { width: number; height: number } | null = null;
  protected srcImage: RasterImage | null = null;
  protected dstImage: RasterImage | null = null;

  constructor(protected readonly engine: ImageEngine = defaultEngine) {}

  /** Create a thumbnail from a local file. */
  static createFromFile(filename: string, engine?: ImageEngine): Thumbnail {
    return new Thumbnail(engine).fromFile(filename);
  }

  /** Create a thumbnail from a binary string. */
  static createFromString(blob: Buffer, engine?: ImageEngine): Thumbnail {
    return new Thumbnail(engine).fromString(blob);
  }

  /** Load the local image file in memory. */
  fromFile(filename: string): this {
    return this.fromString(readFileSync(filename));
  }

  /** Load the image blob in memory. */
  fromString(blob: Buffer): this {
    this.metadata = this.engine.getImageSize(blob);
    this.srcImage = this.engine.decode(blob);
    return this;
  }

  /** Resize the image. */
  resize(width = 250, height = 100): this {
    if (this.metadata === null || this.srcImage === null) {
      throw new Error('Unable to read the image');
    }

    const srcWidth = this.metadata.width;
    const srcHeight = this.metadata.height;
    let dstX = 0;
    let dstY = 0;
    let dstWidth: number;
    let dstHeight: number;
    let canvasWidth: number;
    let canvasHeight: number;

    if (width === 0 && height === 0) {
      width = 100;
      height = 100;
    }

    if (width > 0 && height === 0) {
      dstWidth = width;
      dstHeight = Math.floor(srcHeight * (width / srcWidth));
      canvasWidth = dstWidth;
      canvasHeight = dstHeight;
    } else if (width === 0 && height > 0) {
      dstWidth = Math.floor(srcWidth * (height / srcHeight));
      dstHeight = height;
      canvasWidth = dstWidth;
      canvasHeight = dstHeight;
    } else {
      const srcRatio = srcWidth / srcHeight;
      const resizeRatio = width / height;

      if (srcRatio <= resizeRatio) {
        dstWidth = width;
        dstHeight = Math.floor(srcHeight * (width / srcWidth));
        dstY = ((dstHeight - height) / 2) * -1;
      } else {
        dstWidth = Math.floor(srcWidth * (height / srcHeight));
        dstHeight = height;
        dstX = ((dstWidth - width) / 2) * -1;
      }

      canvasWidth = width;
      canvasHeight = height;
    }

    if (canvasWidth < 1 || canvasHeight < 1 || dstWidth < 1 || dstHeight < 1) {
      throw new RangeError('Invalid thumbnail dimensions');
    }

    this.dstImage = this.engine.createCanvas(canvasWidth, canvasHeight);
    this.engine.copyResampled(this.dstImage, this.srcImage, Math.trunc(dstX), Math.trunc(dstY), 0, 0, Math.trunc(dstWidth), Math.trunc(dstHeight), srcWidth, srcHeight);

    return this;
  }

  /** Save the thumbnail to a local file (PNG). */
  toFile(filename: string): this {
    writeFileSync(filename, this.encode());
    this.release();
    return this;
  }

  /** Return the thumbnail as a binary string (PNG). */
  toString(): string {
    return this.toBuffer().toString('latin1');
  }

  /** Return the thumbnail as a PNG buffer. */
  toBuffer(): Buffer {
    const output = this.encode();
    this.release();
    return output;
  }

  /** Output the thumbnail directly, e.g. to a response (PHP `toOutput`). */
  toOutput(write: (chunk: Buffer) => void = (chunk) => void process.stdout.write(chunk)): void {
    write(this.encode());
    this.release();
  }

  private encode(): Buffer {
    if (this.dstImage === null) {
      throw new Error('The thumbnail has not been resized');
    }
    return this.engine.encodePng(this.dstImage, this.compression);
  }

  private release(): void {
    this.dstImage = null;
    this.srcImage = null;
  }
}
