import { ConditionBuilder } from './condition-builder.js';
import type { Database } from './database.js';
import type { DbRow, ExecResult, SortDirection, SqlValue } from './types.js';

/** Callback altering the result set of `findAll()` (PicoDb `callback()`). */
export type ResultCallback<R extends object> = (rows: R[]) => R[] | Promise<R[]>;

/** First value of a row (PDO `FETCH_COLUMN, 0`). */
function firstValue(row: DbRow): unknown {
  const values = Object.values(row);
  return values.length > 0 ? values[0] : null;
}

/**
 * Fluent, asynchronous query helper, a port of `PicoDb\Table`.
 *
 * Conditions, joins, ordering... are chained synchronously; the methods that hit the database
 * (`findAll`, `insert`, `update`, `count`...) return promises.
 *
 * ```ts
 * const tasks = await db.table<TaskRow>('tasks').eq('project_id', 1).in('column_id', [1, 2]).desc('id').limit(10).findAll();
 * ```
 *
 * Like PicoDb, `insert`/`update`/`save` resolve to `false` (instead of rejecting) when the database
 * reports a constraint violation, any other SQL error rejects with a `SqlException`.
 */
export class Table<R extends object = DbRow> {
  protected conditionBuilder: ConditionBuilder;
  protected columnList: string[] = [];
  protected sumColumns = new Map<string, SqlValue>();
  protected sqlSelect = '';
  protected sqlOrder = '';
  protected limitValue: number | null = null;
  protected offsetValue = 0;
  protected joins: string[] = [];
  protected isDistinct = false;
  protected groupByColumns: string[] = [];
  protected resultCallback: ResultCallback<R> | null = null;

  constructor(
    protected readonly db: Database,
    protected readonly name: string,
  ) {
    this.conditionBuilder = new ConditionBuilder(db);
  }

  /** Table name. */
  getName(): string {
    return this.name;
  }

  getConditionBuilder(): ConditionBuilder {
    return this.conditionBuilder;
  }

  /** Copy of the query, the condition state is not shared. */
  clone(): Table<R> {
    const copy = Object.create(Object.getPrototypeOf(this) as object) as Table<R>;
    Object.assign(copy, this);
    copy.conditionBuilder = this.conditionBuilder.clone();
    copy.columnList = [...this.columnList];
    copy.sumColumns = new Map(this.sumColumns);
    copy.joins = [...this.joins];
    copy.groupByColumns = [...this.groupByColumns];
    return copy;
  }

  // ------------------------------------------------------------------ conditions

  /** Add a raw SQL condition; use `?` placeholders for `values`. */
  addCondition(sql: string, ...values: SqlValue[]): this {
    this.conditionBuilder.addCondition(sql, ...values);
    return this;
  }

  beginOr(): this {
    this.conditionBuilder.beginOr();
    return this;
  }

  closeOr(): this {
    this.conditionBuilder.closeOr();
    return this;
  }

  /** Group the conditions added by `callback` with OR: `beginOr(); callback(this); closeOr();`. */
  or(callback: (table: this) => void): this {
    this.beginOr();
    callback(this);
    return this.closeOr();
  }

  /** `column = value`. An array value is turned into `column IN (...)` (an empty array matches nothing). */
  eq(column: string, value: SqlValue | readonly SqlValue[]): this {
    this.conditionBuilder.eq(column, value);
    return this;
  }

  /** `column != value`. An array value is turned into `column NOT IN (...)`. */
  neq(column: string, value: SqlValue | readonly SqlValue[]): this {
    this.conditionBuilder.neq(column, value);
    return this;
  }

  /** `column IN (...)`; an empty list adds no condition (PicoDb behaviour). */
  in(column: string, values: readonly SqlValue[]): this {
    this.conditionBuilder.in(column, values);
    return this;
  }

  notIn(column: string, values: readonly SqlValue[]): this {
    this.conditionBuilder.notIn(column, values);
    return this;
  }

  inSubquery(column: string, subquery: Table): this {
    this.conditionBuilder.inSubquery(column, subquery);
    return this;
  }

  notInSubquery(column: string, subquery: Table): this {
    this.conditionBuilder.notInSubquery(column, subquery);
    return this;
  }

