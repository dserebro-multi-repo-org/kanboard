import type { FilterInterface, FilterQuery } from './filter-interface.js';

/** Port of `Kanboard\Core\Filter\CriteriaInterface`. */
export interface CriteriaInterface {
  withQuery(query: FilterQuery): this;
  withFilter(filter: FilterInterface): this;
  apply(): this;
}
