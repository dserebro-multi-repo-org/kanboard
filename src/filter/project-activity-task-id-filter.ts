import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityTaskIdFilter`. */
export class ProjectActivityTaskIdFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['task_id'];
  }

  apply(): this {
    this.query.eq(`${TABLES.PROJECT_ACTIVITY}.task_id`, this.value);

    return this;
  }
}
