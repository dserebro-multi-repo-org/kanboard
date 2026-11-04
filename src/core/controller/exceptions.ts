/** Base of the controller level exceptions (`app/Core/Controller/BaseException.php`). */
export class BaseException extends Error {
  protected noLayout = false;

  constructor(message = '') {
    super(message);
    this.name = new.target.name;
  }

  /** Mirror of PHP `getInstance()`. */
  static getInstance<T extends BaseException>(this: new (message?: string) => T, message = ''): T {
    return new this(message);
  }

  /** Render the error page without the application layout. */
  withoutLayout(): this {
    this.noLayout = true;
    return this;
  }

  /**
   * Same (inverted) semantics as the PHP method: returns true when the layout must be skipped.
   * Kept for port fidelity; prefer {@link isWithoutLayout}.
   */
  hasLayout(): boolean {
    return this.noLayout;
  }

  isWithoutLayout(): boolean {
    return this.noLayout;
  }
}

/** Maps to HTTP 403. */
export class AccessForbiddenException extends BaseException {}

/** Maps to HTTP 404. */
export class PageNotFoundException extends BaseException {}
