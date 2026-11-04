import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskProjectFilter`. */
export class TaskProjectFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['project'];
  }

  apply(): this {
    if ((typeof this.value === 'number' && Number.isInteger(this.value)) || (isIntegerLike(this.value) && Number(this.value) < 2147483647)) {
      this.query.eq(`${TABLES.TASK}.project_id`, this.value);
    } else {
      this.query.ilike(`${TABLES.PROJECT}.name`, this.stringValue);
    }

    return this;
  }
}
