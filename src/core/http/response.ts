import type { Request } from './request.js';

/**
 * Minimal view of an HTTP reply. `FastifyReply` satisfies it structurally
 * (`code`, `header`, `send`).
 */
export interface HttpReplyLike {
  code(statusCode: number): unknown;
  header(name: string, value: string): unknown;
  send(payload?: unknown): unknown;
}

export interface ResponseOptions {
  /** Request used for AJAX redirects and HTTPS detection. */
  request?: Pick<Request, 'isAjax' | 'isHTTPS'>;
}

/**
 * Response builder, port of `app/Core/Http/Response.php`. Methods prefixed by `with` accumulate
 * state; `send()`, `status()`, `html()`, `json()`, `redirect()`, ... flush it to the reply.
 */
export class Response {
  private httpStatusCode = 200;
  private readonly httpHeaders = new Map<string, string>();
  private httpBody: string | Buffer | undefined;
  private responseSent = false;

  constructor(
    private readonly reply: HttpReplyLike,
    private readonly options: ResponseOptions = {},
  ) {}

  isResponseAlreadySent(): boolean {
    return this.responseSent;
  }

  getStatusCode(): number {
    return this.httpStatusCode;
  }

  getHeaders(): Readonly<Record<string, string>> {
    return Object.fromEntries(this.httpHeaders);
  }

  withStatusCode(statusCode: number): this {
    this.httpStatusCode = statusCode;
    return this;
  }

  withHeader(header: string, value: string): this {
    this.httpHeaders.set(header, value);
    return this;
  }

  withContentType(value: string): this {
    return this.withHeader('Content-Type', value);
  }

  withSecurityHeaders(): this {
    return this.withHeader('X-Content-Type-Options', 'nosniff').withHeader('X-XSS-Protection', '1; mode=block');
  }

  withContentSecurityPolicy(policies: Readonly<Record<string, string>> = {}): this {
    const value = Object.entries(policies)
      .map(([policy, acl]) => `${policy} ${acl.trim()}; `)
      .join('');
    return this.withHeader('Content-Security-Policy', value);
  }

  withXframe(): this {
    return this.withHeader('X-Frame-Options', 'DENY');
  }

  withStrictTransportSecurity(): this {
    if (this.options.request?.isHTTPS()) {
      this.withHeader('Strict-Transport-Security', 'max-age=31536000');
    }
    return this;
  }

  withBody(body: string | Buffer): this {
    this.httpBody = body;
    return this;
  }

  withCache(duration: number, etag = ''): this {
    this.withHeader('Pragma', 'cache')
      .withHeader('Expires', new Date(Date.now() + duration * 1000).toUTCString())
      .withHeader('Cache-Control', `public, max-age=${duration}`);
    return etag === '' ? this : this.withHeader('ETag', `"${etag}"`);
  }

  withoutCache(): this {
    return this.withHeader('Pragma', 'no-cache').withHeader('Expires', 'Sat, 26 Jul 1997 05:00:00 GMT');
  }

  withFileDownload(filename: string): this {
    return this.withHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .withHeader('Content-Transfer-Encoding', 'binary')
      .withHeader('Content-Type', 'application/octet-stream');
  }

  /** Flush status, headers and body to the underlying reply. */
  send(): void {
    this.responseSent = true;
    this.reply.code(this.httpStatusCode);

    for (const [header, value] of this.httpHeaders) {
      this.reply.header(header, value);
    }

    this.reply.send(this.httpBody === undefined || this.httpBody === '' ? undefined : this.httpBody);
  }

  /** Send an empty response with a status code. */
  status(statusCode: number): void {
    this.withStatusCode(statusCode).send();
  }

  /**
   * Redirect. For AJAX requests an `X-Ajax-Redirect` header is sent (200 status) instead of a `Location`
   * header, exactly like the PHP implementation; otherwise a 302 is used unless `statusCode` is given.
   */
  redirect(url: string, self = false, statusCode = 302): void {
    if (this.options.request?.isAjax()) {
      this.withHeader('X-Ajax-Redirect', self ? 'self' : url);
    } else {
      this.withStatusCode(statusCode).withHeader('Location', url);
    }
    this.send();
  }

  html(data: string, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('text/html; charset=utf-8').withBody(data).send();
  }

  text(data: string, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('text/plain; charset=utf-8').withBody(data).send();
  }

  json(data: unknown, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('application/json').withoutCache().withBody(JSON.stringify(data)).send();
  }

  xml(data: string, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('text/xml; charset=utf-8').withoutCache().withBody(data).send();
  }

  js(data: string, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('text/javascript; charset=utf-8').withBody(data).send();
  }

  css(data: string, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('text/css; charset=utf-8').withBody(data).send();
  }

  binary(data: Buffer | string, statusCode = 200): void {
    this.withStatusCode(statusCode)
      .withoutCache()
      .withHeader('Content-Transfer-Encoding', 'binary')
      .withContentType('application/octet-stream')
      .withBody(data)
      .send();
  }

  ical(data: string, statusCode = 200): void {
    this.withStatusCode(statusCode).withContentType('text/calendar; charset=utf-8').withBody(data).send();
  }

  pdf(data: Buffer | string, statusCode = 200, fileName = ''): void {
    this.withStatusCode(statusCode).withContentType('application/pdf');
    if (fileName !== '') {
      this.withHeader('Content-Disposition', `attachment; filename=${fileName}`);
    }
    this.withBody(data).send();
  }
}
