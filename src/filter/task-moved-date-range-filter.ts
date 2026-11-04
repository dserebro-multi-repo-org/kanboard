import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateRangeFilter } from './base-date-range-filter.js';

/** Port of `Kanboard\Filter\TaskMovedDateRangeFilter`. */
export class TaskMovedDateRangeFilter extends BaseDateRangeFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['movedRange'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_moved`);

    return this;
  }
}
