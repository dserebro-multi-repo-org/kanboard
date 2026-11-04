import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from 'kysely';
import { createPool } from 'mysql2';
import pg from 'pg';
import type { AppConfig } from '../config/index.js';
import type { AnyDatabase, Connection, DbDriver } from './types.js';

/** The subset of the application configuration used to open a database connection. */
export type DatabaseConfig = Pick<AppConfig, 'DB_DRIVER'> &
  Partial<
    Pick<
      AppConfig,
      | 'DB_FILENAME'
      | 'DB_WAL_MODE'
      | 'DB_USERNAME'
      | 'DB_PASSWORD'
      | 'DB_HOSTNAME'
      | 'DB_NAME'
      | 'DB_PORT'
      | 'DB_SSL_KEY'
      | 'DB_SSL_CERT'
      | 'DB_SSL_CA'
      | 'DB_VERIFY_SERVER_CERT'
      | 'DB_TIMEOUT'
    >
  >;

function readFileOrUndefined(file: string | null | undefined): string | undefined {
  return file ? readFileSync(file, 'utf8') : undefined;
}

/** `DB_VERIFY_SERVER_CERT` is a free form string: anything but false/0/off/no verifies the certificate. */
function verifyServerCert(value: string | null | undefined): boolean {
  return value === null || value === undefined || !['false', '0', 'off', 'no', ''].includes(value.toLowerCase());
}

function createSqlite(config: DatabaseConfig): Connection {
  const filename = config.DB_FILENAME ?? ':memory:';

  if (filename !== ':memory:' && filename !== '' && !filename.startsWith('file:')) {
    mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  // Default timeout of 30 seconds to reduce "database is locked" errors (same as the PHP driver).
  const database = new BetterSqlite3(filename === '' ? ':memory:' : filename, { timeout: (config.DB_TIMEOUT ?? 30) * 1000 });

  // WAL mode should also reduce the "database is locked" errors (https://sqlite.org/wal.html).
  if (config.DB_WAL_MODE === true) {
    database.pragma('journal_mode = wal');
    database.pragma('wal_autocheckpoint = 0');
    database.pragma('synchronous = NORMAL');
  }

  database.pragma('foreign_keys = ON');

  return new Kysely<AnyDatabase>({ dialect: new SqliteDialect({ database }) });
}

function createMysql(config: DatabaseConfig): Connection {
  const useSsl = Boolean(config.DB_SSL_KEY || config.DB_SSL_CERT || config.DB_SSL_CA);

  const pool = createPool({
    host: config.DB_HOSTNAME,
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    port: config.DB_PORT ?? undefined,
    charset: 'utf8mb4',
    connectTimeout: config.DB_TIMEOUT ? config.DB_TIMEOUT * 1000 : undefined,
    supportBigNumbers: true,
    ssl: useSsl
      ? {
          key: readFileOrUndefined(config.DB_SSL_KEY),
          cert: readFileOrUndefined(config.DB_SSL_CERT),
          ca: readFileOrUndefined(config.DB_SSL_CA),
          rejectUnauthorized: verifyServerCert(config.DB_VERIFY_SERVER_CERT),
        }
      : undefined,
  });

  return new Kysely<AnyDatabase>({ dialect: new MysqlDialect({ pool: pool as unknown as ConstructorParameters<typeof MysqlDialect>[0]['pool'] }) });
}

function createPostgres(config: DatabaseConfig): Connection {
  const pool = new pg.Pool({
    host: config.DB_HOSTNAME || undefined,
    user: config.DB_USERNAME || undefined,
    password: config.DB_PASSWORD || undefined,
    database: config.DB_NAME,
    port: config.DB_PORT ?? undefined,
    connectionTimeoutMillis: config.DB_TIMEOUT ? config.DB_TIMEOUT * 1000 : undefined,
    ssl: config.DB_SSL_CA ? { ca: readFileOrUndefined(config.DB_SSL_CA), rejectUnauthorized: verifyServerCert(config.DB_VERIFY_SERVER_CERT) } : undefined,
    // COUNT(*) and bigint columns are returned as strings by default; the PHP driver returned numbers.
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
        oid === pg.types.builtins.INT8 ? (value: string) => Number(value) : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser,
    },
  });

  return new Kysely<AnyDatabase>({ dialect: new PostgresDialect({ pool }) });
}

/** Create the raw Kysely instance of a driver (better-sqlite3, mysql2 or pg). */
export function createConnection(config: DatabaseConfig): Connection {
  const driver: DbDriver = config.DB_DRIVER;

  switch (driver) {
    case 'sqlite':
      return createSqlite(config);
    case 'mysql':
      return createMysql(config);
    case 'postgres':
      return createPostgres(config);
    default:
      throw new Error('Database driver not supported');
  }
}
