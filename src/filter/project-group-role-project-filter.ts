import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectGroupRoleProjectFilter`. */
export class ProjectGroupRoleProjectFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return [];
  }

  apply(): this {
    this.query.eq(`${TABLES.PROJECT_GROUP_ROLE}.project_id`, this.value);

    return this;
  }
}
