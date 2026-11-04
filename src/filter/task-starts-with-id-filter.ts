import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskStartsWithIdFilter`. */
export class TaskStartsWithIdFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['starts_with_id'];
  }

  apply(): this {
    this.query.ilike('CAST(' + `${TABLES.TASK}.id` + ' AS CHAR(8))', this.stringValue + '%');

    return this;
  }
}
