import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isNumeric } from '../helper/php.js';
import { strtotime } from '../foundation/php-time.js';
import { BaseFilter } from './base-filter.js';

/** `is_numeric($v) ? $v : strtotime($v)` */
function toTimestamp(value: string | number | undefined): number | false {
  if (isNumeric(value)) {
    return Number(value);
  }
  return strtotime(String(value ?? ''));
}

/** Port of `Kanboard\Filter\TaskDueDateRangeFilter`. */
export class TaskDueDateRangeFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return [];
  }

  apply(): this {
    const [from, to] = this.value as readonly (string | number)[];

    this.query.beginOr();
    this.query.isNull(`${TABLES.TASK}.date_started`);
    this.query.eq(`${TABLES.TASK}.date_started`, 0);
    this.query.closeOr();
    this.query.gte(`${TABLES.TASK}.date_due`, toTimestamp(from));
    this.query.lte(`${TABLES.TASK}.date_due`, toTimestamp(to));

    return this;
  }
}