  /** Case sensitive `LIKE` (`LIKE BINARY` on MySQL). */
  like(column: string, value: SqlValue): this {
    this.conditionBuilder.like(column, value);
    return this;
  }

  /** Case insensitive `LIKE` (`ILIKE` on PostgreSQL). */
  ilike(column: string, value: SqlValue): this {
    this.conditionBuilder.ilike(column, value);
    return this;
  }

  gt(column: string, value: SqlValue): this {
    this.conditionBuilder.gt(column, value);
    return this;
  }

  gtSubquery(column: string, subquery: Table): this {
    this.conditionBuilder.gtSubquery(column, subquery);
    return this;
  }

  lt(column: string, value: SqlValue): this {
    this.conditionBuilder.lt(column, value);
    return this;
  }

  ltSubquery(column: string, subquery: Table): this {
    this.conditionBuilder.ltSubquery(column, subquery);
    return this;
  }

  gte(column: string, value: SqlValue): this {
    this.conditionBuilder.gte(column, value);
    return this;
  }

  gteSubquery(column: string, subquery: Table): this {
    this.conditionBuilder.gteSubquery(column, subquery);
    return this;
  }

  lte(column: string, value: SqlValue): this {
    this.conditionBuilder.lte(column, value);
    return this;
  }

  lteSubquery(column: string, subquery: Table): this {
    this.conditionBuilder.lteSubquery(column, subquery);
    return this;
  }

  isNull(column: string): this {
    this.conditionBuilder.isNull(column);
    return this;
  }

  notNull(column: string): this {
    this.conditionBuilder.notNull(column);
    return this;
  }

  // ------------------------------------------------------------------ query shape

  /**
   * Left join: `LEFT JOIN table ON table.foreignColumn = localTable.localColumn`
   * (`localTable` defaults to this table, `alias` renames the joined table).
   */
  join(table: string, foreignColumn: string, localColumn: string, localTable = '', alias = ''): this {
    const e = (v: string, t = ''): string => this.db.escapeIdentifier(v, t);
    this.joins.push(
      `LEFT JOIN ${e(table)}${alias ? ` AS ${e(alias)}` : ''} ON ${e(alias || table)}.${e(foreignColumn)}=${e(localTable || this.name)}.${e(localColumn)}`,
    );
    return this;
  }

  /** `LEFT JOIN table1 AS alias1 ON alias1.column1 = table2.column2` */
  left(table1: string, alias1: string, column1: string, table2: string, column2: string): this {
    return this.aliasJoin('LEFT JOIN', table1, alias1, column1, table2, column2);
  }

  /** `JOIN table1 AS alias1 ON alias1.column1 = table2.column2` */
  inner(table1: string, alias1: string, column1: string, table2: string, column2: string): this {
    return this.aliasJoin('JOIN', table1, alias1, column1, table2, column2);
  }

  private aliasJoin(type: string, table1: string, alias1: string, column1: string, table2: string, column2: string): this {
    const e = (v: string): string => this.db.escapeIdentifier(v);
    this.joins.push(`${type} ${e(table1)} AS ${e(alias1)} ON ${e(alias1)}.${e(column1)}=${e(table2)}.${e(column2)}`);
    return this;
  }

  /** Append an ORDER BY term. */
  orderBy(column: string, order: SortDirection | Lowercase<SortDirection> = 'ASC'): this {
    const direction = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const term = `${this.db.escapeIdentifier(column)} ${direction}`;
    this.sqlOrder = this.sqlOrder === '' ? ` ORDER BY ${term}` : `${this.sqlOrder}, ${term}`;
    return this;
  }

  asc(column: string): this {
    return this.orderBy(column, 'ASC');
  }

  desc(column: string): this {
    return this.orderBy(column, 'DESC');
  }

  /** `LIMIT value`; `null`/`undefined` removes the limit. */
  limit(value: number | null | undefined): this {
    if (value !== null && value !== undefined) {
      this.limitValue = Math.trunc(value);
    }
    return this;
  }

