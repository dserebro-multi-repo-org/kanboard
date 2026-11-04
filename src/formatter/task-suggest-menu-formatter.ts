import type { Container } from '../core/container/container.js';
import { TABLES } from '../foundation/model-constants.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Task Suggestion Formatter for the text editor (port of `Kanboard\Formatter\TaskSuggestMenuFormatter`). */
export class TaskSuggestMenuFormatter extends BaseFormatter {
  protected limit = 25;

  constructor(container: Container) {
    super(container);
  }

  withLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  async format(): Promise<Row[]> {
    const result: Row[] = [];
    const tasks = await this.findRows(
      this.requiredQuery
        .columns(`${TABLES.TASK}.id`, `${TABLES.TASK}.title`, `${TABLES.PROJECT}.name AS project_name`)
        .asc(`${TABLES.TASK}.id`)
        .limit(this.limit),
    );

    for (const task of tasks) {
      let html = `#${String(task['id'])} `;
      html += `${this.textHelper.e(task['title'])} `;
      html += `<small>${this.textHelper.e(task['project_name'])}</small>`;

      result.push({ value: String(task['id']), html });
    }

    return result;
  }
}
