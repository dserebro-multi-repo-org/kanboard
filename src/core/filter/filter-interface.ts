import type { Table } from '../../db/table.js';

/** Query the filters are applied to (a `Table` over any row shape). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterQuery = Table<any>;

/** Value of a filter: the raw token of the query language, or a list/range given programmatically. */
export type FilterValue = string | number | boolean | null | undefined | readonly (string | number)[];

/** Port of `Kanboard\Core\Filter\FilterInterface`. */
export interface FilterInterface {
  /** Set the value. */
  withValue(value: FilterValue): this;
  /** Set the query. */
  withQuery(query: FilterQuery): this;
  /** Search attributes handled by the filter (`assignee`, `title`...). */
  getAttributes(): string[];
  /** Apply the filter to the query (conditions are added synchronously). */
  apply(): this;
  /** Shallow copy (PHP `clone`), used to apply the same filter with several values. */
  clone(): FilterInterface;
}
