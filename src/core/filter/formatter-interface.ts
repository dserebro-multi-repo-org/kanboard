import type { FilterQuery } from './filter-interface.js';

/** Port of `Kanboard\Core\Filter\FormatterInterface`; formatters usually return a promise as they read the database. */
export interface FormatterInterface<T = unknown> {
  withQuery(query: FilterQuery): this;
  format(): T;
}
