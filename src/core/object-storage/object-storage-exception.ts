/** Raised by object storage drivers (`ObjectStorageException.php`). */
export class ObjectStorageException extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ObjectStorageException';
  }
}
