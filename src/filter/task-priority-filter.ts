import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseComparisonFilter } from './base-comparison-filter.js';

/** Port of `Kanboard\Filter\TaskPriorityFilter`. */
export class TaskPriorityFilter extends BaseComparisonFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['priority'];
  }

  apply(): this {
    this.applyComparisonFilter(`${TABLES.TASK}.priority`);

    return this;
  }
}
