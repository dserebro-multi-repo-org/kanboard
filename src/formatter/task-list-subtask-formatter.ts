import type { Container } from '../core/container/container.js';
import { arrayColumn, arrayColumnIndex, arrayMergeRelation } from '../foundation/array-helpers.js';
import type { Row } from '../foundation/model.js';
import { TaskListFormatter } from './task-list-formatter.js';

/** Task List Formatter with the subtasks of every task (port of `Kanboard\Formatter\TaskListSubtaskFormatter`). */
export class TaskListSubtaskFormatter extends TaskListFormatter {
  constructor(container: Container) {
    super(container);
  }

  override async format(): Promise<Row[]> {
    const tasks = await super.format();
    const subtasks = await this.collaborator('subtaskModel').getAllByTaskIds(arrayColumn<number>(tasks, 'id'));
    arrayMergeRelation(tasks, arrayColumnIndex(subtasks, 'task_id'), 'subtasks', 'id');

    return tasks;
  }
}
