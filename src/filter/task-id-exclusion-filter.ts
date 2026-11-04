import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskIdExclusionFilter`. */
export class TaskIdExclusionFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['exclude'];
  }

  apply(): this {
    this.query.notIn(`${TABLES.TASK}.id`, this.value as readonly (string | number)[]);

    return this;
  }
}
