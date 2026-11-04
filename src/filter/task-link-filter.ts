import type { FilterInterface } from '../core/filter/filter-interface.js';
import type { Database } from '../db/database.js';
import type { Table } from '../db/table.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskLinkFilter`. */
export class TaskLinkFilter extends BaseFilter implements FilterInterface {
  private db!: Database;

  setDatabase(db: Database): this {
    this.db = db;
    return this;
  }

  getAttributes(): string[] {
    return ['link'];
  }

  apply(): this {
    this.query.inSubquery(`${TABLES.TASK}.id`, this.getSubQuery());

    return this;
  }

  protected getSubQuery(): Table {
    return this.db
      .table(TABLES.TASK_LINK)
      .columns(`${TABLES.TASK_LINK}.task_id`)
      .join(TABLES.LINK, 'id', 'link_id', TABLES.TASK_LINK)
      .ilike(`${TABLES.LINK}.label`, this.stringValue);
  }
}
