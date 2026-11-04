import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskCreatorFilter`. */
export class TaskCreatorFilter extends BaseFilter implements FilterInterface {
  private currentUserId: number | string = 0;

  setCurrentUserId(userId: number | string): this {
    this.currentUserId = userId;
    return this;
  }

  getAttributes(): string[] {
    return ['creator'];
  }

  apply(): this {
    if (isIntegerLike(this.value)) {
      this.query.eq(`${TABLES.TASK}.creator_id`, this.value);
    } else {
      switch (this.value) {
        case 'me':
          this.query.eq(`${TABLES.TASK}.creator_id`, this.currentUserId);
          break;
        case 'nobody':
          this.query.eq(`${TABLES.TASK}.creator_id`, 0);
          break;
        case 'anybody':
          this.query.gt(`${TABLES.TASK}.creator_id`, 0);
          break;
        default:
          this.query.beginOr();
          this.query.ilike('uc.username', '%' + this.stringValue + '%');
          this.query.ilike('uc.name', '%' + this.stringValue + '%');
          this.query.closeOr();
      }
    }

    return this;
  }
}
