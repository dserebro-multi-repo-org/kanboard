import type { Database } from './database.js';
import type { Table } from './table.js';
import type { SqlValue } from './types.js';

/**
 * Builds the WHERE clause and its positional parameters (port of `PicoDb\Builder\ConditionBuilder`
 * and `OrConditionBuilder`). Conditions are joined with AND, `beginOr()`/`closeOr()` groups with OR.
 */
export class ConditionBuilder {
  private values: SqlValue[] = [];
  private conditions: string[] = [];
  /** Stack of open OR groups, the last one receives the new conditions. */
  private orGroups: string[][] = [];

  constructor(private readonly db: Database) {}

  /** `WHERE ...` clause (with a leading space) or an empty string. */
  build(): string {
    return this.conditions.length === 0 ? '' : ` WHERE ${this.conditions.join(' AND ')}`;
  }

  getValues(): SqlValue[] {
    return [...this.values];
  }

  hasCondition(): boolean {
    return this.conditions.length > 0;
  }

  /** Add a raw SQL condition with its bound values (`?` placeholders). */
  addCondition(sql: string, ...values: SqlValue[]): void {
    const group = this.orGroups[this.orGroups.length - 1];

    if (group !== undefined) {
      group.push(sql);
    } else {
      this.conditions.push(sql);
    }

    this.values.push(...values);
  }

  beginOr(): void {
    this.orGroups.push([]);
  }

  closeOr(): void {
    const group = this.orGroups.pop();

    if (group === undefined) {
      throw new Error('closeOr() called without a matching beginOr()');
    }

    // An empty group (e.g. `in()` with no values) adds nothing, like an empty OR in PicoDb would.
    if (group.length === 0) {
      return;
    }

    const condition = `(${group.join(' OR ')})`;
    const parent = this.orGroups[this.orGroups.length - 1];

    if (parent !== undefined) {
      parent.push(condition);
    } else {
      this.conditions.push(condition);
    }
  }

  private column(column: string): string {
    return this.db.escapeIdentifier(column);
  }

  private compare(column: string, operator: string, value: SqlValue): void {
    this.addCondition(`${this.column(column)} ${operator} ?`, value);
  }

  private subquery(column: string, operator: string, subquery: Table): void {
    this.addCondition(`${this.column(column)} ${operator} (${subquery.buildSelectQuery()})`, ...subquery.getConditionBuilder().getValues());
  }

  eq(column: string, value: SqlValue | readonly SqlValue[]): void {
    if (Array.isArray(value)) {
      this.in(column, value, true);
    } else {
      this.compare(column, '=', value as SqlValue);
    }
  }

  neq(column: string, value: SqlValue | readonly SqlValue[]): void {
    if (Array.isArray(value)) {
      this.notIn(column, value);
    } else {
      this.compare(column, '!=', value as SqlValue);
    }
  }

  /**
   * `column IN (...)`. Like PicoDb an empty list adds no condition at all, unless
   * `matchNothingWhenEmpty` is set (used by `eq(column, [])`) in which case no row matches.
   */
  in(column: string, values: readonly SqlValue[], matchNothingWhenEmpty = false): void {
    if (values.length > 0) {
      this.addCondition(`${this.column(column)} IN (${values.map(() => '?').join(', ')})`, ...values);
    } else if (matchNothingWhenEmpty) {
      this.addCondition('1 = 0');
    }
  }

  /** `column NOT IN (...)`; an empty list adds no condition (every row matches). */
  notIn(column: string, values: readonly SqlValue[]): void {
    if (values.length > 0) {
      this.addCondition(`${this.column(column)} NOT IN (${values.map(() => '?').join(', ')})`, ...values);
    }
  }

  inSubquery(column: string, subquery: Table): void {
    this.subquery(column, 'IN', subquery);
  }

  notInSubquery(column: string, subquery: Table): void {
    this.subquery(column, 'NOT IN', subquery);
  }

  like(column: string, value: SqlValue): void {
    this.compare(column, this.db.getDriver().getOperator('LIKE'), value);
  }

  ilike(column: string, value: SqlValue): void {
    this.compare(column, this.db.getDriver().getOperator('ILIKE'), value);
  }

  gt(column: string, value: SqlValue): void {
    this.compare(column, '>', value);
  }

  gtSubquery(column: string, subquery: Table): void {
    this.subquery(column, '>', subquery);
  }

  lt(column: string, value: SqlValue): void {
    this.compare(column, '<', value);
  }

  ltSubquery(column: string, subquery: Table): void {
    this.subquery(column, '<', subquery);
  }

  gte(column: string, value: SqlValue): void {
    this.compare(column, '>=', value);
  }

  gteSubquery(column: string, subquery: Table): void {
    this.subquery(column, '>=', subquery);
  }

  lte(column: string, value: SqlValue): void {
    this.compare(column, '<=', value);
  }

  lteSubquery(column: string, subquery: Table): void {
    this.subquery(column, '<=', subquery);
  }

  isNull(column: string): void {
    this.addCondition(`${this.column(column)} IS NULL`);
  }

  notNull(column: string): void {
    this.addCondition(`${this.column(column)} IS NOT NULL`);
  }

  /** Deep copy, used when a `Table` is cloned. */
  clone(): ConditionBuilder {
    const copy = new ConditionBuilder(this.db);
    copy.values = [...this.values];
    copy.conditions = [...this.conditions];
    copy.orGroups = this.orGroups.map((group) => [...group]);
    return copy;
  }
}
