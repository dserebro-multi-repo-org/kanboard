import type { Kysely } from 'kysely';

/** Supported database drivers (same values as the `DB_DRIVER` configuration key). */
export type DbDriver = 'sqlite' | 'mysql' | 'postgres';

/**
 * A database row. Models narrow it with their own interface (`Table<TaskRow>`);
 * the query layer itself only knows about column names and loose values.
 */
export type DbRow = Record<string, unknown>;

/** A value that can be bound to a statement parameter. */
export type SqlValue = string | number | bigint | boolean | Date | Buffer | Uint8Array | null | undefined;

/**
 * Kysely database typing used by the wrapper: the table/column names are dynamic (PicoDb style),
 * so no compile-time schema is attached to the connection.
 */
export type AnyDatabase = Record<string, Record<string, unknown>>;

/** The raw Kysely instance exposed by `Database.getConnection()`. */
export type Connection = Kysely<AnyDatabase>;

/** Result of a statement executed through `Database.execute()` / `Database.exec()`. */
export interface ExecResult {
  /** Rows returned by the statement (empty for INSERT/UPDATE/DELETE/DDL). */
  rows: DbRow[];
  /** Number of rows affected by an INSERT/UPDATE/DELETE (0 for SELECT). */
  rowCount: number;
  /** Auto generated primary key of the last inserted row, when the driver reports it. */
  insertId: number | null;
}

/** Sort direction accepted by `Table.orderBy()`. */
export type SortDirection = 'ASC' | 'DESC';

/** Error thrown for any SQL failure that is not a constraint violation (PicoDb `SQLException`). */
export class SqlException extends Error {
  constructor(
    message: string,
    readonly code?: string | number,
    readonly sql?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SqlException';
  }
}
