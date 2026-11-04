import type { Container } from '../core/container/container.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** API Task Formatter (port of `Kanboard\Formatter\TaskApiFormatter`). */
export class TaskApiFormatter extends BaseFormatter {
  protected task: Row | null = null;

  constructor(container: Container) {
    super(container);
  }

  withTask(task: Row | null | false): this {
    this.task = task || null;
    return this;
  }

  async format(): Promise<Row | null> {
    const task = this.task;

    if (task !== null && Object.keys(task).length > 0) {
      task['url'] = this.urlHelper.to('TaskViewController', 'show', { task_id: task['id'] }, '', true);
      task['color'] = this.collaborator('colorModel').getColorProperties(task['color_id'] as string);
    }

    return task;
  }
}
