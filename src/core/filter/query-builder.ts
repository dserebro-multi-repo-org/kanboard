import type { CriteriaInterface } from './criteria-interface.js';
import type { FilterInterface, FilterQuery } from './filter-interface.js';
import type { FormatterInterface } from './formatter-interface.js';

/** Port of `Kanboard\Core\Filter\QueryBuilder`. */
export class QueryBuilder {
  protected query: FilterQuery | undefined;

  static create<T extends QueryBuilder>(this: new () => T): T {
    return new this();
  }

  withQuery(query: FilterQuery): this {
    this.query = query;
    return this;
  }

  withFilter(filter: FilterInterface): this {
    filter.withQuery(this.requireQuery()).apply();
    return this;
  }

  withCriteria(criteria: CriteriaInterface): this {
    criteria.withQuery(this.requireQuery()).apply();
    return this;
  }

  /** Run a formatter on the query; returns whatever the formatter returns (often a promise). */
  format<T>(formatter: FormatterInterface<T>): T {
    return formatter.withQuery(this.requireQuery()).format();
  }

  /** Query result as an array of rows. */
  toArray(): Promise<Record<string, unknown>[]> {
    return this.requireQuery().findAll() as Promise<Record<string, unknown>[]>;
  }

  getQuery(): FilterQuery {
    return this.requireQuery();
  }

  /** Deep copy: the query is cloned (PHP `__clone`). */
  clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this) as object) as this;
    Object.assign(copy, this);
    copy.query = this.query?.clone();
    return copy;
  }

  private requireQuery(): FilterQuery {
    if (this.query === undefined) {
      throw new Error('QueryBuilder: no query, call withQuery() first');
    }
    return this.query;
  }
}
