import type { Container } from '../core/container/container.js';
import { arrayMergeRelation } from '../foundation/array-helpers.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Board Task Formatter (port of `Kanboard\Formatter\BoardTaskFormatter`). */
export class BoardTaskFormatter extends BaseFormatter {
  protected tasks: Row[] = [];
  protected tags: Record<string | number, Row[]> = {};
  protected columnId = 0;
  protected swimlaneId = 0;

  constructor(container: Container) {
    super(container);
  }

  /** Set tags, `task id -> tags`. */
  withTags(tags: Record<string | number, Row[]>): this {
    this.tags = tags;
    return this;
  }

  withTasks(tasks: Row[]): this {
    this.tasks = tasks;
    return this;
  }

  withColumnId(columnId: number): this {
    this.columnId = columnId;
    return this;
  }

  withSwimlaneId(swimlaneId: number): this {
    this.swimlaneId = swimlaneId;
    return this;
  }

  /** Apply the formatter: tasks of the column and swimlane, with their tags and drag & drop flag. */
  async format(): Promise<Row[]> {
    // Copies are made as PHP arrays are passed by value.
    const tasks = this.tasks.filter((task) => this.filterTasks(task)).map((task) => ({ ...task }));
    arrayMergeRelation(tasks, this.tags, 'tags', 'id');

    for (const task of tasks) {
      task['is_draggable'] = this.projectRoleHelper.isDraggable(task);
    }

    return tasks;
  }

  protected filterTasks(task: Row): boolean {
    // Loose comparison as in PHP (ids may be strings coming from the database).
    return task['column_id'] == this.columnId && task['swimlane_id'] == this.swimlaneId;
  }
}
