import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, parseDatabaseUrl, configSchema } from '../../../src/config/index.js';

const ROOT = path.resolve('/srv/kanboard-test');
const load = (env: Record<string, string> = {}) => loadConfig(env, { rootDir: ROOT });

const defaults: Record<string, unknown> = {
  ROOT_DIR: ROOT,
  HOST: '0.0.0.0',
  PORT: 8080,
  DATA_DIR: path.join(ROOT, 'data'),
  FILES_DIR: path.join(ROOT, 'data', 'files'),
  CACHE_DIR: path.join(ROOT, 'data', 'cache'),
  PLUGINS_DIR: path.join(ROOT, 'plugins'),
  PLUGIN_API_URL: 'https://kanboard.org/plugins.json',
  PLUGIN_INSTALLER: false,
  DEBUG: false,
  LOG_DRIVER: 'system',
  LOG_FILE: path.join(ROOT, 'data', 'debug.log'),
  APP_VERSION: 'main.unknown_revision',
  DOCUMENTATION_URL_PATTERN: 'https://docs.kanboard.org/v1/user/%s',
  DATABASE_URL: null,
  DB_RUN_MIGRATIONS: true,
  DB_DRIVER: 'sqlite',
  DB_FILENAME: path.join(ROOT, 'data', 'db.sqlite'),
  DB_WAL_MODE: true,
  DB_USERNAME: 'root',
  DB_PASSWORD: '',
  DB_HOSTNAME: 'localhost',
  DB_NAME: 'kanboard',
  DB_PORT: null,
  DB_ODBC_DSN: 'kanboard',
  DB_SSL_KEY: null,
  DB_SSL_CERT: null,
  DB_SSL_CA: null,
  DB_VERIFY_SERVER_CERT: null,
  DB_TIMEOUT: null,
  DB_GROUP_PROVIDER: true,
  DB_USER_PROVIDER: true,
  LDAP_AUTH: false,
  LDAP_SERVER: '',
  LDAP_PORT: 389,
  LDAP_SSL_VERIFY: true,
  LDAP_START_TLS: false,
  LDAP_USERNAME_CASE_SENSITIVE: false,
  LDAP_BIND_TYPE: 'anonymous',
  LDAP_USERNAME: null,
  LDAP_PASSWORD: null,
  LDAP_USER_BASE_DN: '',
  LDAP_USER_FILTER: '',
  LDAP_USER_ATTRIBUTE_USERNAME: 'uid',
  LDAP_USER_ATTRIBUTE_FULLNAME: 'cn',
  LDAP_USER_ATTRIBUTE_EMAIL: 'mail',
  LDAP_USER_ATTRIBUTE_GROUPS: 'memberof',
  LDAP_USER_ATTRIBUTE_PHOTO: '',
  LDAP_USER_ATTRIBUTE_LANGUAGE: '',
  LDAP_USER_CREATION: true,
  LDAP_USER_DEFAULT_ROLE_MANAGER: false,
  LDAP_GROUP_ADMIN_DN: '',
  LDAP_GROUP_MANAGER_DN: '',
  LDAP_GROUP_PROVIDER: false,
  LDAP_GROUP_BASE_DN: '',
  LDAP_GROUP_FILTER: '',
  LDAP_GROUP_USER_FILTER: '',
  LDAP_GROUP_USER_ATTRIBUTE: 'username',
  LDAP_GROUP_ATTRIBUTE_NAME: 'cn',
  LDAP_GROUP_SYNC: true,
  REVERSE_PROXY_AUTH: false,
  REVERSE_PROXY_USER_HEADER: 'REMOTE_USER',
  REVERSE_PROXY_EMAIL_HEADER: 'REMOTE_EMAIL',
  REVERSE_PROXY_FULLNAME_HEADER: 'REMOTE_FULLNAME',
  REVERSE_PROXY_DEFAULT_ADMIN: '',
  REVERSE_PROXY_DEFAULT_DOMAIN: '',
  REMEMBER_ME_AUTH: true,
  HIDE_LOGIN_FORM: false,
  DISABLE_LOGOUT: false,
  BRUTEFORCE_CAPTCHA: 3,
  BRUTEFORCE_LOCKDOWN: 6,
  BRUTEFORCE_LOCKDOWN_DURATION: 15,
  SESSION_DURATION: 0,
  SESSION_HANDLER: 'db',
  TOTP_ISSUER: 'Kanboard',
  EXTERNAL_AUTH_EXCLUDE_FIELDS: 'username',
  API_AUTHENTICATION_HEADER: '',
  API_AUTHENTICATION_TOKEN: null,
  MAIL_CONFIGURATION: true,
  MAIL_FROM: 'notifications@kanboard.local',
  MAIL_BCC: '',
  MAIL_TRANSPORT: 'mail',
  MAIL_SMTP_HOSTNAME: '',
  MAIL_SMTP_PORT: 25,
  MAIL_SMTP_USERNAME: '',
  MAIL_SMTP_PASSWORD: '',
  MAIL_SMTP_HELO_NAME: null,
  MAIL_SMTP_ENCRYPTION: null,
  MAIL_SENDMAIL_COMMAND: '/usr/sbin/sendmail -bs',
  ENABLE_HSTS: true,
  ENABLE_XFRAME: true,
  MARKDOWN_ESCAPE_HTML: true,
  ENABLE_URL_REWRITE: false,
  HTTP_TIMEOUT: 10,
  HTTP_MAX_REDIRECTS: 3,
  HTTP_PROXY_HOSTNAME: '',
  HTTP_PROXY_PORT: '3128',
  HTTP_PROXY_USERNAME: '',
  HTTP_PROXY_PASSWORD: '',
  HTTP_PROXY_EXCLUDE: 'localhost',
  HTTP_VERIFY_SSL_CERTIFICATE: true,
  SHOW_GROUP_MEMBERSHIPS_IN_USERLIST: true,
  SHOW_GROUP_MEMBERSHIPS_IN_USERLIST_WITH_LIMIT: 7,
  DASHBOARD_MAX_PROJECTS: 10,
  TRUSTED_PROXY_HEADERS: '',
  TRUSTED_PROXY_NETWORKS: '',
  EXTERNAL_LINK_ALLOW_PRIVATE_NETWORKS: false,
  WEBHOOK_ALLOW_PRIVATE_NETWORKS: false,
};

