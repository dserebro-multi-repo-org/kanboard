import type { Container } from '../core/container/container.js';
import type { Paginator } from '../core/paginator.js';
import { TABLES } from '../foundation/model-constants.js';
import { BasePagination } from './base-pagination.js';

export interface DashboardOverviewItem {
  project_id: number;
  project_name: string;
  paginator: Paginator;
}

/** Dashboard Pagination (port of `Kanboard\Pagination\DashboardPagination`). */
export class DashboardPagination extends BasePagination {
  constructor(container: Container) {
    super(container);
  }

  /** Get the paginators of the tasks of every active project of the user. */
  async getOverview(userId: number): Promise<DashboardOverviewItem[]> {
    const paginators: DashboardOverviewItem[] = [];
    const projects = await this.collaborator('projectUserRoleModel').getActiveProjectsByUser(userId);
    const request = this.collaborator('request');

    for (const [key, projectName] of Object.entries(projects)) {
      const projectId = Number(key);
      const query = this.collaborator('taskFinderModel').getUserQuery(userId).eq(`${TABLES.PROJECT}.id`, projectId);
      this.service('hook').reference('pagination:dashboard:task:query', query);

      const paginator = await this.service('paginator')
        .setUrl(
          'DashboardController',
          'show',
          { user_id: userId, pagination: `tasks-${projectId}` },
          `project-tasks-${projectId}`,
        )
        .setMax(15)
        .setOrder(`${TABLES.TASK}.priority`)
        .setDirection('DESC')
        .setFormatter(this.service('taskListSubtaskAssigneeFormatter').withUserId(userId))
        .setQuery(query);

      paginator.calculateOnlyIf(request.getStringParam('pagination') === `tasks-${projectId}`);

      if (paginator.getTotal() > 0) {
        paginators.push({ project_id: projectId, project_name: projectName, paginator });
      }
    }

    return paginators;
  }
}
