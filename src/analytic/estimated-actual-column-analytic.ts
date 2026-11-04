import type { Container } from '../core/container/container.js';
import { TABLES } from '../foundation/model-constants.js';
import type { Row } from '../foundation/model.js';
import { BaseAnalytic } from './base-analytic.js';

export interface EstimatedActualColumnMetrics {
  hours_spent: number;
  hours_estimated: number;
  title: string;
}

/** Estimated vs actual time per column (port of `Kanboard\Analytic\EstimatedActualColumnAnalytic`). */
export class EstimatedActualColumnAnalytic extends BaseAnalytic {
  constructor(container: Container) {
    super(container);
  }

  /** Build the report for a project, indexed by column id. */
  async build(projectId: number): Promise<Record<string, EstimatedActualColumnMetrics>> {
    const rows = (await this.db
      .table(TABLES.TASK)
      .columns('SUM(time_estimated) AS hours_estimated', 'SUM(time_spent) AS hours_spent', 'column_id')
      .eq('project_id', projectId)
      .groupBy('column_id')
      .findAll()) as Row[];

    const columns = await this.collaborator('columnModel').getList(projectId);
    const metrics: Record<string, EstimatedActualColumnMetrics> = {};

    for (const [columnId, columnTitle] of Object.entries(columns)) {
      metrics[columnId] = { hours_spent: 0, hours_estimated: 0, title: columnTitle };
    }

    for (const row of rows) {
      const key = String(row['column_id']);
      // PHP would implicitly create the entry when the column is unknown to the project.
      const metric = (metrics[key] ??= { hours_spent: 0, hours_estimated: 0, title: '' });
      metric.hours_spent = Number(row['hours_spent']) || 0;
      metric.hours_estimated = Number(row['hours_estimated']) || 0;
    }

    return metrics;
  }
}