describe('loadConfig defaults', () => {
  const config = load();

  it('covers every schema key', () => {
    expect(Object.keys(defaults).sort()).toEqual(Object.keys(configSchema.shape).sort());
    expect(Object.keys(config).sort()).toEqual(Object.keys(defaults).sort());
  });

  it.each(Object.entries(defaults))('%s has the documented default', (key, expected) => {
    expect((config as unknown as Record<string, unknown>)[key]).toEqual(expected);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe('loadConfig environment overrides', () => {
  it('parses booleans case-insensitively', () => {
    const config = load({ DEBUG: 'TRUE', ENABLE_HSTS: 'false', LDAP_AUTH: 'True', DB_WAL_MODE: 'no' });
    expect(config.DEBUG).toBe(true);
    expect(config.ENABLE_HSTS).toBe(false);
    expect(config.LDAP_AUTH).toBe(true);
    expect(config.DB_WAL_MODE).toBe(false);
  });

  it('parses integers and falls back on invalid or zero values', () => {
    const config = load({ LDAP_PORT: '636', MAIL_SMTP_PORT: 'abc', DB_PORT: '5432', DB_TIMEOUT: '0', PORT: '3000' });
    expect(config.LDAP_PORT).toBe(636);
    expect(config.MAIL_SMTP_PORT).toBe(25);
    expect(config.DB_PORT).toBe(5432);
    expect(config.DB_TIMEOUT).toBeNull();
    expect(config.PORT).toBe(3000);
  });

  it('derives paths from DATA_DIR', () => {
    const config = load({ DATA_DIR: '/var/kb' });
    expect(config.FILES_DIR).toBe(path.join('/var/kb', 'files'));
    expect(config.CACHE_DIR).toBe(path.join('/var/kb', 'cache'));
    expect(config.DB_FILENAME).toBe(path.join('/var/kb', 'db.sqlite'));
    expect(config.LOG_FILE).toBe(path.join('/var/kb', 'debug.log'));
  });

  it('treats empty variables as unset', () => {
    expect(load({ DB_DRIVER: '', TOTP_ISSUER: '' }).DB_DRIVER).toBe('sqlite');
    expect(load({ TOTP_ISSUER: '' }).TOTP_ISSUER).toBe('Kanboard');
  });

  it('rejects invalid enum values', () => {
    expect(() => load({ DB_DRIVER: 'oracle' })).toThrow();
    expect(() => load({ LOG_DRIVER: 'carrier-pigeon' })).toThrow();
  });

  it('reads strings and nullable strings', () => {
    const config = load({ MAIL_SMTP_ENCRYPTION: 'tls', LDAP_SERVER: 'ldap.local', TRUSTED_PROXY_NETWORKS: '10.0.0.0/8' });
    expect(config.MAIL_SMTP_ENCRYPTION).toBe('tls');
    expect(config.LDAP_SERVER).toBe('ldap.local');
    expect(config.TRUSTED_PROXY_NETWORKS).toBe('10.0.0.0/8');
  });
});

describe('DATABASE_URL', () => {
  it('parses postgres urls', () => {
    expect(parseDatabaseUrl('postgres://bob:p%40ss@db.example:5433/kb')).toEqual({
      DB_DRIVER: 'postgres',
      DB_USERNAME: 'bob',
      DB_PASSWORD: 'p@ss',
      DB_HOSTNAME: 'db.example',
      DB_PORT: 5433,
      DB_NAME: 'kb',
    });
  });

  it('parses mysql and sqlite urls', () => {
    expect(parseDatabaseUrl('mysql://u@h/n').DB_DRIVER).toBe('mysql');
    expect(parseDatabaseUrl('sqlite:///tmp/x.sqlite')).toEqual({ DB_DRIVER: 'sqlite', DB_FILENAME: '/tmp/x.sqlite' });
  });

  it('rejects unsupported schemes', () => {
    expect(() => parseDatabaseUrl('oracle://x/y')).toThrow(/Unsupported/);
  });

  it('feeds loadConfig but explicit DB_* variables win', () => {
    const config = load({ DATABASE_URL: 'postgres://bob:pw@db:5432/kb', DB_NAME: 'override' });
    expect(config.DB_DRIVER).toBe('postgres');
    expect(config.DB_USERNAME).toBe('bob');
    expect(config.DB_HOSTNAME).toBe('db');
    expect(config.DB_PORT).toBe(5432);
    expect(config.DB_NAME).toBe('override');
    expect(config.DATABASE_URL).toBe('postgres://bob:pw@db:5432/kb');
  });
});
