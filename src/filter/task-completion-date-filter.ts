import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateFilter } from './base-date-filter.js';

/** Port of `Kanboard\Filter\TaskCompletionDateFilter`. */
export class TaskCompletionDateFilter extends BaseDateFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['completed'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_completed`);

    return this;
  }
}
