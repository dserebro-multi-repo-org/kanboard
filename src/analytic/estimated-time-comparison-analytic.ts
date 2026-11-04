import type { Container } from '../core/container/container.js';
import { TABLES, TASK_STATUS_OPEN } from '../foundation/model-constants.js';
import type { Row } from '../foundation/model.js';
import { BaseAnalytic } from './base-analytic.js';

export interface TimeComparison {
  time_spent: number;
  time_estimated: number;
}

export interface EstimatedTimeComparisonMetrics {
  open: TimeComparison;
  closed: TimeComparison;
}

/** Estimated vs spent time of open and closed tasks (port of `Kanboard\Analytic\EstimatedTimeComparisonAnalytic`). */
export class EstimatedTimeComparisonAnalytic extends BaseAnalytic {
  constructor(container: Container) {
    super(container);
  }

  /** Build the report for a project. */
  async build(projectId: number): Promise<EstimatedTimeComparisonMetrics> {
    const rows = (await this.db
      .table(TABLES.TASK)
      .columns('SUM(time_estimated) AS time_estimated', 'SUM(time_spent) AS time_spent', 'is_active')
      .eq('project_id', projectId)
      .groupBy('is_active')
      .findAll()) as Row[];

    const metrics: EstimatedTimeComparisonMetrics = {
      open: { time_spent: 0, time_estimated: 0 },
      closed: { time_spent: 0, time_estimated: 0 },
    };

    for (const row of rows) {
      // Loose comparison as the driver may return the flag as a string.
      const key = Number(row['is_active']) === TASK_STATUS_OPEN ? 'open' : 'closed';
      metrics[key].time_spent = Number(row['time_spent']) || 0;
      metrics[key].time_estimated = Number(row['time_estimated']) || 0;
    }

    return metrics;
  }
}
