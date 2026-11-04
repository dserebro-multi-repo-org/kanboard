import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateFilter } from './base-date-filter.js';

/** Port of `Kanboard\Filter\TaskMovedDateFilter`. */
export class TaskMovedDateFilter extends BaseDateFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['moved'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_moved`);

    return this;
  }
}
