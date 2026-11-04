import type { DbDriver } from './types.js';

export type LikeOperator = 'LIKE' | 'ILIKE';

/**
 * Everything that differs between database engines (port of the `PicoDb\Driver\*` classes).
 * The query builders only talk to this interface, so adding a new engine means adding an
 * implementation here, plus its Kysely dialect in `connection.ts` and a schema in `schema/`.
 */
export interface SqlDialect {
  readonly name: DbDriver;
  /** Quote one identifier (no validation). */
  escape(identifier: string): string;
  /** Operator used for `like()` (case sensitive) and `ilike()` (case insensitive). */
  getOperator(operator: LikeOperator): string;
  /** Whether the error is a constraint violation that must be reported as `false` instead of thrown. */
  isDuplicateKeyError(error: unknown): boolean;
  /** Rewrite the `?` placeholders into the native parameter syntax. */
  bind(sql: string): string;
  /** Whether `INSERT ... RETURNING` is used to fetch the generated primary key. */
  readonly supportsReturning: boolean;
  /** Statement used to build `DEFAULT VALUES` inserts. */
  insertDefaultValues(table: string): string;
  /** LIMIT clause to emit when only an OFFSET was requested. */
  readonly unboundedLimit: string;
  /** SQL toggling the foreign key checks, or null when not needed. */
  readonly disableForeignKeysSql: string | null;
  readonly enableForeignKeysSql: string | null;
  /** Build the multi-row "insert or replace" statement of a key/value table (`Hashtable.put`). */
  upsert(table: string, keyColumn: string, valueColumn: string, count: number): string;
}

function errorCode(error: unknown): string | number | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as { code?: unknown; errno?: unknown };
    if (typeof e.code === 'string' || typeof e.code === 'number') return e.code;
    if (typeof e.errno === 'number') return e.errno;
  }
  return undefined;
}

export { errorCode };

const sqliteDialect: SqlDialect = {
  name: 'sqlite',
  escape: (identifier) => `"${identifier}"`,
  getOperator: () => 'LIKE',
  // PDO reports every integrity constraint violation (23000) as a duplicate key error.
  isDuplicateKeyError: (error) => String(errorCode(error) ?? '').startsWith('SQLITE_CONSTRAINT'),
  bind: (sql) => sql,
  supportsReturning: false,
  insertDefaultValues: (table) => `INSERT INTO ${table} DEFAULT VALUES`,
  unboundedLimit: 'LIMIT -1',
  disableForeignKeysSql: 'PRAGMA foreign_keys = OFF',
  enableForeignKeysSql: 'PRAGMA foreign_keys = ON',
  upsert: (table, keyColumn, valueColumn, count) =>
    `INSERT OR REPLACE INTO "${table}" ("${keyColumn}", "${valueColumn}") VALUES ${Array(count).fill('(?, ?)').join(', ')}`,
};

const mysqlDialect: SqlDialect = {
  name: 'mysql',
  escape: (identifier) => `\`${identifier}\``,
  getOperator: (operator) => (operator === 'LIKE' ? 'LIKE BINARY' : 'LIKE'),
  isDuplicateKeyError: (error) => {
    const code = errorCode(error);
    // ER_DUP_ENTRY, ER_NO_REFERENCED_ROW(_2), ER_ROW_IS_REFERENCED(_2)
    return code === 'ER_DUP_ENTRY' || code === 1062 || code === 'ER_NO_REFERENCED_ROW_2' || code === 1452 || code === 'ER_ROW_IS_REFERENCED_2' || code === 1451;
  },
  bind: (sql) => sql,
  supportsReturning: false,
  insertDefaultValues: (table) => `INSERT INTO ${table} () VALUES ()`,
  unboundedLimit: 'LIMIT 18446744073709551615',
  disableForeignKeysSql: 'SET FOREIGN_KEY_CHECKS = 0',
  enableForeignKeysSql: 'SET FOREIGN_KEY_CHECKS = 1',
  upsert: (table, keyColumn, valueColumn, count) =>
    `REPLACE INTO \`${table}\` (\`${keyColumn}\`, \`${valueColumn}\`) VALUES ${Array(count).fill('(?, ?)').join(', ')}`,
};

const postgresDialect: SqlDialect = {
  name: 'postgres',
  escape: (identifier) => `"${identifier}"`,
  getOperator: (operator) => (operator === 'LIKE' ? 'LIKE' : 'ILIKE'),
  // 23505 unique_violation, 23503 foreign_key_violation
  isDuplicateKeyError: (error) => {
    const code = errorCode(error);
    return code === '23505' || code === '23503';
  },
  bind: (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  },
  supportsReturning: true,
  insertDefaultValues: (table) => `INSERT INTO ${table} DEFAULT VALUES`,
  unboundedLimit: '',
  disableForeignKeysSql: null,
  enableForeignKeysSql: null,
  upsert: (table, keyColumn, valueColumn, count) =>
    `INSERT INTO "${table}" ("${keyColumn}", "${valueColumn}") VALUES ${Array(count).fill('(?, ?)').join(', ')} ` +
    `ON CONFLICT ("${keyColumn}") DO UPDATE SET "${valueColumn}" = EXCLUDED."${valueColumn}"`,
};

const dialects: Record<DbDriver, SqlDialect> = { sqlite: sqliteDialect, mysql: mysqlDialect, postgres: postgresDialect };

/** Return the dialect implementation of a driver. */
export function getDialect(driver: DbDriver): SqlDialect {
  return dialects[driver];
}
