import type { Container } from '../core/container/container.js';
import { arrayColumn, arrayMergeRelation } from '../foundation/array-helpers.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Task List Formatter (port of `Kanboard\Formatter\TaskListFormatter`). */
export class TaskListFormatter extends BaseFormatter {
  constructor(container: Container) {
    super(container);
  }

  /** Apply the formatter: tasks with their tags. */
  async format(): Promise<Row[]> {
    const tasks = await this.findRows();
    const tags = await this.collaborator('taskTagModel').getTagsByTaskIds(arrayColumn<number>(tasks, 'id'));
    arrayMergeRelation(tasks, tags, 'tags', 'id');

    return tasks;
  }
}
