import path from 'node:path';
import { configSchema, type AppConfig } from './schema.js';

export { configSchema, DB_DRIVERS, LOG_DRIVERS, SESSION_HANDLERS, LDAP_BIND_TYPES } from './schema.js';
export type { AppConfig, ConfigKey } from './schema.js';

/** Environment variables map (compatible with `process.env`). */
export type Env = Readonly<Record<string, string | undefined>>;

export interface LoadConfigOptions {
  /**
   * Root directory used to derive default `DATA_DIR` and `PLUGINS_DIR`
   * (equivalent of `ROOT_DIR` in `app/constants.php`). Defaults to `process.cwd()`.
   */
  rootDir?: string;
}

/** Raw string of an env var, treating undefined and empty string as "not set" (PHP `getenv() ?: default`). */
function raw(env: Env, name: string): string | undefined {
  const value = env[name];
  return value === undefined || value === '' ? undefined : value;
}

/** `getenv('X') ?: 'default'` */
function str(env: Env, name: string, fallback: string): string {
  return raw(env, name) ?? fallback;
}

/** `getenv('X') ?: null` */
function nullableStr(env: Env, name: string, fallback: string | null = null): string | null {
  return raw(env, name) ?? fallback;
}

/**
 * Boolean flag. PHP: `getenv('X') ? strtolower(getenv('X')) === 'true' : default`
 * (and `strtolower(getenv('X')) === 'true'` for default false).
 */
function bool(env: Env, name: string, fallback: boolean): boolean {
  const value = raw(env, name);
  return value === undefined ? fallback : value.toLowerCase() === 'true';
}

/** PHP `intval()` semantics: leading integer part, 0 when not numeric. */
function intval(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** `intval(getenv('X')) ?: default` (0 and non numeric values fall back to the default). */
function int(env: Env, name: string, fallback: number): number {
  const value = raw(env, name);
  return (value === undefined ? 0 : intval(value)) || fallback;
}

/** `intval(getenv('X')) ?: null` */
function nullableInt(env: Env, name: string): number | null {
  const value = raw(env, name);
  return (value === undefined ? 0 : intval(value)) || null;
}

/** Database settings extracted from a `DATABASE_URL`. */
export interface ParsedDatabaseUrl {
  DB_DRIVER: 'sqlite' | 'mysql' | 'postgres';
  DB_FILENAME?: string;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_HOSTNAME?: string;
  DB_PORT?: number;
  DB_NAME?: string;
}

/**
 * Parse a `DATABASE_URL` such as `postgres://user:pass@host:5432/kanboard`,
 * `mysql://user:pass@host/kanboard` or `sqlite:///var/data/db.sqlite` (also `sqlite:relative.db`).
 * Throws on unsupported schemes.
 */
export function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  const scheme = schemeMatch?.[1]?.toLowerCase();

  if (scheme === 'sqlite') {
    const rest = url.slice('sqlite:'.length);
    let filename = rest.startsWith('//') ? rest.slice(2) : rest;
    // sqlite:///abs/path -> "/abs/path"; sqlite://relative -> "relative"
    filename = decodeURIComponent(filename);
    return filename === '' ? { DB_DRIVER: 'sqlite' } : { DB_DRIVER: 'sqlite', DB_FILENAME: filename };
  }

  let driver: 'mysql' | 'postgres';
  if (scheme === 'postgres' || scheme === 'postgresql') {
    driver = 'postgres';
  } else if (scheme === 'mysql' || scheme === 'mariadb') {
    driver = 'mysql';
  } else {
    throw new Error(`Unsupported DATABASE_URL scheme: ${scheme ?? url}`);
  }

  const parsed = new URL(url);
  const result: ParsedDatabaseUrl = { DB_DRIVER: driver };
  if (parsed.username) result.DB_USERNAME = decodeURIComponent(parsed.username);
  if (parsed.password) result.DB_PASSWORD = decodeURIComponent(parsed.password);
  if (parsed.hostname) result.DB_HOSTNAME = parsed.hostname;
  if (parsed.port) result.DB_PORT = Number.parseInt(parsed.port, 10);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (dbName) result.DB_NAME = dbName;
  return result;
}

/**
 * Build the typed configuration from environment variables.
 *
 * Defaults and env var names mirror `app/constants.php` (which are the effective
 * defaults when no `config.php` exists). Additional Node specific variables:
 * `PORT` (default 8080), `HOST` (default 0.0.0.0) and `DATABASE_URL`, which sets the
 * database driver/credentials; explicit `DB_*` variables take precedence over it.
 *
 * Throws a `ZodError` when a value is invalid (e.g. unknown `DB_DRIVER`).
 * The returned object is deeply frozen (flat structure, so a shallow freeze).
 */
