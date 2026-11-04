import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isEmpty, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityProjectIdsFilter`. */
export class ProjectActivityProjectIdsFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['projects'];
  }

  apply(): this {
    if (isEmpty(this.value)) {
      this.query.eq(`${TABLES.PROJECT_ACTIVITY}.project_id`, 0);
    } else {
      this.query.in(`${TABLES.PROJECT_ACTIVITY}.project_id`, this.value as readonly (string | number)[]);
    }

    return this;
  }
}
