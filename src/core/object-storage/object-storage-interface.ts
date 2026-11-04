import type { Readable } from 'node:stream';

export type StorageBlob = Buffer | Uint8Array | string;

/**
 * Storage for attachments and thumbnails (`app/Core/ObjectStorage/ObjectStorageInterface.php`).
 * Methods are asynchronous; failures reject with `ObjectStorageException`.
 */
export interface ObjectStorageInterface {
  /** Read the whole object. */
  get(key: string): Promise<Buffer>;
  /** Write an object, creating intermediate folders. */
  put(key: string, blob: StorageBlob): Promise<void>;
  /** Stream the object, to be piped into an HTTP response (PHP `output`). */
  output(key: string): Promise<Readable>;
  /** Move a local file into the storage. */
  moveFile(filename: string, key: string): Promise<boolean>;
  /** Move an uploaded temporary file into the storage (uploads are plain temp files in Node). */
  moveUploadedFile(filename: string, key: string): Promise<boolean>;
  /** Delete the object and its parent folder when empty. */
  remove(key: string): Promise<boolean>;
}
