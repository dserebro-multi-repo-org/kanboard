import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateFilter } from './base-date-filter.js';

/** Port of `Kanboard\Filter\TaskModificationDateFilter`. */
export class TaskModificationDateFilter extends BaseDateFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['updated', 'modified'];
  }

  apply(): this {
    this.applyDateFilter(`${TABLES.TASK}.date_modification`);

    return this;
  }
}
