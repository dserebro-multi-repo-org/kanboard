import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, realpath, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { ObjectStorageException } from './object-storage-exception.js';
import type { StorageBlob, ObjectStorageInterface } from './object-storage-interface.js';

/** Filesystem backed storage (`app/Core/ObjectStorage/FileStorage.php`). Keys can never escape the base directory. */
export class FileStorage implements ObjectStorageInterface {
  private constructor(private readonly baseDir: string) {}

  /** Create a storage rooted at an existing directory. */
  static async create(baseDir: string): Promise<FileStorage> {
    let realBaseDir: string;
    try {
      realBaseDir = await realpath(baseDir);
    } catch (error) {
      throw new ObjectStorageException(`Invalid base folder: ${baseDir}`, { cause: error });
    }

    if (!(await stat(realBaseDir)).isDirectory()) {
      throw new ObjectStorageException(`Base folder is not a directory: ${baseDir}`);
    }

    return new FileStorage(realBaseDir);
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  async get(key: string): Promise<Buffer> {
    const filename = await this.getRealFilePath(key);
    return readFile(filename);
  }

  async put(key: string, blob: StorageBlob): Promise<void> {
    const filename = this.getSanitizedFilePath(key);
    await this.createFolder(filename);

    try {
      await writeFile(filename, blob);
    } catch (error) {
      throw new ObjectStorageException(`Unable to write the file: ${filename}`, { cause: error });
    }
  }

  async output(key: string): Promise<Readable> {
    return createReadStream(await this.getRealFilePath(key));
  }

  async moveFile(srcFilename: string, key: string): Promise<boolean> {
    return this.move(srcFilename, key);
  }

  async moveUploadedFile(srcFilename: string, key: string): Promise<boolean> {
    return this.move(srcFilename, key);
  }

  async remove(key: string): Promise<boolean> {
    const filename = await this.getRealFilePath(key);

    try {
      await unlink(filename);
    } catch {
      return false;
    }

    // Remove the parent folder if empty (never the base folder)
    const parent = path.dirname(filename);
    if (parent !== this.baseDir) {
      try {
        if ((await readdir(parent)).length === 0) {
          await rmdir(parent);
        }
      } catch {
        // best effort
      }
    }

    return true;
  }

  /** Absolute path of a key, validated to stay inside the base directory (the file may not exist). */
  getSanitizedFilePath(key: string): string {
    if (key === '') {
      throw new ObjectStorageException(`Invalid file path: ${key}`);
    }

    const resolved = path.resolve(this.baseDir, key);
    this.validateBasePath(resolved);
    return resolved;
  }

  private async move(srcFilename: string, key: string): Promise<boolean> {
    try {
      await stat(srcFilename);
    } catch (error) {
      throw new ObjectStorageException(`Source file does not exist: ${srcFilename}`, { cause: error });
    }

    const dstFilename = this.getSanitizedFilePath(key);
    await this.createFolder(dstFilename);

    try {
      await rename(srcFilename, dstFilename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        // Cross-device move (e.g. os tmpdir on another mount)
        await copyFile(srcFilename, dstFilename);
        await unlink(srcFilename);
        return true;
      }
      throw new ObjectStorageException(`Unable to move the file: ${srcFilename} to ${dstFilename}`, { cause: error });
    }

    return true;
  }

  private async createFolder(filename: string): Promise<void> {
    const folder = path.dirname(filename);
    try {
      await mkdir(folder, { recursive: true, mode: 0o755 });
    } catch (error) {
      throw new ObjectStorageException(`Unable to create folder: ${folder}`, { cause: error });
    }
  }

  private async getRealFilePath(key: string): Promise<string> {
    const filename = this.getSanitizedFilePath(key);
    let realFilePath: string;
    try {
      realFilePath = await realpath(filename);
    } catch (error) {
      throw new ObjectStorageException(`Invalid file path: ${filename}`, { cause: error });
    }

    this.validateBasePath(realFilePath);
    return realFilePath;
  }

  private validateBasePath(filePath: string): void {
    if (filePath !== this.baseDir && !filePath.startsWith(this.baseDir + path.sep)) {
      throw new ObjectStorageException(`File ${filePath} is not in base directory: ${this.baseDir}`);
    }
  }
}
