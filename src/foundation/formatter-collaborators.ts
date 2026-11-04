import type { Container } from '../core/container/container.js';
import type { FilterQuery } from '../core/filter/filter-interface.js';
import type { Row } from './model.js';
import type { UserSessionInterface } from './user-session.js';
import type { HelperInterface } from './helper.js';

/**
 * Typed contracts of the collaborators used by formatters, pagination, analytics and cache decorators
 * (milestone 6) that belong to modules not migrated yet (task / project / user / board models, helpers,
 * template renderer, request). Each real class satisfies its contract structurally when migrated and
 * these contracts are then removed (M15). Database access of those models is asynchronous.
 */

/** Map `id -> label` (PHP `getList()` style results). */
export type IdLabelMap = Record<string | number, string>;

/** `Kanboard\Core\Security\Role` constants used by the formatters. */
export const ROLE = {
  APP_ADMIN: 'app-admin',
  APP_MANAGER: 'app-manager',
  APP_USER: 'app-user',
} as const;

/** `SwimlaneModel::ACTIVE`. */
export const SWIMLANE_ACTIVE = 1;

export interface ProjectModelLike {
  getById(projectId: number): Promise<Row>;
  /** Query used by the dashboard project listing. */
  getQueryColumnStats(projectIds: number[]): FilterQuery;
}

export interface SwimlaneModelLike {
  getAllByStatus(projectId: number, status: number): Promise<Row[]>;
}

export interface ColumnModelLike {
  getAllWithOpenedTaskCount(projectId: number): Promise<Row[]>;
  getAll(projectId: number): Promise<Row[]>;
  getList(projectId: number): Promise<IdLabelMap>;
}

export interface TaskModelLike {
  getOpenTaskCountBySwimlaneAndColumn(projectId: number): Promise<Row[]>;
}

export interface TaskFinderModelLike {
  getUserQuery(userId: number): FilterQuery;
  getExtendedQuery(): FilterQuery;
  getAll(projectId: number, statusId?: number): Promise<Row[]>;
  countByColumnId(projectId: number, columnId: number): Promise<number>;
}

export interface TaskTagModelLike {
  /** Tags grouped by task id. */
  getTagsByTaskIds(taskIds: number[]): Promise<Record<string | number, Row[]>>;
}

export interface SubtaskModelLike {
  getStatusList(): Record<string | number, string>;
  getAllByTaskIds(taskIds: number[]): Promise<Row[]>;
  getAllByTaskIdsAndAssignee(taskIds: number[], userId: number): Promise<Row[]>;
}

export interface ColorModelLikeForFormatters {
  getBackgroundColor(colorId: string): string;
  getBorderColor(colorId: string): string;
  getColorProperties(colorId: string): Row;
}

export interface ProjectUserRoleModelLike {
  /** Active projects of the user, `project id -> name`. */
  getActiveProjectsByUser(userId: number): Promise<IdLabelMap>;
  /** Assignable users of the project, `user id -> name` (id 0 is "Unassigned"). */
  getAssignableUsersList(projectId: number): Promise<IdLabelMap>;
}

export interface ProjectPermissionModelLike {
  getActiveProjectIds(userId: number): Promise<number[]>;
}

export interface TransitionModelLike {
  /** Seconds spent in every column by the task, `column id -> seconds`. */
  getTimeSpentByTask(taskId: number): Promise<Record<string | number, number>>;
}

export interface NotificationModelLike {
  getTitleWithAuthor(author: string, eventName: string, eventData: Row): string;
}

export interface UserModelLike {
  getQuery(): FilterQuery;
  getByUsername(username: string): Promise<Row | null | false>;
}

/** `MetadataModel` subclasses (`UserMetadataModel`, `ProjectMetadataModel`...). */
export interface MetadataModelLike {
  getAll(entityId: number): Promise<Record<string, string>>;
  save(entityId: number, values: Record<string, string>): Promise<boolean>;
}

export interface ColumnMoveRestrictionModelLike {
  getSortableColumns(projectId: number, role: string): Promise<unknown>;
}

export interface ColumnRestrictionModelLike {
  getAllByRole(projectId: number, role: string): Promise<unknown>;
}

export interface ProjectRoleRestrictionModelLike {
  getAllByRole(projectId: number, role: string): Promise<unknown>;
}

/** `Core\Template` (only `render` is used). */
export interface TemplateLike {
  render(name: string, params?: Row): string;
}

/** Subset of the HTTP `Request` used by the paginator. */
export interface PaginatorRequestLike {
  getStringParam(name: string, defaultValue?: string): string;
  getIntegerParam(name: string, defaultValue?: number): number;
}

/** `UserSession` with the role accessor. */
export interface RoleAwareUserSession extends UserSessionInterface {
  getRole(): string;
}

/** `Helper\UrlHelper` */
export interface UrlHelperLike extends HelperInterface {
  to(controller: string, action: string, params?: Row, anchor?: string, absolute?: boolean): string;
  link(
    label: string,
    controller: string,
    action: string,
    params?: Row,
    csrf?: boolean,
    cssClass?: string,
    title?: string,
    newTab?: boolean,
    anchor?: string,
  ): string;
  base(): string;
}

/** `Helper\TextHelper` */
export interface TextHelperLike extends HelperInterface {
  e(value: unknown): string;
  markdown(text: string, isPublicLink?: boolean): string;
}

/** `Helper\AvatarHelper` */
export interface AvatarHelperLike extends HelperInterface {
  small(userId: number, username: string, name: string, email: string, avatarPath: string, cssClass?: string): string;
}

/** `Helper\ProjectRoleHelper` */
export interface ProjectRoleHelperLike extends HelperInterface {
  isDraggable(task: Row): boolean;
}

/** `Core\User\UserProviderInterface` (used by the autocomplete formatter). */
export interface UserProviderLike {
  getInternalId(): number | string;
  getExternalId(): string;
  getExternalIdColumn(): string;
  getUsername(): string;
  getName(): string;
}

/** `Core\Group\GroupProviderInterface`. */
export interface GroupProviderLike {
  getInternalId(): number | string;
  getExternalId(): string;
  getName(): string;
}

/** Services of the not yet migrated modules, keyed by their PHP container key. */
export interface FormatterCollaborators {
  projectModel: ProjectModelLike;
  swimlaneModel: SwimlaneModelLike;
  columnModel: ColumnModelLike;
  taskModel: TaskModelLike;
  taskFinderModel: TaskFinderModelLike;
  taskTagModel: TaskTagModelLike;
  subtaskModel: SubtaskModelLike;
  colorModel: ColorModelLikeForFormatters;
  projectUserRoleModel: ProjectUserRoleModelLike;
  projectPermissionModel: ProjectPermissionModelLike;
  transitionModel: TransitionModelLike;
  notificationModel: NotificationModelLike;
  userModel: UserModelLike;
  userMetadataModel: MetadataModelLike;
  columnMoveRestrictionModel: ColumnMoveRestrictionModelLike;
  columnRestrictionModel: ColumnRestrictionModelLike;
  projectRoleRestrictionModel: ProjectRoleRestrictionModelLike;
  template: TemplateLike;
  request: PaginatorRequestLike;
  userSession: RoleAwareUserSession;
}

/** Resolve a not yet migrated collaborator from the container. */
export function collaborator<K extends keyof FormatterCollaborators>(
  container: Container,
  key: K,
): FormatterCollaborators[K] {
  return (container as unknown as Container<FormatterCollaborators>).get(key);
}
