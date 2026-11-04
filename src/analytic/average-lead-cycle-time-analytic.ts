import type { Container } from '../core/container/container.js';
import { TABLES } from '../foundation/model-constants.js';
import type { Row } from '../foundation/model.js';
import { BaseAnalytic } from './base-analytic.js';

export interface LeadCycleTimeStats {
  count: number;
  total_lead_time: number;
  total_cycle_time: number;
  avg_lead_time: number;
  avg_cycle_time: number;
}

/** Average Lead and Cycle Time (port of `Kanboard\Analytic\AverageLeadCycleTimeAnalytic`). */
export class AverageLeadCycleTimeAnalytic extends BaseAnalytic {
  constructor(container: Container) {
    super(container);
  }

  /** Build the report for a project (the last 1000 tasks are used). */
  async build(projectId: number): Promise<LeadCycleTimeStats> {
    const stats: LeadCycleTimeStats = {
      count: 0,
      total_lead_time: 0,
      total_cycle_time: 0,
      avg_lead_time: 0,
      avg_cycle_time: 0,
    };

    const now = Math.floor(Date.now() / 1000);

    for (const task of await this.getTasks(projectId)) {
      stats.count++;
      stats.total_lead_time += this.calculateLeadTime(task, now);
      stats.total_cycle_time += this.calculateCycleTime(task, now);
    }

    stats.avg_lead_time = this.calculateAverage(stats, 'total_lead_time');
    stats.avg_cycle_time = this.calculateAverage(stats, 'total_cycle_time');

    return stats;
  }

  private calculateAverage(stats: LeadCycleTimeStats, field: 'total_lead_time' | 'total_cycle_time'): number {
    return stats.count > 0 ? Math.trunc(stats[field] / stats.count) : 0;
  }

  private calculateLeadTime(task: Row, now: number): number {
    const end = Number(task['date_completed']) || now;
    const start = Number(task['date_creation']) || 0;

    return end - start;
  }

  private calculateCycleTime(task: Row, now: number): number {
    const end = Math.trunc(Number(task['date_completed']) || 0) || now;
    const start = Math.trunc(Number(task['date_started']) || 0);

    // Start date can be in the future when defined with the Gantt chart
    if (start > 0 && end > start) {
      return end - start;
    }

    return 0;
  }

  private async getTasks(projectId: number): Promise<Row[]> {
    return (await this.db
      .table(TABLES.TASK)
      .columns('date_completed', 'date_creation', 'date_started')
      .eq('project_id', projectId)
      .desc('id')
      .limit(1000)
      .findAll()) as Row[];
  }
}
