import type { Container } from '../core/container/container.js';
import { TABLES } from '../foundation/model-constants.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Task AutoComplete Formatter (port of `Kanboard\Formatter\TaskAutoCompleteFormatter`). */
export class TaskAutoCompleteFormatter extends BaseFormatter {
  protected limit = 25;

  constructor(container: Container) {
    super(container);
  }

  withLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  async format(): Promise<Row[]> {
    const tasks = await this.findRows(
      this.requiredQuery
        .columns(`${TABLES.TASK}.id`, `${TABLES.TASK}.title`, `${TABLES.PROJECT}.name AS project_name`)
        .asc(`${TABLES.TASK}.id`)
        .limit(this.limit),
    );

    for (const task of tasks) {
      task['value'] = task['title'];
      task['label'] = `${String(task['project_name'])} > #${String(task['id'])} ${String(task['title'])}`;
    }

    return tasks;
  }
}
