import type { CriteriaInterface } from './criteria-interface.js';
import type { FilterInterface, FilterQuery } from './filter-interface.js';

/** Port of `Kanboard\Core\Filter\OrCriteria`: the conditions of every filter are joined with OR. */
export class OrCriteria implements CriteriaInterface {
  protected query: FilterQuery | undefined;
  protected filters: FilterInterface[] = [];

  withQuery(query: FilterQuery): this {
    this.query = query;
    return this;
  }

  withFilter(filter: FilterInterface): this {
    this.filters.push(filter);
    return this;
  }

  apply(): this {
    const query = this.query;
    if (query === undefined) {
      throw new Error('OrCriteria: no query, call withQuery() first');
    }

    query.beginOr();

    for (const filter of this.filters) {
      filter.withQuery(query).apply();
    }

    query.closeOr();
    return this;
  }
}
