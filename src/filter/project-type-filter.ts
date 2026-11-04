import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES, PROJECT_TYPE_PRIVATE, PROJECT_TYPE_TEAM } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectTypeFilter`. */
export class ProjectTypeFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['type'];
  }

  apply(): this {
    if (isIntegerLike(this.value)) {
      this.query.eq(`${TABLES.PROJECT}.is_private`, this.value);
    } else if (this.value === 'private') {
      this.query.eq(`${TABLES.PROJECT}.is_private`, PROJECT_TYPE_PRIVATE);
    } else {
      this.query.eq(`${TABLES.PROJECT}.is_private`, PROJECT_TYPE_TEAM);
    }

    return this;
  }
}
