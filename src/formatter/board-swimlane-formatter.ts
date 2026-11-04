import type { Container } from '../core/container/container.js';
import { arrayColumnSum } from '../foundation/array-helpers.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

interface ColumnStats {
  nb_visible_tasks_across_swimlane: number;
  nb_unfiltered_tasks_across_swimlane: number;
  cumulative_score_across_swimlane: number;
}

/** Board Swimlane Formatter (port of `Kanboard\Formatter\BoardSwimlaneFormatter`). */
export class BoardSwimlaneFormatter extends BaseFormatter {
  protected swimlanes: Row[] = [];
  protected columns: Row[] = [];
  protected tasks: Row[] = [];
  protected tags: Record<string | number, Row[]> = {};
  protected taskCountBySwimlaneAndColumn: Record<string | number, Record<string | number, number>> = {};

  constructor(container: Container) {
    super(container);
  }

  withSwimlanes(swimlanes: Row[]): this {
    this.swimlanes = swimlanes.map((swimlane) => ({ ...swimlane }));
    return this;
  }

  withColumns(columns: Row[]): this {
    this.columns = columns;
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
    const nbSwimlanes = this.swimlanes.length;
    const nbColumns = this.columns.length;
    const stats = new Map<number, ColumnStats>();

    for (const column of this.columns) {
      stats.set(Number(column['id']), {
        nb_visible_tasks_across_swimlane: 0,
        nb_unfiltered_tasks_across_swimlane: 0,
        cumulative_score_across_swimlane: 0,
      });
    }

    for (const swimlane of this.swimlanes) {
      swimlane['id'] = Number(swimlane['id']);
      swimlane['columns'] = await this.service('boardColumnFormatter')
        .withSwimlaneId(swimlane['id'] as number)
        .withColumns(this.columns)
        .withTasks(this.tasks)
        .withTags(this.tags)
        .withTaskCountBySwimlaneAndColumn(this.taskCountBySwimlaneAndColumn)
        .format();

      const columns = swimlane['columns'] as Row[];
      swimlane['nb_swimlanes'] = nbSwimlanes;
      swimlane['nb_columns'] = nbColumns;
      swimlane['nb_tasks'] = arrayColumnSum(columns, 'nb_tasks');
      swimlane['score'] = arrayColumnSum(columns, 'score');

      for (const column of columns) {
        const columnStats = stats.get(column['id'] as number);
        if (columnStats === undefined) continue;
        columnStats.nb_visible_tasks_across_swimlane += (column['tasks'] as Row[]).length;
        columnStats.nb_unfiltered_tasks_across_swimlane = column['nb_open_tasks'] as number;
        columnStats.cumulative_score_across_swimlane += column['score'] as number;
      }
    }

    for (const swimlane of this.swimlanes) {
      for (const column of swimlane['columns'] as Row[]) {
        const columnStats = stats.get(column['id'] as number);
        if (columnStats === undefined) continue;
        column['nb_visible_tasks_across_swimlane'] = columnStats.nb_visible_tasks_across_swimlane;
        column['nb_unfiltered_tasks_across_swimlane'] = columnStats.nb_unfiltered_tasks_across_swimlane;
        column['cumulative_score_across_swimlane'] = columnStats.cumulative_score_across_swimlane;
      }
    }

    return this.swimlanes;
  }
}
