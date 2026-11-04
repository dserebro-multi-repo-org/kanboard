import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isEmpty, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectIdsFilter`. */
export class ProjectIdsFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['project_ids'];
  }

  apply(): this {
    if (isEmpty(this.value)) {
      this.query.eq(`${TABLES.PROJECT}.id`, 0);
    } else {
      this.query.in(`${TABLES.PROJECT}.id`, this.value as readonly (string | number)[]);
    }

    return this;
  }
}
