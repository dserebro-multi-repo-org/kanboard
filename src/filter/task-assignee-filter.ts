import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskAssigneeFilter`. */
export class TaskAssigneeFilter extends BaseFilter implements FilterInterface {
  private currentUserId: number | string = 0;

  setCurrentUserId(userId: number | string): this {
    this.currentUserId = userId;
    return this;
  }

  getAttributes(): string[] {
    return ['assignee'];
  }

  apply(): this {
    if (isIntegerLike(this.value)) {
      this.query.eq(`${TABLES.TASK}.owner_id`, this.value);
    } else {
      switch (this.value) {
        case 'me':
          this.query.eq(`${TABLES.TASK}.owner_id`, this.currentUserId);
          break;
        case 'nobody':
          this.query.eq(`${TABLES.TASK}.owner_id`, 0);
          break;
        case 'anybody':
          this.query.gt(`${TABLES.TASK}.owner_id`, 0);
          break;
        default:
          this.query.beginOr();
          this.query.ilike(`${TABLES.USER}.username`, '%' + this.stringValue + '%');
          this.query.ilike(`${TABLES.USER}.name`, '%' + this.stringValue + '%');
          this.query.closeOr();
      }
    }

    return this;
  }
}
