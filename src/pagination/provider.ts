import type { Container, ServiceProvider } from '../core/container/container.js';
import { Paginator } from '../core/paginator.js';
import { DashboardPagination } from './dashboard-pagination.js';
import { ProjectPagination } from './project-pagination.js';
import { SubtaskPagination } from './subtask-pagination.js';
import { TaskPagination } from './task-pagination.js';
import { UserPagination } from './user-pagination.js';
import './registry.js';

/** Registers the paginator (a new instance per access) and the pagination classes. */
export class PaginationServiceProvider implements ServiceProvider {
  register(container: Container): void {
    container.factory('paginator', (c) => new Paginator(c));
    container.factory('dashboardPagination', (c) => new DashboardPagination(c));
    container.factory('projectPagination', (c) => new ProjectPagination(c));
    container.factory('subtaskPagination', (c) => new SubtaskPagination(c));
    container.factory('taskPagination', (c) => new TaskPagination(c));
    container.factory('userPagination', (c) => new UserPagination(c));
  }
}
