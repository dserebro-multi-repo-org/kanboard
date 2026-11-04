import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskDescriptionFilter`. */
export class TaskDescriptionFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['description', 'desc'];
  }

  apply(): this {
    this.query.ilike(`${TABLES.TASK}.description`, '%' + this.stringValue + '%');

    return this;
  }
}
