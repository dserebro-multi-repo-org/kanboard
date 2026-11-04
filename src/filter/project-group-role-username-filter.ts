import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectGroupRoleUsernameFilter`. */
export class ProjectGroupRoleUsernameFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return [];
  }

  apply(): this {
    this.query
      .join(TABLES.GROUP_MEMBER, 'group_id', 'group_id', TABLES.PROJECT_GROUP_ROLE)
      .join(TABLES.USER, 'id', 'user_id', TABLES.GROUP_MEMBER)
      .ilike(`${TABLES.USER}.username`, this.stringValue + '%');

    return this;
  }
}
