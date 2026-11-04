import { isIpInNetworks, isValidIp } from './ip.js';

/** Header values as exposed by Node / Fastify (lower-cased names). */
export type HeadersLike = Readonly<Record<string, string | string[] | undefined>>;

/**
 * Minimal view of an incoming HTTP request. `FastifyRequest` satisfies it structurally when `ip`
 * is the *socket* address (do not enable Fastify `trustProxy`, forwarded headers are handled here).
 */
export interface HttpRequestLike {
  /** HTTP method (any case). */
  method: string;
  /** Raw request target: path + query string (PHP `REQUEST_URI`). */
  url: string;
  /** Request headers with lower-cased names. */
  headers: HeadersLike;
  /** Remote socket address (PHP `REMOTE_ADDR`). */
  ip?: string;
  /** Parsed query string parameters. */
  query?: unknown;
  /** Parsed body (form fields or JSON). */
  body?: unknown;
  /** Parsed cookies. */
  cookies?: Readonly<Record<string, string | undefined>>;
  /** `http` / `https` as seen by the server. */
  protocol?: string;
  /** Raw body for `getBody()`. */
  rawBody?: string | Buffer;
  /** Request start time in epoch seconds with fraction. */
  startTime?: number;
}

export interface RequestOptions {
  /** Comma separated header names, e.g. `X-Forwarded-For,X-Real-IP` (`HTTP_X_FORWARDED_FOR` style also accepted). */
  trustedProxyHeaders?: string | readonly string[];
  /** Comma separated CIDR list of proxies allowed to set those headers. */
  trustedProxyNetworks?: string | readonly string[];
  reverseProxyUserHeader?: string;
  reverseProxyEmailHeader?: string;
  reverseProxyFullnameHeader?: string;
  /** Validates the `csrf_token` form field in `getValues()`; when missing, no CSRF check is made. */
  csrfValidator?: (token: string) => boolean;
  /** Text returned by `getUserAgent()` when no user agent was sent. */
  unknownUserAgent?: string;
}

type Params = Record<string, unknown>;

function toList(value: string | readonly string[] | undefined): string[] {
  const items = typeof value === 'string' ? value.split(',') : [...(value ?? [])];
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

function toRecord(value: unknown): Params {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...(value as Params) } : {};
}

/** Normalize `HTTP_X_FORWARDED_FOR` / `X-Forwarded-For` / `REMOTE_USER` into a lower-cased header name. */
function toHeaderName(name: string): string {
  const stripped = name.startsWith('HTTP_') ? name.slice(5) : name;
  return stripped.replace(/_/g, '-').toLowerCase();
}

/**
 * Request helper, port of the pure parts of `app/Core/Http/Request.php` on top of {@link HttpRequestLike}.
 */
export class Request {
  private get: Params;
  private readonly post: Params;
  private readonly cookies: Readonly<Record<string, string | undefined>>;
  private readonly options: RequestOptions;

  constructor(
    private readonly req: HttpRequestLike,
    options: RequestOptions = {},
  ) {
    this.options = options;
    this.get = toRecord(req.query);
    this.post = toRecord(req.body);
    this.cookies = req.cookies ?? {};
  }

  /** Merge route parameters into the query parameters. */
  setParams(params: Params): void {
    this.get = { ...this.get, ...params };
  }

  getStringParam(name: string, defaultValue = ''): string {
    const value = this.get[name];
    return value === undefined || value === null ? defaultValue : String(value);
  }

  /** Non-negative integer parameter, default value when absent or not made only of digits. */
  getIntegerParam(name: string, defaultValue = 0): number {
    const value = this.get[name];
    return value !== undefined && value !== null && /^\d+$/.test(String(value)) ? Number.parseInt(String(value), 10) : defaultValue;
  }

  /**
   * Submitted form values (without `csrf_token`). Returns `{}` when the CSRF token is missing or
   * invalid (as in PHP). When no `csrfValidator` is configured only the presence of a token is required.
   */
  getValues(): Params {
    const token = this.post['csrf_token'];
    if (typeof token === 'string' && token !== '') {
      const valid = this.options.csrfValidator ? this.options.csrfValidator(token) : true;
      if (valid) {
        const { csrf_token: _ignored, ...values } = this.post;
        return this.filterValues(values);
      }
    }
    return {};
  }

  getValue(name: string): unknown {
    const value = this.getValues()[name];
    return value === undefined ? null : value;
  }

  getRawFormValues(): Params {
    return this.post;
  }

  getRawValue(name: string): unknown {
    const value = this.post[name];
    return value === undefined ? null : value;
  }

  getBody(): string {
    const raw = this.req.rawBody;
    if (raw !== undefined) return typeof raw === 'string' ? raw : raw.toString('utf8');
    const body = this.req.body;
    if (typeof body === 'string') return body;
    return body === undefined ? '' : JSON.stringify(body);
  }

  /** JSON payload as an object, `{}` when the content type is not JSON (unless not enforced) or invalid. */
  getJson(enforceContentType = true): Params {
    if (enforceContentType && !this.isJsonContentType()) return {};

    const body = this.req.body;
    if (typeof body === 'object' && body !== null) return toRecord(body);

    try {
      const parsed: unknown = JSON.parse(this.getBody());
      return toRecord(parsed);
    } catch {
      return {};
    }
  }

