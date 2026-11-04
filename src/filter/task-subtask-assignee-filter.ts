import type { FilterInterface } from '../core/filter/filter-interface.js';
import type { Database } from '../db/database.js';
import type { Table } from '../db/table.js';
import { TABLES, SUBTASK_STATUS_DONE } from '../foundation/model-constants.js';
import { isIntegerLike, BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskSubtaskAssigneeFilter`. */
export class TaskSubtaskAssigneeFilter extends BaseFilter implements FilterInterface {
  private currentUserId: number | string = 0;

  setCurrentUserId(userId: number | string): this {
    this.currentUserId = userId;
    return this;
  }

  private db!: Database;

  setDatabase(db: Database): this {
    this.db = db;
    return this;
  }

  getAttributes(): string[] {
    return ['subtask:assignee'];
  }

  apply(): this {
    this.query.inSubquery(`${TABLES.TASK}.id`, this.getSubQuery());

    return this;
  }

  protected getSubQuery(): Table {
    const subquery = this.db
      .table(TABLES.SUBTASK)
      .columns(`${TABLES.SUBTASK}.task_id`)
      .join(TABLES.USER, 'id', 'user_id', TABLES.SUBTASK)
      .neq(`${TABLES.SUBTASK}.status`, SUBTASK_STATUS_DONE);

    return this.applySubQueryFilter(subquery);
  }

  protected applySubQueryFilter(subquery: Table): Table {
    if (isIntegerLike(this.value)) {
      subquery.eq(`${TABLES.SUBTASK}.user_id`, this.value);
    } else {
      switch (this.value) {
        case 'me':
          subquery.eq(`${TABLES.SUBTASK}.user_id`, this.currentUserId);
          break;
        case 'nobody':
          subquery.eq(`${TABLES.SUBTASK}.user_id`, 0);
          break;
        case 'anybody':
          subquery.gt(`${TABLES.SUBTASK}.user_id`, 0);
          break;
        default:
          subquery.beginOr();
          subquery.ilike(`${TABLES.USER}.username`, this.stringValue + '%');
          subquery.ilike(`${TABLES.USER}.name`, '%' + this.stringValue + '%');
          subquery.closeOr();
      }
    }

    return subquery;
  }
}
