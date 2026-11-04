import type { Container } from '../core/container/container.js';
import type { Paginator } from '../core/paginator.js';
import { TABLES } from '../foundation/model-constants.js';
import { BasePagination } from './base-pagination.js';

/** User Pagination (port of `Kanboard\Pagination\UserPagination`). */
export class UserPagination extends BasePagination {
  constructor(container: Container) {
    super(container);
  }

  /** Get the user listing pagination. */
  async getListingPaginator(): Promise<Paginator> {
    const paginator = await this.service('paginator')
      .setUrl('UserListController', 'show')
      .setMax(30)
      .setOrder(`${TABLES.USER}.username`)
      .setQuery(this.collaborator('userModel').getQuery());

    return paginator.calculate();
  }
}
