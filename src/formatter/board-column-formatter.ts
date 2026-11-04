import type { Container } from '../core/container/container.js';
import { arrayColumnSum } from '../foundation/array-helpers.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Board Column Formatter (port of `Kanboard\Formatter\BoardColumnFormatter`). */
export class BoardColumnFormatter extends BaseFormatter {
  protected swimlaneId = 0;
  protected columns: Row[] = [];
  protected tasks: Row[] = [];
  protected tags: Record<string | number, Row[]> = {};
  protected taskCountBySwimlaneAndColumn: Record<string | number, Record<string | number, number>> = {};

  constructor(container: Container) {
    super(container);
  }

  withSwimlaneId(swimlaneId: number): this {
    this.swimlaneId = swimlaneId;
    return this;
  }

  /** Columns are copied: the formatter decorates them without altering the caller's rows (PHP by-value arrays). */
  withColumns(columns: Row[]): this {
    this.columns = columns.map((column) => ({ ...column }));
    return this;
  }

  withTasks(tasks: Row[]): this {
    this.tasks = tasks;
    return this;
  }

  withTags(tags: Record<string | number, Row[]>): this {
    this.tags = tags;
    return this;
  }

  withTaskCountBySwimlaneAndColumn(taskCount: Record<string | number, Record<string | number, number>>): this {
    this.taskCountBySwimlaneAndColumn = taskCount;
    return this;
  }

  /** Apply the formatter. */
  async format(): Promise<Row[]> {
    for (const column of this.columns) {
      column['id'] = Number(column['id']);
      column['tasks'] = await this.service('boardTaskFormatter')
        .withTasks(this.tasks)
        .withTags(this.tags)
        .withSwimlaneId(this.swimlaneId)
        .withColumnId(column['id'] as number)
        .format();
      const tasks = column['tasks'] as Row[];
      column['nb_tasks'] = tasks.length;
      column['score'] = Math.trunc(arrayColumnSum(tasks, 'score'));

      if (Object.keys(this.taskCountBySwimlaneAndColumn).length === 0) {
        column['column_nb_open_tasks'] = column['nb_open_tasks'];
      } else {
        column['column_nb_open_tasks'] = this.taskCountBySwimlaneAndColumn[this.swimlaneId]?.[column['id'] as number] ?? 0;
      }
    }

    return this.columns;
  }
}