export function loadConfig(env: Env = process.env, options: LoadConfigOptions = {}): AppConfig {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const dataDir = str(env, 'DATA_DIR', path.join(rootDir, 'data'));

  const databaseUrl = nullableStr(env, 'DATABASE_URL');
  const fromUrl: Partial<ParsedDatabaseUrl> = databaseUrl === null ? {} : parseDatabaseUrl(databaseUrl);

  const candidate = {
    ROOT_DIR: rootDir,
    HOST: str(env, 'HOST', '0.0.0.0'),
    PORT: raw(env, 'PORT') === undefined ? 8080 : intval(str(env, 'PORT', '8080')),

    DATA_DIR: dataDir,
    FILES_DIR: str(env, 'FILES_DIR', path.join(dataDir, 'files')),
    CACHE_DIR: str(env, 'CACHE_DIR', path.join(dataDir, 'cache')),
    PLUGINS_DIR: str(env, 'PLUGINS_DIR', path.join(rootDir, 'plugins')),

    PLUGIN_API_URL: str(env, 'PLUGIN_API_URL', 'https://kanboard.org/plugins.json'),
    PLUGIN_INSTALLER: bool(env, 'PLUGIN_INSTALLER', false),

    DEBUG: bool(env, 'DEBUG', false),
    LOG_DRIVER: str(env, 'LOG_DRIVER', 'system'),
    LOG_FILE: str(env, 'LOG_FILE', path.join(dataDir, 'debug.log')),

    APP_VERSION: str(env, 'APP_VERSION', 'main.unknown_revision'),
    DOCUMENTATION_URL_PATTERN: str(env, 'DOCUMENTATION_URL_PATTERN', 'https://docs.kanboard.org/v1/user/%s'),

    DATABASE_URL: databaseUrl,
    DB_RUN_MIGRATIONS: bool(env, 'DB_RUN_MIGRATIONS', true),
    DB_DRIVER: str(env, 'DB_DRIVER', fromUrl.DB_DRIVER ?? 'sqlite'),
    DB_FILENAME: str(env, 'DB_FILENAME', fromUrl.DB_FILENAME ?? path.join(dataDir, 'db.sqlite')),
    DB_WAL_MODE: bool(env, 'DB_WAL_MODE', true),
    DB_USERNAME: str(env, 'DB_USERNAME', fromUrl.DB_USERNAME ?? 'root'),
    DB_PASSWORD: str(env, 'DB_PASSWORD', fromUrl.DB_PASSWORD ?? ''),
    DB_HOSTNAME: str(env, 'DB_HOSTNAME', fromUrl.DB_HOSTNAME ?? 'localhost'),
    DB_NAME: str(env, 'DB_NAME', fromUrl.DB_NAME ?? 'kanboard'),
    DB_PORT: nullableInt(env, 'DB_PORT') ?? fromUrl.DB_PORT ?? null,
    DB_ODBC_DSN: str(env, 'DB_ODBC_DSN', 'kanboard'),
    DB_SSL_KEY: nullableStr(env, 'DB_SSL_KEY'),
    DB_SSL_CERT: nullableStr(env, 'DB_SSL_CERT'),
    DB_SSL_CA: nullableStr(env, 'DB_SSL_CA'),
    DB_VERIFY_SERVER_CERT: nullableStr(env, 'DB_VERIFY_SERVER_CERT'),
    DB_TIMEOUT: nullableInt(env, 'DB_TIMEOUT'),
    DB_GROUP_PROVIDER: bool(env, 'DB_GROUP_PROVIDER', true),
    DB_USER_PROVIDER: bool(env, 'DB_USER_PROVIDER', true),

    LDAP_AUTH: bool(env, 'LDAP_AUTH', false),
    LDAP_SERVER: str(env, 'LDAP_SERVER', ''),
    LDAP_PORT: int(env, 'LDAP_PORT', 389),
    LDAP_SSL_VERIFY: bool(env, 'LDAP_SSL_VERIFY', true),
    LDAP_START_TLS: bool(env, 'LDAP_START_TLS', false),
    LDAP_USERNAME_CASE_SENSITIVE: bool(env, 'LDAP_USERNAME_CASE_SENSITIVE', false),
    LDAP_BIND_TYPE: str(env, 'LDAP_BIND_TYPE', 'anonymous'),
    LDAP_USERNAME: nullableStr(env, 'LDAP_USERNAME'),
    LDAP_PASSWORD: nullableStr(env, 'LDAP_PASSWORD'),
    LDAP_USER_BASE_DN: str(env, 'LDAP_USER_BASE_DN', ''),
    LDAP_USER_FILTER: str(env, 'LDAP_USER_FILTER', ''),
    LDAP_USER_ATTRIBUTE_USERNAME: str(env, 'LDAP_USER_ATTRIBUTE_USERNAME', 'uid'),
    LDAP_USER_ATTRIBUTE_FULLNAME: str(env, 'LDAP_USER_ATTRIBUTE_FULLNAME', 'cn'),
    LDAP_USER_ATTRIBUTE_EMAIL: str(env, 'LDAP_USER_ATTRIBUTE_EMAIL', 'mail'),
    LDAP_USER_ATTRIBUTE_GROUPS: str(env, 'LDAP_USER_ATTRIBUTE_GROUPS', 'memberof'),
    LDAP_USER_ATTRIBUTE_PHOTO: str(env, 'LDAP_USER_ATTRIBUTE_PHOTO', ''),
    LDAP_USER_ATTRIBUTE_LANGUAGE: str(env, 'LDAP_USER_ATTRIBUTE_LANGUAGE', ''),
    LDAP_USER_CREATION: bool(env, 'LDAP_USER_CREATION', true),
    LDAP_USER_DEFAULT_ROLE_MANAGER: bool(env, 'LDAP_USER_DEFAULT_ROLE_MANAGER', false),
    LDAP_GROUP_ADMIN_DN: str(env, 'LDAP_GROUP_ADMIN_DN', ''),
    LDAP_GROUP_MANAGER_DN: str(env, 'LDAP_GROUP_MANAGER_DN', ''),
    LDAP_GROUP_PROVIDER: bool(env, 'LDAP_GROUP_PROVIDER', false),
    LDAP_GROUP_BASE_DN: str(env, 'LDAP_GROUP_BASE_DN', ''),
    LDAP_GROUP_FILTER: str(env, 'LDAP_GROUP_FILTER', ''),
    LDAP_GROUP_USER_FILTER: str(env, 'LDAP_GROUP_USER_FILTER', ''),
    LDAP_GROUP_USER_ATTRIBUTE: str(env, 'LDAP_GROUP_USER_ATTRIBUTE', 'username'),
    LDAP_GROUP_ATTRIBUTE_NAME: str(env, 'LDAP_GROUP_ATTRIBUTE_NAME', 'cn'),
    // PHP: `getenv('LDAP_GROUP_SYNC') ?: true` (any non-empty value is truthy there); we accept 'true'/'false'.
    LDAP_GROUP_SYNC: bool(env, 'LDAP_GROUP_SYNC', true),

    REVERSE_PROXY_AUTH: bool(env, 'REVERSE_PROXY_AUTH', false),
    REVERSE_PROXY_USER_HEADER: str(env, 'REVERSE_PROXY_USER_HEADER', 'REMOTE_USER'),
    REVERSE_PROXY_EMAIL_HEADER: str(env, 'REVERSE_PROXY_EMAIL_HEADER', 'REMOTE_EMAIL'),
    REVERSE_PROXY_FULLNAME_HEADER: str(env, 'REVERSE_PROXY_FULLNAME_HEADER', 'REMOTE_FULLNAME'),
    REVERSE_PROXY_DEFAULT_ADMIN: str(env, 'REVERSE_PROXY_DEFAULT_ADMIN', ''),
    REVERSE_PROXY_DEFAULT_DOMAIN: str(env, 'REVERSE_PROXY_DEFAULT_DOMAIN', ''),

    REMEMBER_ME_AUTH: bool(env, 'REMEMBER_ME_AUTH', true),
    HIDE_LOGIN_FORM: bool(env, 'HIDE_LOGIN_FORM', false),
    DISABLE_LOGOUT: bool(env, 'DISABLE_LOGOUT', false),
    BRUTEFORCE_CAPTCHA: int(env, 'BRUTEFORCE_CAPTCHA', 3),
    BRUTEFORCE_LOCKDOWN: int(env, 'BRUTEFORCE_LOCKDOWN', 6),
    BRUTEFORCE_LOCKDOWN_DURATION: int(env, 'BRUTEFORCE_LOCKDOWN_DURATION', 15),
    SESSION_DURATION: int(env, 'SESSION_DURATION', 0),
    SESSION_HANDLER: str(env, 'SESSION_HANDLER', 'db'),
    TOTP_ISSUER: str(env, 'TOTP_ISSUER', 'Kanboard'),
    EXTERNAL_AUTH_EXCLUDE_FIELDS: str(env, 'EXTERNAL_AUTH_EXCLUDE_FIELDS', 'username'),
    API_AUTHENTICATION_HEADER: str(env, 'API_AUTHENTICATION_HEADER', ''),
    API_AUTHENTICATION_TOKEN: nullableStr(env, 'API_AUTHENTICATION_TOKEN'),

    MAIL_CONFIGURATION: bool(env, 'MAIL_CONFIGURATION', true),
    MAIL_FROM: str(env, 'MAIL_FROM', 'notifications@kanboard.local'),
    MAIL_BCC: str(env, 'MAIL_BCC', ''),
    MAIL_TRANSPORT: str(env, 'MAIL_TRANSPORT', 'mail'),
    MAIL_SMTP_HOSTNAME: str(env, 'MAIL_SMTP_HOSTNAME', ''),
    MAIL_SMTP_PORT: int(env, 'MAIL_SMTP_PORT', 25),
    MAIL_SMTP_USERNAME: str(env, 'MAIL_SMTP_USERNAME', ''),
    MAIL_SMTP_PASSWORD: str(env, 'MAIL_SMTP_PASSWORD', ''),
    MAIL_SMTP_HELO_NAME: nullableStr(env, 'MAIL_SMTP_HELO_NAME'),
    MAIL_SMTP_ENCRYPTION: nullableStr(env, 'MAIL_SMTP_ENCRYPTION'),
    MAIL_SENDMAIL_COMMAND: str(env, 'MAIL_SENDMAIL_COMMAND', '/usr/sbin/sendmail -bs'),

    ENABLE_HSTS: bool(env, 'ENABLE_HSTS', true),
    ENABLE_XFRAME: bool(env, 'ENABLE_XFRAME', true),
    MARKDOWN_ESCAPE_HTML: bool(env, 'MARKDOWN_ESCAPE_HTML', true),
    ENABLE_URL_REWRITE: bool(env, 'ENABLE_URL_REWRITE', false),

    HTTP_TIMEOUT: int(env, 'HTTP_TIMEOUT', 10),
    HTTP_MAX_REDIRECTS: int(env, 'HTTP_MAX_REDIRECTS', 3),
    HTTP_PROXY_HOSTNAME: str(env, 'HTTP_PROXY_HOSTNAME', ''),
    HTTP_PROXY_PORT: str(env, 'HTTP_PROXY_PORT', '3128'),
    HTTP_PROXY_USERNAME: str(env, 'HTTP_PROXY_USERNAME', ''),
    HTTP_PROXY_PASSWORD: str(env, 'HTTP_PROXY_PASSWORD', ''),
    HTTP_PROXY_EXCLUDE: str(env, 'HTTP_PROXY_EXCLUDE', 'localhost'),
    HTTP_VERIFY_SSL_CERTIFICATE: bool(env, 'HTTP_VERIFY_SSL_CERTIFICATE', true),

    SHOW_GROUP_MEMBERSHIPS_IN_USERLIST: bool(env, 'SHOW_GROUP_MEMBERSHIPS_IN_USERLIST', true),
    SHOW_GROUP_MEMBERSHIPS_IN_USERLIST_WITH_LIMIT: int(env, 'SHOW_GROUP_MEMBERSHIPS_IN_USERLIST_WITH_LIMIT', 7),
    DASHBOARD_MAX_PROJECTS: int(env, 'DASHBOARD_MAX_PROJECTS', 10),

    TRUSTED_PROXY_HEADERS: str(env, 'TRUSTED_PROXY_HEADERS', ''),
    TRUSTED_PROXY_NETWORKS: str(env, 'TRUSTED_PROXY_NETWORKS', ''),
    EXTERNAL_LINK_ALLOW_PRIVATE_NETWORKS: bool(env, 'EXTERNAL_LINK_ALLOW_PRIVATE_NETWORKS', false),
    WEBHOOK_ALLOW_PRIVATE_NETWORKS: bool(env, 'WEBHOOK_ALLOW_PRIVATE_NETWORKS', false),
  };

  return Object.freeze(configSchema.parse(candidate));
}