  /** `OFFSET value` (ignored unless it is a positive integer). */
  offset(value: number | null | undefined): this {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      this.offsetValue = value;
    }
    return this;
  }

  groupBy(...columns: string[]): this {
    this.groupByColumns = columns;
    return this;
  }

  /** Custom SELECT expression list (not escaped). */
  select(select: string): this {
    this.sqlSelect = select;
    return this;
  }

  /** Columns of the SELECT, qualified with the table name. */
  columns(...columns: string[]): this {
    this.columnList = columns;
    return this;
  }

  /** `SELECT DISTINCT column, ...` */
  distinct(...columns: string[]): this {
    this.columnList = columns;
    this.isDistinct = true;
    return this;
  }

  /** Add a sub query column: `(sql) AS alias`. */
  subquery(sql: string, alias: string): this {
    this.columnList.push(`(${sql}) AS ${this.db.escapeIdentifier(alias)}`);
    return this;
  }

  /** `UPDATE ... SET column = column + value` applied by `update()`. */
  sumColumn(column: string, value: SqlValue): this {
    this.sumColumns.set(column, value);
    return this;
  }

  /** Alter the result set of `findAll()`. */
  callback(callback: ResultCallback<R> | null): this {
    this.resultCallback = callback;
    return this;
  }

  // ------------------------------------------------------------------ SQL generation

  private tail(): string {
    let sql = '';
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    } else if (this.offsetValue > 0 && this.db.getDriver().unboundedLimit !== '') {
      sql += ` ${this.db.getDriver().unboundedLimit}`;
    }
    if (this.offsetValue > 0) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    return sql;
  }

  private from(): string {
    return `FROM ${this.db.escapeIdentifier(this.name)}${this.joins.length > 0 ? ` ${this.joins.join(' ')}` : ''}${this.conditionBuilder.build()}`;
  }

  /** Build the SELECT statement (placeholders are `?`, values come from `getConditionBuilder()`). */
  buildSelectQuery(): string {
    let select = this.sqlSelect;

    if (select === '') {
      const columns = this.columnList.map((column) => this.db.escapeIdentifier(column, this.name));
      select = (this.isDistinct ? 'DISTINCT ' : '') + (columns.length === 0 ? '*' : columns.join(', '));
    }

    const groupBy = this.groupByColumns.map((column) => this.db.escapeIdentifier(column));

    return `SELECT ${select} ${this.from()}${groupBy.length > 0 ? ` GROUP BY ${groupBy.join(', ')}` : ''}${this.sqlOrder}${this.tail()}`.trim();
  }

  private async fetch(sql: string): Promise<DbRow[]> {
    const result = await this.db.execute(sql, this.conditionBuilder.getValues());
    return result === false ? [] : result.rows;
  }

  private async aggregate(expression: string): Promise<unknown> {
    const rows = await this.fetch(`SELECT ${expression} ${this.from()}${this.tail()}`);
    return rows.length > 0 ? firstValue(rows[0] as DbRow) : null;
  }

  // ------------------------------------------------------------------ reading

  /** Fetch all rows. */
  async findAll(): Promise<R[]> {
    const rows = (await this.fetch(this.buildSelectQuery())) as R[];
    return this.resultCallback !== null && rows.length > 0 ? this.resultCallback(rows) : rows;
  }

  /** Fetch the values of one column. */
  async findAllByColumn<T = unknown>(column: string): Promise<T[]> {
    this.columnList = [column];
    const rows = await this.fetch(this.buildSelectQuery());
    return rows.map((row) => firstValue(row) as T);
  }

  /** Fetch the first row or `null`. */
  async findOne(): Promise<R | null> {
    this.limit(1);
    const rows = await this.findAll();
    return rows[0] ?? null;
  }

  /** Fetch one column of the first row, `null` when there is no row. */
  async findOneColumn<T = unknown>(column: string): Promise<T | null> {
    this.limit(1);
    this.columnList = [column];
    const rows = await this.fetch(this.buildSelectQuery());
    return rows.length > 0 ? (firstValue(rows[0] as DbRow) as T) : null;
  }

  /** Whether at least one row matches. */
  async exists(): Promise<boolean> {
    return (await this.fetch(`SELECT 1 ${this.from()} LIMIT 1`)).length > 0;
  }

  async count(): Promise<number> {
    return Number(await this.aggregate('COUNT(*)')) || 0;
  }

  async sum(column: string): Promise<number> {
    return Number(await this.aggregate(`SUM(${this.db.escapeIdentifier(column)})`)) || 0;
  }

  async avg(column: string): Promise<number> {
    return Number(await this.aggregate(`AVG(${this.db.escapeIdentifier(column)})`)) || 0;
  }

  /** Smallest value of a column, `null` when there is no row. */
  async min<T = unknown>(column: string): Promise<T | null> {
    return (await this.aggregate(`MIN(${this.db.escapeIdentifier(column)})`)) as T | null;
  }

  /** Greatest value of a column, `null` when there is no row. */
  async max<T = unknown>(column: string): Promise<T | null> {
    return (await this.aggregate(`MAX(${this.db.escapeIdentifier(column)})`)) as T | null;
  }

  // ------------------------------------------------------------------ writing

  /** Update when there are conditions, insert otherwise. */
  save(data: Partial<R> | DbRow): Promise<boolean> {
    return this.conditionBuilder.hasCondition() ? this.update(data) : this.insert(data);
  }

  /** `UPDATE table SET ... WHERE ...`; `false` on constraint violation. */
  async update(data: Partial<R> | DbRow = {}): Promise<boolean> {
    const e = (v: string): string => this.db.escapeIdentifier(v);
    const sets = [
      ...Object.keys(data).map((column) => `${e(column)}=?`),
      ...[...this.sumColumns.keys()].map((column) => `${e(column)}=${e(column)} + ?`),
    ];
    const values = [...Object.values(data), ...this.sumColumns.values(), ...this.conditionBuilder.getValues()] as SqlValue[];
    const sql = `UPDATE ${e(this.name)} SET ${sets.join(', ')}${this.conditionBuilder.build()}`;

    return (await this.db.execute(sql, values)) !== false;
  }

  private buildInsert(data: Partial<R> | DbRow): { sql: string; values: SqlValue[] } {
    const columns = Object.keys(data);
    const table = this.db.escapeIdentifier(this.name);

    if (columns.length === 0) {
      return { sql: this.db.getDriver().insertDefaultValues(table), values: [] };
    }

    return {
      sql: `INSERT INTO ${table} (${columns.map((c) => this.db.escapeIdentifier(c)).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values: Object.values(data) as SqlValue[],
    };
  }

  /** `INSERT`; `false` on constraint violation. */
  async insert(data: Partial<R> | DbRow): Promise<boolean> {
    const { sql, values } = this.buildInsert(data);
    return (await this.db.execute(sql, values)) !== false;
  }

  /**
   * Insert a row and return the generated primary key (`false` on constraint violation).
   * `idColumn` is only used by PostgreSQL (`RETURNING`).
   */
  async insertAndGetId(data: Partial<R> | DbRow, idColumn = 'id'): Promise<number | false> {
    const { sql, values } = this.buildInsert(data);
    const driver = this.db.getDriver();
    const result: ExecResult | false = await this.db.execute(driver.supportsReturning ? `${sql} RETURNING ${this.db.escapeIdentifier(idColumn)}` : sql, values);

    if (result === false) {
      return false;
    }

    if (driver.supportsReturning) {
      const id = result.rows[0] === undefined ? 0 : Number(firstValue(result.rows[0]));
      this.db.setLastId(id);
      return id;
    }

    return result.insertId ?? (await this.db.getLastId());
  }

  /** Alias of {@link insertAndGetId} (PicoDb `persist()`). */
  persist(data: Partial<R> | DbRow, idColumn = 'id'): Promise<number | false> {
    return this.insertAndGetId(data, idColumn);
  }

  /** `DELETE FROM table WHERE ...`; true when at least one row was removed. */
  async remove(): Promise<boolean> {
    const result = await this.db.execute(`DELETE FROM ${this.db.escapeIdentifier(this.name)}${this.conditionBuilder.build()}`, this.conditionBuilder.getValues());
    return result !== false && result.rowCount > 0;
  }

  private async shift(column: string, operator: '+' | '-', value: number): Promise<boolean> {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Invalid increment value: ${String(value)}`);
    }

    const c = this.db.escapeIdentifier(column);
    const sql = `UPDATE ${this.db.escapeIdentifier(this.name)} SET ${c}=${c}${operator}?${this.conditionBuilder.build()}`;
    return (await this.db.execute(sql, [value, ...this.conditionBuilder.getValues()])) !== false;
  }

  increment(column: string, value: number): Promise<boolean> {
    return this.shift(column, '+', value);
  }

  decrement(column: string, value: number): Promise<boolean> {
    return this.shift(column, '-', value);
  }
}
