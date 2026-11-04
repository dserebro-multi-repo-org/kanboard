import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectUserRoleUsernameFilter`. */
export class ProjectUserRoleUsernameFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return [];
  }

  apply(): this {
    this.query
      .join(TABLES.USER, 'id', 'user_id')
      .ilike(`${TABLES.USER}.username`, this.stringValue + '%');

    return this;
  }
}
