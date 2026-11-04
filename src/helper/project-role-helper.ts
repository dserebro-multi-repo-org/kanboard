import {
  BatchBHelper,
  ColumnRestriction,
  ProjectRoleRestriction,
  Role,
  looseEq,
  type ProjectUserRoleModelLike,
  type Rec,
} from './batch-b-support.js';
import type { UserHelper } from './user-helper.js';

/** Port of `app/Helper/ProjectRoleHelper.php`. */
export class ProjectRoleHelper extends BatchBHelper {
  private get userHelper(): UserHelper {
    return this.helper.get<UserHelper>('user');
  }

  /** Get project role for the current user. */
  async getProjectUserRole(projectId: unknown): Promise<string> {
    return this.service('memoryCache').proxy<ProjectUserRoleModelLike, Promise<string>>(
      this.collab('projectUserRoleModel'),
      'getUserRole',
      projectId,
      this.userSession.getId(),
    );
  }

  /** Return true if the task can be moved by the logged user. */
  async isDraggable(task: Rec): Promise<boolean> {
    if (looseEq(task.is_active, 1) && (await this.userHelper.hasProjectAccess('BoardAjaxController', 'save', task.project_id))) {
      return this.isSortableColumn(task.project_id, task.column_id, task.owner_id);
    }

    return false;
  }

  /** Return true is the column is sortable. */
  async isSortableColumn(projectId: unknown, columnId: unknown, assigneeId: unknown = null): Promise<boolean> {
    const role = await this.getProjectUserRole(projectId);

    if (this.collab('role').isCustomProjectRole(role)) {
      const sortableColumns = await this.collab('columnMoveRestrictionCacheDecorator').getSortableColumns(projectId, role);

      for (const column of sortableColumns) {
        if (looseEq(column.src_column_id, columnId) || looseEq(column.dst_column_id, columnId)) {
          if (looseEq(column.only_assigned, 1) && assigneeId !== null && !looseEq(assigneeId, this.userSession.getId())) {
            return false;
          }

          return true;
        }
      }

      return sortableColumns.length === 0 && (await this.isAllowedToMoveTask(projectId, role));
    }

    return true;
  }

  /** Check if the user can move a task. */
  async canMoveTask(projectId: unknown, srcColumnId: unknown, dstColumnId: unknown): Promise<boolean> {
    const role = await this.getProjectUserRole(projectId);

    if (this.collab('role').isCustomProjectRole(role)) {
      if (looseEq(srcColumnId, dstColumnId)) {
        return true;
      }

      const sortableColumns = await this.collab('columnMoveRestrictionCacheDecorator').getSortableColumns(projectId, role);

      for (const column of sortableColumns) {
        if (looseEq(column.src_column_id, srcColumnId) && looseEq(column.dst_column_id, dstColumnId)) {
          return true;
        }

        if (looseEq(column.dst_column_id, srcColumnId) && looseEq(column.src_column_id, dstColumnId)) {
          return true;
        }
      }

      return sortableColumns.length === 0 && (await this.isAllowedToMoveTask(projectId, role));
    }

    return true;
  }

  /** Return true if the user can create a task for the given column. */
  async canCreateTaskInColumn(projectId: unknown, columnId: unknown): Promise<boolean> {
    const role = await this.getProjectUserRole(projectId);

    if (this.collab('role').isCustomProjectRole(role)) {
      if (!(await this.isAllowedToCreateTask(projectId, columnId, role))) {
        return false;
      }
    }

    return this.userHelper.hasProjectAccess('TaskCreationController', 'show', projectId);
  }

  /** Return true if the user can change the task status for the given column. */
  async canChangeTaskStatusInColumn(projectId: unknown, columnId: unknown): Promise<boolean> {
    const role = await this.getProjectUserRole(projectId);

    if (this.collab('role').isCustomProjectRole(role)) {
      if (!(await this.isAllowedToChangeTaskStatus(projectId, columnId, role))) {
        return false;
      }
    }

    return this.userHelper.hasProjectAccess('TaskStatusController', 'close', projectId);
  }

