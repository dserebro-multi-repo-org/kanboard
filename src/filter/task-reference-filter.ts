import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskReferenceFilter`. */
export class TaskReferenceFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['reference', 'ref'];
  }

  apply(): this {
    if (this.value === 'none') {
      this.query.beginOr();
      this.query.eq(`${TABLES.TASK}.reference`, '');
      this.query.isNull(`${TABLES.TASK}.reference`);
      this.query.closeOr();
      return this;
    }

    // PHP: `strpos($this->value, '*') >= 0` is true even when `*` is absent (false >= 0), so the
    // LIKE branch always applies and the equality fallback below it is unreachable.
    this.query.ilike(`${TABLES.TASK}.reference`, this.stringValue.replaceAll('*', '%'));

    return this;
  }
}
