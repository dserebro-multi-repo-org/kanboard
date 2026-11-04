import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES, TASK_STATUS_OPEN, TASK_STATUS_CLOSED } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityTaskStatusFilter`. */
export class ProjectActivityTaskStatusFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['status'];
  }

  apply(): this {
    if (this.value === 'open') {
      this.query.eq(`${TABLES.TASK}.is_active`, TASK_STATUS_OPEN);
    } else if (this.value === 'closed') {
      this.query.eq(`${TABLES.TASK}.is_active`, TASK_STATUS_CLOSED);
    }

    return this;
  }
}
