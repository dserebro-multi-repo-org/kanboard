import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityProjectNameFilter`. */
export class ProjectActivityProjectNameFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['project'];
  }

  apply(): this {
    this.query.ilike(`${TABLES.PROJECT}.name`, '%' + this.stringValue + '%');

    return this;
  }
}