  /** Return true if the user can remove a task. Regular users can't remove tasks from other people. */
  async canRemoveTask(task: Rec): Promise<boolean> {
    const role = await this.getProjectUserRole(task.project_id);

    if (await this.hasRestriction(task.project_id, role, ProjectRoleRestriction.RULE_TASK_SUPPRESSION)) {
      return false;
    }

    if (task.creator_id !== undefined && task.creator_id !== null && looseEq(task.creator_id, this.userSession.getId())) {
      return true;
    }

    if (this.userSession.isAdmin() || (await this.getProjectUserRole(task.project_id)) === Role.PROJECT_MANAGER) {
      return true;
    }

    return false;
  }

  /** Return true if the user can change assignee. */
  async canChangeAssignee(task: Rec): Promise<boolean> {
    const role = await this.getProjectUserRole(task.project_id);

    if (
      this.collab('role').isCustomProjectRole(role) &&
      (await this.hasRestriction(task.project_id, role, ProjectRoleRestriction.RULE_TASK_CHANGE_ASSIGNEE))
    ) {
      return false;
    }

    return true;
  }

  /** Return true if the user can update a task. */
  async canUpdateTask(task: Rec): Promise<boolean> {
    const role = await this.getProjectUserRole(task.project_id);

    if (
      this.collab('role').isCustomProjectRole(role) &&
      !looseEq(task.owner_id, this.userSession.getId()) &&
      (await this.hasRestriction(task.project_id, role, ProjectRoleRestriction.RULE_TASK_UPDATE_ASSIGNED))
    ) {
      return false;
    }

    return true;
  }

  /** Check project access. */
  async checkProjectAccess(controller: string, action: string, projectId: unknown): Promise<boolean> {
    if (!this.userSession.isLogged()) {
      return false;
    }

    if (this.userSession.isAdmin()) {
      return true;
    }

    if (!this.userHelper.hasAccess(controller, action)) {
      return false;
    }

    const role = await this.getProjectUserRole(projectId);
    const authorization = this.collab('projectAuthorization');

    if (this.collab('role').isCustomProjectRole(role)) {
      return authorization.isAllowed(controller, action, Role.PROJECT_MEMBER);
    }

    return authorization.isAllowed(controller, action, role);
  }

  /** Check authorization for a custom project role to change the task status. */
  protected async isAllowedToChangeTaskStatus(projectId: unknown, columnId: unknown, role: string): Promise<boolean> {
    const columnRestrictions = await this.collab('columnRestrictionCacheDecorator').getAllByRole(projectId, role);

    for (const restriction of columnRestrictions) {
      if (looseEq(restriction.column_id, columnId)) {
        if (restriction.rule === ColumnRestriction.RULE_ALLOW_TASK_OPEN_CLOSE) {
          return true;
        } else if (restriction.rule === ColumnRestriction.RULE_BLOCK_TASK_OPEN_CLOSE) {
          return false;
        }
      }
    }

    return !(await this.hasRestriction(projectId, role, ProjectRoleRestriction.RULE_TASK_OPEN_CLOSE));
  }

  /** Check authorization for a custom project role to create a task. */
  protected async isAllowedToCreateTask(projectId: unknown, columnId: unknown, role: string): Promise<boolean> {
    const columnRestrictions = await this.collab('columnRestrictionCacheDecorator').getAllByRole(projectId, role);

    for (const restriction of columnRestrictions) {
      if (looseEq(restriction.column_id, columnId)) {
        if (restriction.rule === ColumnRestriction.RULE_ALLOW_TASK_CREATION) {
          return true;
        } else if (restriction.rule === ColumnRestriction.RULE_BLOCK_TASK_CREATION) {
          return false;
        }
      }
    }

    return !(await this.hasRestriction(projectId, role, ProjectRoleRestriction.RULE_TASK_CREATION));
  }

  /** Check if the role can move task in the given project. */
  protected async isAllowedToMoveTask(projectId: unknown, role: string): Promise<boolean> {
    const projectRestrictions = await this.collab('projectRoleRestrictionCacheDecorator').getAllByRole(projectId, role);

    for (const restriction of projectRestrictions) {
      if (restriction.rule === ProjectRoleRestriction.RULE_TASK_MOVE) {
        return false;
      }
    }

    return true;
  }

  /** Check if given role has a restriction. */
  protected async hasRestriction(projectId: unknown, role: string, rule: string): Promise<boolean> {
    const projectRestrictions = await this.collab('projectRoleRestrictionCacheDecorator').getAllByRole(projectId, role);

    for (const restriction of projectRestrictions) {
      if (restriction.rule === rule) {
        return true;
      }
    }

    return false;
  }
}
