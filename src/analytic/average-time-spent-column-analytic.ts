import type { Container } from '../core/container/container.js';
import { TABLES } from '../foundation/model-constants.js';
import type { Row } from '../foundation/model.js';
import { BaseAnalytic } from './base-analytic.js';

export interface ColumnTimeStats {
  count: number;
  time_spent: number;
  average: number;
  title: string;
}

/** Average Time Spent by Column (port of `Kanboard\Analytic\AverageTimeSpentColumnAnalytic`). */
export class AverageTimeSpentColumnAnalytic extends BaseAnalytic {
  constructor(container: Container) {
    super(container);
  }

  /** Build the report for a project, indexed by column id. */
  async build(projectId: number): Promise<Record<string, ColumnTimeStats>> {
    const stats = await this.initialize(projectId);
    await this.processTasks(stats, projectId);
    this.calculateAverage(stats);

    return stats;
  }

  private async initialize(projectId: number): Promise<Record<string, ColumnTimeStats>> {
    const stats: Record<string, ColumnTimeStats> = {};
    const columns = await this.collaborator('columnModel').getList(projectId);

    for (const [columnId, columnTitle] of Object.entries(columns)) {
      stats[columnId] = { count: 0, time_spent: 0, average: 0, title: columnTitle };
    }

    return stats;
  }

  private async processTasks(stats: Record<string, ColumnTimeStats>, projectId: number): Promise<void> {
    for (const task of await this.getTasks(projectId)) {
      const timeByColumns = await this.getTaskTimeByColumns(task);

      for (const [columnId, timeSpent] of Object.entries(timeByColumns)) {
        const column = stats[columnId];
        if (column !== undefined) {
          column.count++;
          column.time_spent += timeSpent;
        }
      }
    }
  }

  private calculateAverage(stats: Record<string, ColumnTimeStats>): void {
    for (const column of Object.values(stats)) {
      if (column.count > 0) {
        column.average = Math.trunc(column.time_spent / column.count);
      }
    }
  }

  private async getTaskTimeByColumns(task: Row): Promise<Record<string, number>> {
    const columns: Record<string, number> = {
      ...(await this.collaborator('transitionModel').getTimeSpentByTask(task['id'] as number)),
    };
    const currentColumn = String(task['column_id']);

    columns[currentColumn] = (columns[currentColumn] ?? 0) + this.getTaskTimeSpentInCurrentColumn(task);

    return columns;
  }

  private getTaskTimeSpentInCurrentColumn(task: Row): number {
    const end = Number(task['date_completed']) || Math.floor(Date.now() / 1000);

    return end - Number(task['date_moved']);
  }

  private async getTasks(projectId: number): Promise<Row[]> {
    return (await this.db
      .table(TABLES.TASK)
      .columns('id', 'date_completed', 'date_moved', 'column_id')
      .eq('project_id', projectId)
      .desc('id')
      .limit(1000)
      .findAll()) as Row[];
  }
}
