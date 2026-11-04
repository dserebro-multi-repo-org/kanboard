import type { Container } from '../core/container/container.js';
import { BaseAnalytic } from './base-analytic.js';

export interface TaskDistributionMetric {
  column_title: string;
  nb_tasks: number;
  percentage?: number;
}

/** Task distribution by column (port of `Kanboard\Analytic\TaskDistributionAnalytic`). */
export class TaskDistributionAnalytic extends BaseAnalytic {
  constructor(container: Container) {
    super(container);
  }

  /** Build the report for a project; empty when the project has no task. */
  async build(projectId: number): Promise<TaskDistributionMetric[]> {
    const metrics: TaskDistributionMetric[] = [];
    let total = 0;

    for (const column of await this.collaborator('columnModel').getAll(projectId)) {
      const nbTasks = await this.collaborator('taskFinderModel').countByColumnId(projectId, column['id'] as number);
      total += nbTasks;

      metrics.push({ column_title: column['title'] as string, nb_tasks: nbTasks });
    }

    if (total === 0) {
      return [];
    }

    for (const metric of metrics) {
      metric.percentage = round((metric.nb_tasks * 100) / total, 2);
    }

    return metrics;
  }
}

/** PHP `round()` (half away from zero). */
export function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor + Number.EPSILON * factor)) / factor;
}
