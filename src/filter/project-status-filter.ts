import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectStatusFilter`. */
export class ProjectStatusFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['status'];
  }

  apply(): this {
    if (isIntegerLike(this.value)) {
      this.query.eq(`${TABLES.PROJECT}.is_active`, this.value);
    } else if (this.value === 'inactive' || this.value === 'closed' || this.value === 'disabled') {
      this.query.eq(`${TABLES.PROJECT}.is_active`, 0);
    } else {
      this.query.eq(`${TABLES.PROJECT}.is_active`, 1);
    }

    return this;
  }
}
