import type { FilterInterface } from '../core/filter/filter-interface.js';
import type { Database } from '../db/database.js';
import type { Table } from '../db/table.js';
import { TABLES } from '../foundation/model-constants.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskTagFilter`. */
export class TaskTagFilter extends BaseFilter implements FilterInterface {
  private db!: Database;

  setDatabase(db: Database): this {
    this.db = db;
    return this;
  }

  getAttributes(): string[] {
    return ['tag'];
  }

  apply(): this {
    const subQuery = this.value === 'none' ? this.getQueryOfTaskIdsWithoutTags() : this.getQueryOfTaskIdsWithGivenTag();

    this.query.inSubquery(`${TABLES.TASK}.id`, subQuery);

    return this;
  }

  protected getQueryOfTaskIdsWithoutTags(): Table {
    return this.db
      .table(TABLES.TASK)
      .columns(`${TABLES.TASK}.id`)
      .left(TABLES.TASK_TAG, 'tg', 'task_id', TABLES.TASK, 'id')
      .isNull('tg.tag_id');
  }

  protected getQueryOfTaskIdsWithGivenTag(): Table {
    return this.db
      .table(TABLES.TAG)
      .columns(`${TABLES.TASK_TAG}.task_id`)
      .ilike(`${TABLES.TAG}.name`, '%' + this.stringValue + '%')
      .join(TABLES.TASK_TAG, 'tag_id', 'id');
  }
}
