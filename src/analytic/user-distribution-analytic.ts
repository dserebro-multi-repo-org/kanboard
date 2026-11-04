import type { Container } from '../core/container/container.js';
import { BaseAnalytic } from './base-analytic.js';
import { round } from './task-distribution-analytic.js';

export interface UserDistributionMetric {
  nb_tasks: number;
  percentage: number;
  user: string;
}

/** Task distribution by assignee (port of `Kanboard\Analytic\UserDistributionAnalytic`). */
export class UserDistributionAnalytic extends BaseAnalytic {
  constructor(container: Container) {
    super(container);
  }

  /** Build the report for a project; empty when the project has no task. */
  async build(projectId: number): Promise<UserDistributionMetric[]> {
    const metrics = new Map<string, UserDistributionMetric>();
    let total = 0;

    const tasks = await this.collaborator('taskFinderModel').getAll(projectId);
    const users = await this.collaborator('projectUserRoleModel').getAssignableUsersList(projectId);

    for (const task of tasks) {
      const user = users[task['owner_id'] as number] ?? users[0] ?? '';
      total++;

      let metric = metrics.get(user);
      if (metric === undefined) {
        metric = { nb_tasks: 0, percentage: 0, user };
        metrics.set(user, metric);
      }

      metric.nb_tasks++;
    }

    if (total === 0) {
      return [];
    }

    for (const metric of metrics.values()) {
      metric.percentage = round((metric.nb_tasks * 100) / total, 2);
    }

    // ksort($metrics): sort by user name (standard string comparison)
    return [...metrics.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, metric]) => metric);
  }
}
