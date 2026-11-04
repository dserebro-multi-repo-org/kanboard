import type { Paginator } from '../core/paginator.js';
import type { DashboardPagination } from './dashboard-pagination.js';
import type { ProjectPagination } from './project-pagination.js';
import type { SubtaskPagination } from './subtask-pagination.js';
import type { TaskPagination } from './task-pagination.js';
import type { UserPagination } from './user-pagination.js';

declare module '../core/container/container.js' {
  interface ServiceRegistry {
    paginator: Paginator;
    dashboardPagination: DashboardPagination;
    projectPagination: ProjectPagination;
    subtaskPagination: SubtaskPagination;
    taskPagination: TaskPagination;
    userPagination: UserPagination;
  }
}
