import type { FilterInterface } from '../core/filter/filter-interface.js';
import type { Database } from '../db/database.js';
import type { Table } from '../db/table.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskCommentFilter`. */
export class TaskCommentFilter extends BaseFilter implements FilterInterface {
  private db!: Database;

  setDatabase(db: Database): this {
    this.db = db;
    return this;
  }

  getAttributes(): string[] {
    return ['comment'];
  }

  apply(): this {
    this.query.inSubquery(`${TABLES.TASK}.id`, this.getSubQuery());

    return this;
  }

  protected getSubQuery(): Table {
    return this.db
      .table(TABLES.COMMENT)
      .columns(`${TABLES.COMMENT}.task_id`)
      .ilike(`${TABLES.COMMENT}.comment`, '%' + this.stringValue + '%');
  }
}
