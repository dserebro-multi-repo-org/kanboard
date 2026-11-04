import type { FilterInterface } from '../core/filter/filter-interface.js';
import type { Database } from '../db/database.js';
import type { Table } from '../db/table.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskSearchFilter`. */
export class TaskSearchFilter extends BaseFilter implements FilterInterface {
  private db!: Database;

  setDatabase(db: Database): this {
    this.db = db;
    return this;
  }

  getAttributes(): string[] {
    return ['search'];
  }

  apply(): this {
    const value = this.stringValue;

    this.query.beginOr();

    if (/^[0-9]+$/.test(value) || (value.length > 1 && value[0] === '#' && /^[0-9]+$/.test(value.slice(1)))) {
      this.query.eq(`${TABLES.TASK}.id`, value.replaceAll('#', ''));
    }

    this.query.ilike(`${TABLES.TASK}.title`, '%' + value + '%');
    this.query.ilike(`${TABLES.TASK}.description`, '%' + value + '%');
    this.query.inSubquery(`${TABLES.TASK}.id`, this.getCommentSubQuery());
    this.query.closeOr();

    return this;
  }

  protected getCommentSubQuery(): Table {
    return this.db
      .table(TABLES.COMMENT)
      .columns(`${TABLES.COMMENT}.task_id`)
      .ilike(`${TABLES.COMMENT}.comment`, '%' + this.stringValue + '%');
  }
}
