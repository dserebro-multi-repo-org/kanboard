import { empty, elvis, BatchBHelper, type Rec } from './batch-b-support.js';
import type { ProjectRoleHelper } from './project-role-helper.js';

/** Port of `app/Helper/UserHelper.php`. */
export class UserHelper extends BatchBHelper {
  getTheme(): string {
    return this.userSession.getTheme();
  }

  /** Return subtask list toggle value. */
  hasSubtaskListActivated(): boolean {
    return this.userSession.hasSubtaskListActivated();
  }

  /** Return true if the logged user has unread notifications. */
  async hasNotifications(): Promise<boolean> {
    return this.collab('userUnreadNotificationModel').hasNotifications(this.userSession.getId());
  }

  /** Get initials from a user name. */
  getInitials(name: string): string {
    const index = name.indexOf(' ');
    const parts = index < 0 ? [name] : [name.slice(0, index), name.slice(index + 1)];
    let initials = '';

    for (const part of parts) {
      initials += Array.from(part)[0] ?? '';
    }

    return initials.toUpperCase();
  }

  /** Return the user full name. */
  getFullname(user: Rec = {}): string {
    const row = empty(user) ? this.userSession.getAll() : user;
    return String(elvis(row.name, row.username) ?? '');
  }

  getId(): number {
    return this.userSession.getId();
  }

  /** Check if the given user_id is the connected user. */
  isCurrentUser(userId: unknown): boolean {
    return this.userSession.getId() === Number(userId);
  }

  isAdmin(): boolean {
    return this.userSession.isAdmin();
  }

  getRole(): string {
    return this.userSession.getRole();
  }

  getRoleName(role = ''): string {
    return this.collab('role').getRoleName(elvis(role, this.userSession.getRole()));
  }

  /** Get group names for a given user. */
  async getUsersGroupNames(userId: unknown): Promise<{
    full_list: string[];
    limited_list: string[];
    has_groups: boolean;
    total: number;
    shown: number;
  }> {
    const groupsList = (await this.collab('groupMemberModel').getGroups(userId)).map((group) => group.name as string);
    let limitedList = groupsList;
    const total = groupsList.length;
    const limit = this.service('config').SHOW_GROUP_MEMBERSHIPS_IN_USERLIST_WITH_LIMIT;

    if (total > 0 && limit > 0) {
      limitedList = groupsList.slice(0, limit);
    }

    return {
      full_list: groupsList,
      limited_list: limitedList,
      has_groups: total > 0,
      total,
      shown: limitedList.length,
    };
  }

  /** Check application access. */
  hasAccess(controller: string, action: string): boolean {
    if (!this.userSession.isLogged()) {
      return false;
    }

    const memoryCache = this.service('memoryCache');
    const key = `app_access:${controller}${action}`;
    let result = memoryCache.get<boolean>(key);

    if (result === null) {
      result = this.collab('applicationAuthorization').isAllowed(controller, action, this.userSession.getRole());
      memoryCache.set(key, result);
    }

    return result;
  }

  /** Check project access. */
  async hasProjectAccess(controller: string, action: string, projectId: unknown): Promise<boolean> {
    const memoryCache = this.service('memoryCache');
    const key = `project_access:${controller}${action}${String(projectId)}`;
    let result = memoryCache.get<boolean>(key);

    if (result === null) {
      result = await this.helper.get<ProjectRoleHelper>('projectRole').checkProjectAccess(controller, action, projectId);
      memoryCache.set(key, result);
    }

    return result;
  }
}
