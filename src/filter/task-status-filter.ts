import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES, TASK_STATUS_OPEN, TASK_STATUS_CLOSED } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskStatusFilter`. */
export class TaskStatusFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['status'];
  }

  apply(): this {
    if (this.value === 'open' || this.value === 'closed') {
      this.query.eq(`${TABLES.TASK}.is_active`, this.value === 'open' ? TASK_STATUS_OPEN : TASK_STATUS_CLOSED);
    } else if (isIntegerLike(this.value)) {
      this.query.eq(`${TABLES.TASK}.is_active`, this.value);
    }

    return this;
  }
}
