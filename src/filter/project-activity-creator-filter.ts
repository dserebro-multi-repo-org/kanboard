import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityCreatorFilter`. */
export class ProjectActivityCreatorFilter extends BaseFilter implements FilterInterface {
  private currentUserId: number | string = 0;

  setCurrentUserId(userId: number | string): this {
    this.currentUserId = userId;
    return this;
  }

  getAttributes(): string[] {
    return ['creator'];
  }

  apply(): this {
    if (this.value === 'me') {
      this.query.eq(`${TABLES.PROJECT_ACTIVITY}.creator_id`, this.currentUserId);
    } else {
      this.query.beginOr();
      this.query.ilike('uc.username', '%' + this.stringValue + '%');
      this.query.ilike('uc.name', '%' + this.stringValue + '%');
      this.query.closeOr();
    }

    return this;
  }
}
