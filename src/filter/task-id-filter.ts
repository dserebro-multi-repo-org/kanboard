import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskIdFilter`. */
export class TaskIdFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['id'];
  }

  apply(): this {
    this.query.eq(`${TABLES.TASK}.id`, this.value);

    return this;
  }
}
