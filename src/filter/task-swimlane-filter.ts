import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskSwimlaneFilter`. */
export class TaskSwimlaneFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['swimlane'];
  }

  apply(): this {
    this.query.ilike(`${TABLES.SWIMLANE}.name`, this.stringValue);

    return this;
  }
}
