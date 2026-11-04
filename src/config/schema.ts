import { z } from 'zod';

/**
 * Zod schema describing every configuration key of Kanboard.
 *
 * Keys keep the exact names of the PHP constants defined in
 * `config.default.php` / `app/constants.php` so that documentation, plugins and
 * environment variables map one-to-one.
 */
export const DB_DRIVERS = ['sqlite', 'mysql', 'postgres'] as const;
export const LOG_DRIVERS = ['syslog', 'stdout', 'stderr', 'system', 'file'] as const;
export const SESSION_HANDLERS = ['db', 'php'] as const;
export const LDAP_BIND_TYPES = ['anonymous', 'user', 'proxy'] as const;

const nullableString = z.string().nullable();

export const configSchema = z.object({
  // Server (Node runtime specific)
  ROOT_DIR: z.string(),
  HOST: z.string(),
  PORT: z.number().int().min(0).max(65535),

  // Directories
  DATA_DIR: z.string(),
  FILES_DIR: z.string(),
  CACHE_DIR: z.string(),
  PLUGINS_DIR: z.string(),

  // Plugins
  PLUGIN_API_URL: z.string(),
  PLUGIN_INSTALLER: z.boolean(),

  // Debug and logging
  DEBUG: z.boolean(),
  LOG_DRIVER: z.enum(LOG_DRIVERS),
  LOG_FILE: z.string(),

  // Application
  APP_VERSION: z.string(),
  DOCUMENTATION_URL_PATTERN: z.string(),

  // Database
  DATABASE_URL: nullableString,
  DB_RUN_MIGRATIONS: z.boolean(),
  DB_DRIVER: z.enum(DB_DRIVERS),
  DB_FILENAME: z.string(),
  DB_WAL_MODE: z.boolean(),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOSTNAME: z.string(),
  DB_NAME: z.string(),
  DB_PORT: z.number().int().nullable(),
  DB_ODBC_DSN: z.string(),
  DB_SSL_KEY: nullableString,
  DB_SSL_CERT: nullableString,
  DB_SSL_CA: nullableString,
  DB_VERIFY_SERVER_CERT: nullableString,
  DB_TIMEOUT: z.number().int().nullable(),
  DB_GROUP_PROVIDER: z.boolean(),
  DB_USER_PROVIDER: z.boolean(),

  // LDAP
  LDAP_AUTH: z.boolean(),
  LDAP_SERVER: z.string(),
  LDAP_PORT: z.number().int(),
  LDAP_SSL_VERIFY: z.boolean(),
  LDAP_START_TLS: z.boolean(),
  LDAP_USERNAME_CASE_SENSITIVE: z.boolean(),
  LDAP_BIND_TYPE: z.enum(LDAP_BIND_TYPES),
  LDAP_USERNAME: nullableString,
  LDAP_PASSWORD: nullableString,
  LDAP_USER_BASE_DN: z.string(),
  LDAP_USER_FILTER: z.string(),
  LDAP_USER_ATTRIBUTE_USERNAME: z.string(),
  LDAP_USER_ATTRIBUTE_FULLNAME: z.string(),
  LDAP_USER_ATTRIBUTE_EMAIL: z.string(),
  LDAP_USER_ATTRIBUTE_GROUPS: z.string(),
  LDAP_USER_ATTRIBUTE_PHOTO: z.string(),
  LDAP_USER_ATTRIBUTE_LANGUAGE: z.string(),
  LDAP_USER_CREATION: z.boolean(),
  LDAP_USER_DEFAULT_ROLE_MANAGER: z.boolean(),
  LDAP_GROUP_ADMIN_DN: z.string(),
  LDAP_GROUP_MANAGER_DN: z.string(),
  LDAP_GROUP_PROVIDER: z.boolean(),
  LDAP_GROUP_BASE_DN: z.string(),
  LDAP_GROUP_FILTER: z.string(),
  LDAP_GROUP_USER_FILTER: z.string(),
  LDAP_GROUP_USER_ATTRIBUTE: z.string(),
  LDAP_GROUP_ATTRIBUTE_NAME: z.string(),
  LDAP_GROUP_SYNC: z.boolean(),

  // Reverse proxy authentication
  REVERSE_PROXY_AUTH: z.boolean(),
  REVERSE_PROXY_USER_HEADER: z.string(),
  REVERSE_PROXY_EMAIL_HEADER: z.string(),
  REVERSE_PROXY_FULLNAME_HEADER: z.string(),
  REVERSE_PROXY_DEFAULT_ADMIN: z.string(),
  REVERSE_PROXY_DEFAULT_DOMAIN: z.string(),

  // Authentication / session
  REMEMBER_ME_AUTH: z.boolean(),
  HIDE_LOGIN_FORM: z.boolean(),
  DISABLE_LOGOUT: z.boolean(),
  BRUTEFORCE_CAPTCHA: z.number().int(),
  BRUTEFORCE_LOCKDOWN: z.number().int(),
  BRUTEFORCE_LOCKDOWN_DURATION: z.number().int(),
  SESSION_DURATION: z.number().int(),
  SESSION_HANDLER: z.enum(SESSION_HANDLERS),
  TOTP_ISSUER: z.string(),
  EXTERNAL_AUTH_EXCLUDE_FIELDS: z.string(),
  API_AUTHENTICATION_HEADER: z.string(),
  API_AUTHENTICATION_TOKEN: nullableString,

  // Mail
  MAIL_CONFIGURATION: z.boolean(),
  MAIL_FROM: z.string(),
  MAIL_BCC: z.string(),
  MAIL_TRANSPORT: z.string(),
  MAIL_SMTP_HOSTNAME: z.string(),
  MAIL_SMTP_PORT: z.number().int(),
  MAIL_SMTP_USERNAME: z.string(),
  MAIL_SMTP_PASSWORD: z.string(),
  MAIL_SMTP_HELO_NAME: nullableString,
  MAIL_SMTP_ENCRYPTION: nullableString,
  MAIL_SENDMAIL_COMMAND: z.string(),

  // HTTP security headers and rendering
  ENABLE_HSTS: z.boolean(),
  ENABLE_XFRAME: z.boolean(),
  MARKDOWN_ESCAPE_HTML: z.boolean(),
  ENABLE_URL_REWRITE: z.boolean(),

  // HTTP client
  HTTP_TIMEOUT: z.number().int(),
  HTTP_MAX_REDIRECTS: z.number().int(),
  HTTP_PROXY_HOSTNAME: z.string(),
  HTTP_PROXY_PORT: z.string(),
  HTTP_PROXY_USERNAME: z.string(),
  HTTP_PROXY_PASSWORD: z.string(),
  HTTP_PROXY_EXCLUDE: z.string(),
  HTTP_VERIFY_SSL_CERTIFICATE: z.boolean(),

  // UI
  SHOW_GROUP_MEMBERSHIPS_IN_USERLIST: z.boolean(),
  SHOW_GROUP_MEMBERSHIPS_IN_USERLIST_WITH_LIMIT: z.number().int(),
  DASHBOARD_MAX_PROJECTS: z.number().int(),

  // Trusted proxies and SSRF protections
  TRUSTED_PROXY_HEADERS: z.string(),
  TRUSTED_PROXY_NETWORKS: z.string(),
  EXTERNAL_LINK_ALLOW_PRIVATE_NETWORKS: z.boolean(),
  WEBHOOK_ALLOW_PRIVATE_NETWORKS: z.boolean(),
});

export type AppConfig = Readonly<z.infer<typeof configSchema>>;
export type ConfigKey = keyof AppConfig;
