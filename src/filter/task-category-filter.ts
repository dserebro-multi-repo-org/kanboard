import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskCategoryFilter`. */
export class TaskCategoryFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['category'];
  }

  apply(): this {
    if (isIntegerLike(this.value)) {
      this.query.beginOr();
      this.query.eq(`${TABLES.TASK}.category_id`, this.value);
      this.query.eq(`${TABLES.CATEGORY}.name`, this.value);
      this.query.closeOr();
    } else if (this.value === 'none') {
      this.query.eq(`${TABLES.TASK}.category_id`, 0);
    } else {
      this.query.eq(`${TABLES.CATEGORY}.name`, this.value);
    }

    return this;
  }
}
