import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskTitleFilter`. */
export class TaskTitleFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['title'];
  }

  apply(): this {
    const value = this.stringValue;

    if (/^[0-9]+$/.test(value) || (value.length > 1 && value[0] === '#' && /^[0-9]+$/.test(value.slice(1)))) {
      this.query.beginOr();
      this.query.eq(`${TABLES.TASK}.id`, value.replaceAll('#', ''));
      this.query.ilike(`${TABLES.TASK}.title`, '%' + value + '%');
      this.query.closeOr();
    } else {
      this.query.ilike(`${TABLES.TASK}.title`, '%' + value + '%');
    }

    return this;
  }
}
