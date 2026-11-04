import type { Container } from '../core/container/container.js';
import type { Paginator } from '../core/paginator.js';
import { TABLES } from '../foundation/model-constants.js';
import { BasePagination } from './base-pagination.js';

/** Project Pagination (port of `Kanboard\Pagination\ProjectPagination`). */
export class ProjectPagination extends BasePagination {
  constructor(container: Container) {
    super(container);
  }

  /** Get the dashboard pagination of the projects of a user. */
  async getDashboardPaginator(userId: number, method: string, max: number): Promise<Paginator> {
    const projectIds = await this.collaborator('projectPermissionModel').getActiveProjectIds(userId);
    const query = this.collaborator('projectModel').getQueryColumnStats(projectIds);
    this.service('hook').reference('pagination:dashboard:project:query', query);

    const paginator = await this.service('paginator')
      .setUrl('DashboardController', method, { pagination: 'projects', user_id: userId })
      .setMax(max)
      .setOrder(`${TABLES.PROJECT}.name`)
      .setQuery(query);

    return paginator.calculateOnlyIf(this.collaborator('request').getStringParam('pagination') === 'projects');
  }
}
