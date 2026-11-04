import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseComparisonFilter } from './base-comparison-filter.js';

/** Port of `Kanboard\Filter\TaskScoreFilter`. */
export class TaskScoreFilter extends BaseComparisonFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['score', 'complexity'];
  }

  apply(): this {
    this.applyComparisonFilter(`${TABLES.TASK}.score`);

    return this;
  }
}