  getMethod(): string {
    return this.req.method.toUpperCase();
  }

  isPost(): boolean {
    return this.getMethod() === 'POST';
  }

  isAjax(): boolean {
    return this.getHeader('X-Requested-With') === 'XMLHttpRequest';
  }

  isJsonContentType(): boolean {
    return this.getHeader('Content-Type').toLowerCase().startsWith('application/json');
  }

  isHTTPS(): boolean {
    if (this.getHeader('X-Forwarded-Proto') === 'https') return true;
    return this.req.protocol === 'https';
  }

  getCookie(name: string): string {
    return this.cookies[name] ?? '';
  }

  /** Header value (first value when repeated), empty string when missing. Name is case-insensitive. */
  getHeader(name: string): string {
    const value = this.req.headers[toHeaderName(name)];
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
  }

  getRemoteUser(): string {
    return this.isTrustedProxy() ? this.getHeader(this.options.reverseProxyUserHeader ?? 'REMOTE_USER') : '';
  }

  getRemoteEmail(): string {
    return this.isTrustedProxy() ? this.getHeader(this.options.reverseProxyEmailHeader ?? 'REMOTE_EMAIL') : '';
  }

  getRemoteName(): string {
    return this.isTrustedProxy() ? this.getHeader(this.options.reverseProxyFullnameHeader ?? 'REMOTE_FULLNAME') : '';
  }

  /** Raw query string without the leading `?`. */
  getQueryString(): string {
    const index = this.req.url.indexOf('?');
    return index === -1 ? '' : this.req.url.slice(index + 1);
  }

  /** Request target (path + query), PHP `REQUEST_URI`. */
  getUri(): string {
    return this.req.url;
  }

  /** Only local absolute paths (`/foo?bar`) are safe redirect targets. */
  isSafeRedirectUri(uri: string): boolean {
    const value = uri.trim();
    if (value === '') return false;
    if (value.includes('\\')) return false;
    if (value.startsWith('//')) return false;
    if (!value.startsWith('/')) return false;
    // Reject control characters, which browsers strip, enabling "/\t/evil.com" style bypasses
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(value)) return false;

    try {
      const parsed = new URL(value, 'http://localhost');
      return parsed.host === 'localhost';
    } catch {
      return false;
    }
  }

  getUserAgent(): string {
    const agent = this.getHeader('User-Agent');
    return agent === '' ? (this.options.unknownUserAgent ?? 'Unknown') : agent;
  }

  /** Socket address of the peer (PHP `REMOTE_ADDR`). */
  getClientIpAddress(): string {
    return this.req.ip ?? '';
  }

  /**
   * Client IP address, honouring trusted proxy headers only when the peer is itself a trusted proxy.
   * For list headers (`X-Forwarded-For`) the rightmost address that is not a trusted proxy is used.
   */
  getIpAddress(trustedProxyHeaders: readonly string[] = [], trustedProxyNetworks: readonly string[] = []): string {
    const headers = trustedProxyHeaders.length > 0 ? toList(trustedProxyHeaders) : toList(this.options.trustedProxyHeaders);
    const networks = trustedProxyNetworks.length > 0 ? toList(trustedProxyNetworks) : toList(this.options.trustedProxyNetworks);

    if (headers.length === 0 || !this.isTrustedProxy(networks)) {
      return this.getClientIpAddress();
    }

    for (const key of headers) {
      const header = this.getHeader(key);
      if (header === '') continue;

      const ipAddress = this.resolveForwardedClientIp(header, networks);
      if (ipAddress !== '') return ipAddress;
    }

    return this.getClientIpAddress();
  }

  /** Whether the peer address is inside the trusted proxy networks. */
  isTrustedProxy(trustedProxyNetworks: readonly string[] = []): boolean {
    const ipAddress = this.getClientIpAddress();
    if (ipAddress === '') return false;

    const networks = trustedProxyNetworks.length > 0 ? toList(trustedProxyNetworks) : toList(this.options.trustedProxyNetworks);
    if (networks.length === 0) return false;

    return isIpInNetworks(ipAddress, networks);
  }

  /** Request start time (epoch seconds). */
  getStartTime(): number {
    return this.req.startTime ?? 0;
  }

  protected resolveForwardedClientIp(header: string, trustedProxyNetworks: readonly string[]): string {
    const addresses = header.split(',').map((address) => address.trim());

    // A proxy-owned header such as X-Real-IP is a single value. Trust it even when it is the proxy
    // itself, so a later forwarded list cannot replace an address the proxy explicitly set.
    if (addresses.length === 1) {
      const only = addresses[0] ?? '';
      return isValidIp(only) ? only : '';
    }

    for (let i = addresses.length - 1; i >= 0; i--) {
      const ipAddress = addresses[i] ?? '';
      if (!isValidIp(ipAddress)) continue;
      if (isIpInNetworks(ipAddress, trustedProxyNetworks)) continue;
      return ipAddress;
    }

    return '';
  }

  protected filterValues(values: Params): Params {
    const filtered: Params = {};
    for (const [key, value] of Object.entries(values)) {
      // IE11 workaround when submitting multipart/form-data
      if (key.startsWith('-----------------------------')) continue;
      filtered[key] = value;
    }
    return filtered;
  }
}
