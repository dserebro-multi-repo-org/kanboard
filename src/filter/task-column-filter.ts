import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskColumnFilter`. */
export class TaskColumnFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['column'];
  }

  apply(): this {
    if (isIntegerLike(this.value)) {
      this.query.eq(`${TABLES.TASK}.column_id`, this.value);
    } else {
      this.query.eq(`${TABLES.COLUMN}.title`, this.value);
    }

    return this;
  }
}
