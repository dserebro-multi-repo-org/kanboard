import type { Container } from '../core/container/container.js';
import type { Paginator } from '../core/paginator.js';
import { TABLES } from '../foundation/model-constants.js';
import { BasePagination } from './base-pagination.js';

/** Subtask Pagination (port of `Kanboard\Pagination\SubtaskPagination`). */
export class SubtaskPagination extends BasePagination {
  constructor(container: Container) {
    super(container);
  }

  /** Get the dashboard pagination of the subtasks of a user. */
  async getDashboardPaginator(userId: number): Promise<Paginator> {
    const query = this.collaborator('taskFinderModel').getUserQuery(userId);
    this.service('hook').reference('pagination:dashboard:subtask:query', query);

    const paginator = await this.service('paginator')
      .setUrl('DashboardController', 'subtasks', { user_id: userId })
      .setMax(50)
      .setOrder(`${TABLES.TASK}.priority`)
      .setDirection('DESC')
      .setFormatter(this.service('taskListSubtaskAssigneeFormatter').withUserId(userId).withoutEmptyTasks())
      .setQuery(query);

    return paginator.calculate();
  }
}
