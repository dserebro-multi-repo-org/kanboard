import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateRangeFilter } from './base-date-range-filter.js';

/** Port of `Kanboard\Filter\TaskCompletionDateRangeFilter`. */
export class TaskCompletionDateRangeFilter extends BaseDateRangeFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['completedRange'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_completed`);

    return this;
  }
}
