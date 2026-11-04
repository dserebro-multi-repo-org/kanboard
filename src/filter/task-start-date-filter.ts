import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateFilter } from './base-date-filter.js';

/** Port of `Kanboard\Filter\TaskStartDateFilter`. */
export class TaskStartDateFilter extends BaseDateFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['started'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_started`);

    return this;
  }
}
