import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseDateFilter } from './base-date-filter.js';

/** Port of `Kanboard\Filter\TaskDueDateFilter`. */
export class TaskDueDateFilter extends BaseDateFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['due'];
  }

  apply(): this {
    if (this.value === 'none') {
      this.query.eq(`${TABLES.TASK}.date_due`, 0);
    } else {
      this.query.neq(`${TABLES.TASK}.date_due`, 0);
      this.query.notNull(`${TABLES.TASK}.date_due`);
      this.applyDateFilter(`${TABLES.TASK}.date_due`);
    }

    return this;
  }
}
