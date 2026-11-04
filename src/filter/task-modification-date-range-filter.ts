import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateRangeFilter } from './base-date-range-filter.js';

/** Port of `Kanboard\Filter\TaskModificationDateRangeFilter`. */
export class TaskModificationDateRangeFilter extends BaseDateRangeFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['updatedRange', 'modifiedRange'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_modification`);

    return this;
  }
}
