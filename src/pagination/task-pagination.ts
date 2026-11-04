import type { Container } from '../core/container/container.js';
import type { Paginator } from '../core/paginator.js';
import { TABLES } from '../foundation/model-constants.js';
import { BasePagination } from './base-pagination.js';

/** Task Pagination (port of `Kanboard\Pagination\TaskPagination`). */
export class TaskPagination extends BasePagination {
  constructor(container: Container) {
    super(container);
  }

  /** Get the dashboard pagination of the tasks of a user. */
  async getDashboardPaginator(userId: number, method: string, max: number): Promise<Paginator> {
    const query = this.collaborator('taskFinderModel').getUserQuery(userId);
    this.service('hook').reference('pagination:dashboard:task:query', query);

    const paginator = await this.service('paginator')
      .setUrl('DashboardController', method, { pagination: 'tasks', user_id: userId })
      .setMax(max)
      .setOrder(`${TABLES.TASK}.id`)
      .setQuery(query);

    return paginator
      .setFormatter(this.service('taskListFormatter'))
      .calculateOnlyIf(this.collaborator('request').getStringParam('pagination') === 'tasks');
  }
}
