import type { Container } from '../core/container/container.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** API Tasks Formatter (port of `Kanboard\Formatter\TasksApiFormatter`). */
export class TasksApiFormatter extends BaseFormatter {
  protected tasks: Row[] = [];

  constructor(container: Container) {
    super(container);
  }

  withTasks(tasks: Row[]): this {
    this.tasks = tasks;
    return this;
  }

  async format(): Promise<Array<Row | null>> {
    const result: Array<Row | null> = [];

    for (const task of this.tasks) {
      result.push(await this.service('taskApiFormatter').withTask(task).format());
    }

    return result;
  }
}
