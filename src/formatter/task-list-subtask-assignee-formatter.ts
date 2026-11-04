import type { Container } from '../core/container/container.js';
import { arrayColumn, arrayColumnIndex, arrayMergeRelation } from '../foundation/array-helpers.js';
import type { Row } from '../foundation/model.js';
import { TaskListFormatter } from './task-list-formatter.js';

/** Task List Formatter with the subtasks assigned to a user (port of `Kanboard\Formatter\TaskListSubtaskAssigneeFormatter`). */
export class TaskListSubtaskAssigneeFormatter extends TaskListFormatter {
  protected userId = 0;
  protected withoutEmptyTasksFlag = false;

  constructor(container: Container) {
    super(container);
  }

  withUserId(userId: number): this {
    this.userId = userId;
    return this;
  }

  /** Remove the tasks without subtask. */
  withoutEmptyTasks(): this {
    this.withoutEmptyTasksFlag = true;
    return this;
  }

  override async format(): Promise<Row[]> {
    let tasks = await super.format();
    const subtasks = await this.collaborator('subtaskModel').getAllByTaskIdsAndAssignee(
      arrayColumn<number>(tasks, 'id'),
      this.userId,
    );
    arrayMergeRelation(tasks, arrayColumnIndex(subtasks, 'task_id'), 'subtasks', 'id');

    if (this.withoutEmptyTasksFlag) {
      tasks = tasks.filter((task) => (task['subtasks'] as Row[]).length > 0);
    }

    return tasks;
  }
}
