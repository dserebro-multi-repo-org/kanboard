import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityProjectIdFilter`. */
export class ProjectActivityProjectIdFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['project_id'];
  }

  apply(): this {
    this.query.eq(`${TABLES.PROJECT_ACTIVITY}.project_id`, this.value);

    return this;
  }
}
