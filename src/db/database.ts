import { CompiledQuery } from 'kysely';
import { createConnection, type DatabaseConfig } from './connection.js';
import { getDialect, type SqlDialect } from './dialect.js';
import { Hashtable } from './hashtable.js';
import { Table } from './table.js';
import { SqlException, type Connection, type DbDriver, type DbRow, type ExecResult, type SqlValue } from './types.js';

/** One executed statement, reported to the logger installed with {@link Database.withLogging}. */
export interface QueryLogEntry {
  sql: string;
  params: readonly unknown[];
  durationMs: number;
}

/**
 * Result of {@link Database.transaction}: the callback result (`true` when it returns nothing),
 * or `false` when the transaction was rolled back because of a constraint violation.
 */
export type TransactionResult<T> = [T] extends [void | undefined] ? boolean : T | false;

/** Thrown inside the Kysely transaction callback to force a rollback without raising an error. */
class RollbackSignal extends Error {}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** State shared by a database and the transaction scoped databases derived from it. */
interface SharedState {
  nbQueries: number;
  lastInsertId: number | null;
  logger: ((entry: QueryLogEntry) => void) | null;
  /** Transaction opened by `startTransaction()`; all queries of the root database go through it. */
  manual: { connection: Connection; finish: Deferred<boolean>; done: Promise<void> } | null;
}

