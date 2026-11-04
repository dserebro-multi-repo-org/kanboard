import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateRangeFilter } from './base-date-range-filter.js';

/** Port of `Kanboard\Filter\TaskCreationDateRangeFilter`. */
export class TaskCreationDateRangeFilter extends BaseDateRangeFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['createdRange'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_creation`);

    return this;
  }
}
