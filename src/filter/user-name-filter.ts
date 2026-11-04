import type { FilterInterface } from '../core/filter/filter-interface.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\UserNameFilter`. */
export class UserNameFilter extends BaseFilter implements FilterInterface {
  getAttributes(): string[] {
    return ['name'];
  }

  apply(): this {
    this.query
      .beginOr()
      .ilike('username', '%' + this.stringValue + '%')
      .ilike('name', '%' + this.stringValue + '%')
      .closeOr();

    return this;
  }
}