function normalize(value: unknown, driver: DbDriver): Exclude<SqlValue, boolean | undefined> {
  if (typeof value === 'boolean') value = value ? 1 : 0;
  // better-sqlite3 binds JS numbers as REAL, which would be stored as '5.0' in TEXT columns (PDO bound strings).
  if (driver === 'sqlite' && typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (value === undefined || value === null) return null;
  return value as Exclude<SqlValue, boolean | undefined>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Database wrapper, a port of `PicoDb\Database` on top of Kysely.
 *
 * - {@link getConnection} returns the raw Kysely instance (the active transaction inside one);
 * - {@link table} / {@link hashtable} give the PicoDb-like fluent query helpers;
 * - everything is asynchronous because pg and mysql2 are.
 *
 * Within `db.transaction(async (tx) => ...)` use the `tx` database: it is bound to the
 * transaction connection. The `startTransaction()` / `closeTransaction()` / `cancelTransaction()`
 * trio of PicoDb is available too, but it pins ALL queries made through this instance to the
 * transaction until it is closed, so prefer the callback form in concurrent code.
 */
export class Database {
  private readonly dialect: SqlDialect;

  /**
   * @param connection  Kysely instance
   * @param driver      SQL flavour of the connection
   * @param scope       internal: state of a transaction scoped child
   */
  constructor(
    private readonly connection: Connection,
    driver: DbDriver,
    private readonly scope: { shared: SharedState; transaction: Connection | null; state: { rollbackOnly: boolean } | null } = {
      shared: { nbQueries: 0, lastInsertId: null, logger: null, manual: null },
      transaction: null,
      state: null,
    },
  ) {
    this.dialect = getDialect(driver);
  }

  /** Open the connection described by the application configuration (`DB_DRIVER`, `DB_FILENAME`, ...). */
  static connect(config: DatabaseConfig): Database {
    return new Database(createConnection(config), config.DB_DRIVER);
  }

  // ------------------------------------------------------------------ accessors

  /** The raw Kysely connection (the current `Transaction` when inside a transaction). */
  getConnection(): Connection {
    return this.executor();
  }

  /** Driver specific behaviour. */
  getDriver(): SqlDialect {
    return this.dialect;
  }

  /** Name of the driver (`sqlite`, `mysql` or `postgres`). */
  get driver(): DbDriver {
    return this.dialect.name;
  }

  /** Whether the instance is currently running inside a transaction. */
  inTransaction(): boolean {
    return this.scope.transaction !== null || this.scope.shared.manual !== null;
  }

  /** Number of statements executed since the connection was opened. */
  getNbQueries(): number {
    return this.scope.shared.nbQueries;
  }

  /** Install (or remove with `null`) a callback receiving every executed statement. */
  withLogging(logger: ((entry: QueryLogEntry) => void) | null): this {
    this.scope.shared.logger = logger;
    return this;
  }

  private executor(): Connection {
    return this.scope.transaction ?? this.scope.shared.manual?.connection ?? this.connection;
  }

  // ------------------------------------------------------------------ identifiers

  /** Only lower case letters, digits and underscores are valid identifiers. */
  isValidIdentifier(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }

  /**
   * Quote an identifier for the current dialect, optionally qualified with a table.
   * Values containing a dot or a space are custom SQL and returned untouched.
   * @throws SqlException on invalid identifiers (SQL injection protection)
   */
  escapeIdentifier(value: string, table = ''): string {
    if (value.includes('.') || value.includes(' ')) {
      return value;
    }

    if (!this.isValidIdentifier(value)) {
      throw new SqlException(`Invalid identifier: ${value}`);
    }

    if (table !== '') {
      if (!this.isValidIdentifier(table)) {
        throw new SqlException(`Invalid identifier: ${table}`);
      }

      return `${this.dialect.escape(table)}.${this.dialect.escape(value)}`;
    }

    return this.dialect.escape(value);
  }

  escapeIdentifierList(identifiers: readonly string[], table = ''): string[] {
    return identifiers.map((identifier) => this.escapeIdentifier(identifier, table));
  }

  // ------------------------------------------------------------------ query helpers

  /** Fluent query helper on a table. */
  table<R extends object = DbRow>(name: string): Table<R> {
    return new Table<R>(this, name);
  }

  /** Key/value helper on a table. */
  hashtable(name: string): Hashtable {
    return new Hashtable(this, name);
  }

  // ------------------------------------------------------------------ execution

  private async run(sql: string, values: readonly unknown[]): Promise<ExecResult> {
    const shared = this.scope.shared;
    const started = performance.now();

    try {
      const result = await this.executor().executeQuery<DbRow>(CompiledQuery.raw(this.dialect.bind(sql), values.map((v) => normalize(v, this.driver))));
      const insertId = result.insertId === undefined ? null : Number(result.insertId);

      if (insertId !== null && insertId > 0 && /^\s*(INSERT|REPLACE)\b/i.test(sql)) {
        shared.lastInsertId = insertId;
      }

      return { rows: [...result.rows], rowCount: Number(result.numAffectedRows ?? 0), insertId };
    } finally {
      shared.nbQueries++;
      shared.logger?.({ sql, params: values, durationMs: performance.now() - started });
    }
  }

  /**
   * Execute a statement with `?` placeholders.
   * Resolves to `false` when the database reports a constraint violation (PicoDb behaviour, the
   * current transaction is cancelled), rejects with a {@link SqlException} on any other error.
   */
  async execute(sql: string, values: readonly unknown[] = []): Promise<ExecResult | false> {
    try {
      return await this.run(sql, values);
    } catch (error) {
      return this.handleSqlError(error, sql);
    }
  }

  /**
   * Execute a statement and always throw on error (used by migrations and maintenance queries).
   * @throws SqlException
   */
  async exec(sql: string, values: readonly unknown[] = []): Promise<ExecResult> {
    try {
      return await this.run(sql, values);
    } catch (error) {
      throw this.toException(error, sql);
    }
  }

  private toException(error: unknown, sql: string): SqlException {
    if (error instanceof SqlException) return error;
    const code = (error as { code?: string | number } | null)?.code;
    return new SqlException(`SQL Error[${code ?? ''}]: ${errorMessage(error)}`, code, sql, { cause: error });
  }

  private async handleSqlError(error: unknown, sql: string): Promise<false> {
    await this.cancelTransaction();

    if (this.dialect.isDuplicateKeyError(error)) {
      return false;
    }

    throw this.toException(error, sql);
  }

  /** Record the id of the last inserted row (used by PostgreSQL `RETURNING`). */
  setLastId(id: number): void {
    this.scope.shared.lastInsertId = id;
  }

  /** Primary key generated by the last INSERT. */
  async getLastId(): Promise<number> {
    const recorded = this.scope.shared.lastInsertId;

    if (recorded !== null) {
      return recorded;
    }

    const sql = { sqlite: 'SELECT last_insert_rowid() AS id', mysql: 'SELECT LAST_INSERT_ID() AS id', postgres: 'SELECT LASTVAL() AS id' }[this.driver];

    try {
      const { rows } = await this.run(sql, []);
      return Number(rows[0]?.id ?? 0);
    } catch {
      return 0;
    }
  }

  // ------------------------------------------------------------------ transactions

  /**
   * Run `callback` in a transaction: committed when it resolves, rolled back when it throws.
   * Like PicoDb, a constraint violation reported by a statement of the callback rolls the
   * transaction back and the method resolves to `false`. Nested calls join the running transaction.
   */
  async transaction<T>(callback: (tx: Database) => Promise<T> | T): Promise<TransactionResult<T>> {
    const finish = (result: T): TransactionResult<T> => (result === undefined ? true : result) as TransactionResult<T>;

    if (this.inTransaction()) {
      const result = await callback(this);
      return this.scope.state?.rollbackOnly ? (false as TransactionResult<T>) : finish(result);
    }

    try {
      return await this.connection.transaction().execute(async (trx) => {
        const state = { rollbackOnly: false };
        const tx = new Database(this.connection, this.driver, { shared: this.scope.shared, transaction: trx as unknown as Connection, state });
        const result = await callback(tx);

        if (state.rollbackOnly) {
          throw new RollbackSignal();
        }

        return finish(result);
      });
    } catch (error) {
      if (error instanceof RollbackSignal) {
        return false as TransactionResult<T>;
      }
      throw error;
    }
  }

  /**
   * Begin a transaction if none is running. All queries made through this instance run in it
   * until {@link closeTransaction} (commit) or {@link cancelTransaction} (rollback).
   */
  async startTransaction(): Promise<void> {
    const shared = this.scope.shared;

    if (this.inTransaction()) {
      return;
    }

    const started = defer<Connection>();
    const finish = defer<boolean>();
    const done = this.connection
      .transaction()
      .execute(async (trx) => {
        started.resolve(trx as unknown as Connection);

        if (!(await finish.promise)) {
          throw new RollbackSignal();
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof RollbackSignal)) {
          started.reject(error);
          throw error;
        }
      });

    // Failing to open the transaction rejects `started`; a later commit failure rejects `done`.
    done.catch(() => undefined);
    shared.manual = { connection: await started.promise, finish, done };
  }

  /** Commit the transaction opened by {@link startTransaction}, if any. */
  async closeTransaction(): Promise<void> {
    await this.endManual(true);
  }

  /** Roll back the transaction opened by {@link startTransaction}, if any. */
  async cancelTransaction(): Promise<void> {
    await this.endManual(false);
  }

  private async endManual(commit: boolean): Promise<void> {
    const manual = this.scope.shared.manual;

    if (manual === null) {
      // Inside a callback transaction a failure cancels the whole transaction at its end.
      if (!commit && this.scope.state !== null) {
        this.scope.state.rollbackOnly = true;
      }
      return;
    }

    this.scope.shared.manual = null;
    manual.finish.resolve(commit);
    await manual.done;
  }

  // ------------------------------------------------------------------ foreign keys

  /**
   * Run `callback` with foreign key checks disabled on ONE pinned connection (the setting is per
   * session on MySQL/SQLite), re-enabling them on that same connection afterwards.
   * Inside an already open transaction the connection is already fixed, so the callback just joins it.
   */
  async withForeignKeysDisabled<T>(callback: (db: Database) => Promise<T>): Promise<T> {
    if (this.inTransaction()) {
      return callback(this);
    }

    return this.connection.connection().execute(async (conn) => {
      const pinned = new Database(conn as unknown as Connection, this.driver, {
        shared: this.scope.shared,
        transaction: null,
        state: null,
      });

      await pinned.disableForeignKeys();

      try {
        return await callback(pinned);
      } finally {
        await pinned.enableForeignKeys();
      }
    });
  }

  /** Acts on the current executor connection only; use {@link withForeignKeysDisabled} to pin one. */
  async disableForeignKeys(): Promise<void> {
    if (this.dialect.disableForeignKeysSql !== null) {
      await this.exec(this.dialect.disableForeignKeysSql);
    }
  }

  async enableForeignKeys(): Promise<void> {
    if (this.dialect.enableForeignKeysSql !== null) {
      await this.exec(this.dialect.enableForeignKeysSql);
    }
  }

  // ------------------------------------------------------------------ lifecycle

  /** Close all connections. The instance must not be used afterwards. */
  async close(): Promise<void> {
    await this.connection.destroy();
  }

  /** PicoDb name of {@link close}. */
  closeConnection(): Promise<void> {
    return this.close();
  }
}

/** Open the database described by the configuration. */
export function createDatabase(config: DatabaseConfig): Database {
  return Database.connect(config);
}
