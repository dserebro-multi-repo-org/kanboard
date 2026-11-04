import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateFilter } from './base-date-filter.js';

/** Port of `Kanboard\Filter\TaskCreationDateFilter`. */
export class TaskCreationDateFilter extends BaseDateFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['created'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_creation`);

    return this;
  }
}
