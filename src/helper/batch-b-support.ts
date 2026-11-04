import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import type { HelperInterface, HelperRegistry } from '../foundation/helper.js';
import type { UserSessionInterface } from '../foundation/user-session.js';
import { t } from '../core/translator/functions.js';

/*
 * Support module of the batch B helpers (User, Task, Subtask, Board, Comment, Date, Avatar, ProjectActivity,
 * ProjectHeader, ProjectRole). It contains
 *   - tiny PHP semantic utilities (empty, range, loose equality ...);
 *   - narrow interfaces of the collaborators that are not migrated yet, with compiling stubs. Each stub is
 *     resolved lazily: when the container registers a service under the same name it wins, otherwise the stub is
 *     used. Stubs are removed in M15, the owning milestone is recorded on each interface.
 */

/** A PHP associative array (task, project, user, subtask ... row). */
export type Rec = Record<string, unknown>;

export type MaybePromise<T> = T | Promise<T>;

/* ------------------------------------------------------------------------------------------------------------ */
/* PHP semantics                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

/** PHP `empty()`. */
export function empty(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === '' || value === '0') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** PHP `$a ?: $b`. */
export function elvis<T, U>(value: T, fallback: U): T | U {
  return empty(value) ? fallback : value;
}

/** PHP string conversion of a scalar. */
export function str(value: unknown): string {
  if (value === undefined || value === null || value === false) return '';
  if (value === true) return '1';
  return String(value);
}

/** PHP loose equality (`==`) restricted to scalars: numeric strings compare as numbers. */
export function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'boolean' || typeof b === 'boolean') return !empty(a) === !empty(b);
  if (a === null || a === undefined) return b === null || b === undefined || b === '' || b === 0;
  if (b === null || b === undefined) return a === '' || a === 0;
  const numeric = (v: unknown): boolean => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
  if (numeric(a) && numeric(b)) return Number(a) === Number(b);
  return str(a) === str(b);
}

/** PHP `range($start, $end)` for numeric bounds (ascending or descending, step 1). */
export function range(start: unknown, end: unknown): number[] {
  const from = Number(start);
  const to = Number(end);
  const out: number[] = [];
  if (from <= to) for (let i = from; i <= to; i++) out.push(i);
  else for (let i = from; i >= to; i--) out.push(i);
  return out;
}

/**
 * PHP `filter_var($value, FILTER_VALIDATE_URL) !== false`: a scheme, a host (except for mailto/news/file/urn)
 * and only ASCII printable characters.
 */
export function isValidUrl(value: string): boolean {
  if (!/^[\x21-\x7e]+$/.test(value)) return false;
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/.exec(value);
  if (match === null) return false;
  const scheme = (match[1] as string).toLowerCase();
  const rest = match[2] as string;
  if (['mailto', 'news', 'file', 'urn'].includes(scheme)) return rest !== '' || scheme === 'file';
  if (!rest.startsWith('//')) return false;
  const authority = (/^\/\/([^/?#]*)/.exec(rest)?.[1] ?? '').replace(/^[^@]*@/, '');
  const host = authority.replace(/:\d*$/, '');
  if (host === '') return false;
  if (scheme === 'http' || scheme === 'https') {
    if (/^\[[0-9a-fA-F:.]+\]$/.test(host)) return true;
    return /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?)*\.?$/.test(host);
  }
  return true;
}

/** Port of `convert_php_size_to_bytes()`. */
export function convertPhpSizeToBytes(value: string): number {
  const unit = value.replace(/[^bkmgtpezy]/gi, '').toUpperCase();
  let size = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(size)) size = 0;
  if (unit === 'G') size *= 1024 * 1024 * 1024;
  else if (unit === 'M') size *= 1024 * 1024;
  else if (unit === 'K') size *= 1024;
  return size;
}

/**
 * Port of `get_upload_max_size()`; the PHP `upload_max_filesize` / `post_max_size` ini values are read from the
 * environment variables `UPLOAD_MAX_FILESIZE` / `POST_MAX_SIZE`, with the PHP defaults (2M / 8M).
 */
export function getUploadMaxSize(env: NodeJS.ProcessEnv = process.env): number {
  const uploadMax = convertPhpSizeToBytes(env.UPLOAD_MAX_FILESIZE ?? '2M');
  const postMax = convertPhpSizeToBytes(env.POST_MAX_SIZE ?? '8M');
  if (postMax === 0) return uploadMax;
  if (uploadMax === 0) return postMax;
  return Math.min(postMax, uploadMax);
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Roles (app/Core/Security/Role.php, fully ported: it has no dependency)                                        */
/* ------------------------------------------------------------------------------------------------------------ */

export const Role = {
  APP_ADMIN: 'app-admin',
  APP_MANAGER: 'app-manager',
  APP_USER: 'app-user',
  APP_PUBLIC: 'app-public',
  PROJECT_MANAGER: 'project-manager',
  PROJECT_MEMBER: 'project-member',
  PROJECT_VIEWER: 'project-viewer',
} as const;

/** Port of the `Role` service methods used by the helpers. Owning milestone of the final class: M5 (security). */
export class RoleService {
  getApplicationRoles(): Record<string, string> {
    return {
      [Role.APP_ADMIN]: t('Administrator'),
      [Role.APP_MANAGER]: t('Manager'),
      [Role.APP_USER]: t('User'),
    };
  }

  getProjectRoles(): Record<string, string> {
    return {
      [Role.PROJECT_MANAGER]: t('Project Manager'),
      [Role.PROJECT_MEMBER]: t('Project Member'),
      [Role.PROJECT_VIEWER]: t('Project Viewer'),
    };
  }

  isCustomProjectRole(role: unknown): boolean {
    return !empty(role) && role !== Role.PROJECT_MANAGER && role !== Role.PROJECT_MEMBER && role !== Role.PROJECT_VIEWER;
  }

  getRoleName(role: string): string {
    const roles = { ...this.getApplicationRoles(), ...this.getProjectRoles() };
    return Object.hasOwn(roles, role) ? (roles[role] as string) : t('Unknown');
  }
}

/** Constants of `ProjectRoleRestrictionModel` / `ColumnRestrictionModel` / `UserMetadataModel` / `SubtaskModel`. */
export const ProjectRoleRestriction = {
  RULE_TASK_CREATION: 'task_creation',
  RULE_TASK_SUPPRESSION: 'task_remove',
  RULE_TASK_OPEN_CLOSE: 'task_open_close',
  RULE_TASK_MOVE: 'task_move',
  RULE_TASK_CHANGE_ASSIGNEE: 'task_change_assignee',
  RULE_TASK_UPDATE_ASSIGNED: 'task_update_assigned',
} as const;

export const ColumnRestriction = {
  RULE_ALLOW_TASK_CREATION: 'allow.task_creation',
  RULE_ALLOW_TASK_OPEN_CLOSE: 'allow.task_open_close',
  RULE_BLOCK_TASK_CREATION: 'block.task_creation',
  RULE_BLOCK_TASK_OPEN_CLOSE: 'block.task_open_close',
} as const;

export const UserMetadataKeys = {
  KEY_COMMENT_SORTING_DIRECTION: 'comment.sorting.direction',
  KEY_BOARD_COLLAPSED: 'board.collapsed.',
  KEY_TASK_SEARCH_ALL_FIELDS: 'task.search.all.fields',
} as const;

export const SubtaskStatus = { STATUS_TODO: 0, STATUS_INPROGRESS: 1, STATUS_DONE: 2 } as const;

/** `ProjectActivityModel::TABLE`. */
export const PROJECT_ACTIVITY_TABLE = 'project_activities';

/* ------------------------------------------------------------------------------------------------------------ */
/* Sibling helpers (batch A), narrow views                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

export type Options = Record<string | number, unknown> | Map<string | number, unknown>;

/** `app/Helper/FormHelper.php` (batch A). */
export interface FormHelperLike {
  label(label: string, name: string, attributes?: string[]): string;
  text(name: string, values?: Rec, errors?: Rec, attributes?: string[], cssClass?: string): string;
  textarea(name: string, values?: Rec, errors?: Rec, attributes?: string[], cssClass?: string): string;
  textEditor(name: string, values?: Rec, errors?: Rec, attributes?: Rec): string;
  select(name: string, options: Options, values?: Rec, errors?: Rec, attributes?: string[], cssClass?: string): string;
  colorSelect(name: string, values: Rec): string;
  number(name: string, values?: Rec, errors?: Rec, attributes?: string[], cssClass?: string): string;
  numeric(name: string, values?: Rec, errors?: Rec, attributes?: string[], cssClass?: string): string;
  hidden(name: string, values?: Rec): string;
  datetime(label: string, name: string, values: Rec, errors?: Rec, attributes?: string[]): string;
}

/** `app/Helper/TextHelper.php` (batch A). */
export interface TextHelperLike {
  e(value: unknown): string;
  markdown(text: string, isPublicLink?: boolean): string;
  bytes(size: number, precision?: number): string;
}

/** `app/Helper/UrlHelper.php` (batch A). */
export interface UrlHelperLike {
  href(controller: string, action: string, params?: Rec, csrf?: boolean, anchor?: string, absolute?: boolean): string;
  link(label: string, controller: string, action: string, params?: Rec, csrf?: boolean, cssClass?: string, title?: string, newTab?: boolean, anchor?: string, absolute?: boolean): string;
  icon(icon: string, label: string, controller: string, action: string, params?: Rec, csrf?: boolean, cssClass?: string, title?: string, newTab?: boolean, anchor?: string, absolute?: boolean): string;
}

/** `app/Helper/ModalHelper.php` (batch A). */
export interface ModalHelperLike {
  large(icon: string, label: string, controller: string, action: string, params?: Rec): string;
  largeIcon(icon: string, label: string, controller: string, action: string, params?: Rec): string;
}

/** `app/Helper/AppHelper.php` (batch A). */
export interface AppHelperLike {
  component(name: string, params?: Rec): string;
}

/** Resolve a registered sibling helper from the helper registry. */
export function sibling<H>(registry: HelperRegistry, name: string): H {
  return registry.get(name) as unknown as H;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Not yet migrated collaborators                                                                               */
/* ------------------------------------------------------------------------------------------------------------ */

/** Extended contract of `app/Core/User/UserSession.php`. Owning milestone: M5 (authentication). */
export interface UserSessionLike extends UserSessionInterface {
  getTheme(): string;
  hasSubtaskListActivated(): boolean;
  getAll(): Rec;
  isAdmin(): boolean;
  isLogged(): boolean;
  getRole(): string;
  getFilters(projectId: unknown): string;
  setFilters(projectId: unknown, filters: string): void;
}

/** Complete a (possibly partial) user session service with defaults for a nobody logged in session. */
export function completeUserSession(base: UserSessionInterface): UserSessionLike {
  const part = base as Partial<UserSessionLike> & UserSessionInterface;
  return {
    getId: () => part.getId(),
    getTheme: () => part.getTheme?.() ?? 'light',
    hasSubtaskListActivated: () => part.hasSubtaskListActivated?.() ?? false,
    getAll: () => part.getAll?.() ?? {},
    isAdmin: () => part.isAdmin?.() ?? false,
    isLogged: () => part.isLogged?.() ?? false,
    getRole: () => part.getRole?.() ?? '',
    getFilters: (projectId) => part.getFilters?.(projectId) ?? 'status:open',
    setFilters: (projectId, filters) => part.setFilters?.(projectId, filters),
  };
}

/** `session_is_true()` of `app/functions.php`. Owning milestone: M5 (session handling). */
export interface SessionFlagsLike {
  isTrue(key: string): boolean;
}

/** `UserUnreadNotificationModel`. Owning milestone: M13 (notifications). */
export interface UserUnreadNotificationModelLike {
  hasNotifications(userId: number): MaybePromise<boolean>;
}

/** `GroupMemberModel`. Owning milestone: M5 (users and groups). */
export interface GroupMemberModelLike {
  getGroups(userId: unknown): MaybePromise<Rec[]>;
}

/** `ApplicationAuthorization` / `ProjectAuthorization` (access map based). Owning milestone: M5. */
export interface AuthorizationLike {
  isAllowed(controller: string, action: string, role: string): boolean;
}

/** `ProjectUserRoleModel`. Owning milestone: M5 (project permissions). */
export interface ProjectUserRoleModelLike {
  getUserRole(projectId: unknown, userId: unknown): MaybePromise<string>;
  getActiveProjectsByUser(userId: unknown): MaybePromise<Rec>;
  getAssignableUsersList(projectId: unknown, withUnassigned?: boolean): MaybePromise<Rec>;
}

/** `ColumnMoveRestrictionCacheDecorator`. Owning milestone: M5 (project role restrictions). */
export interface ColumnMoveRestrictionCacheDecoratorLike {
  getSortableColumns(projectId: unknown, role: string): MaybePromise<Rec[]>;
}

/** `ColumnRestrictionCacheDecorator` / `ProjectRoleRestrictionCacheDecorator`. Owning milestone: M5. */
export interface RestrictionCacheDecoratorLike {
  getAllByRole(projectId: unknown, role: string): MaybePromise<Rec[]>;
}

/** `UserMetadataCacheDecorator`. Owning milestone: M5 (user metadata). */
export interface UserMetadataCacheDecoratorLike {
  get(key: string, defaultValue?: unknown): MaybePromise<unknown>;
  set(key: string, value: unknown): MaybePromise<unknown>;
}

/** `ColorModel`. Owning milestone: M4 (task model family). */
export interface ColorModelLike {
  getList(): MaybePromise<Rec>;
}

/** `TaskRecurrenceModel`. Owning milestone: M4. */
export interface TaskRecurrenceModelLike {
  getRecurrenceTriggerList(): MaybePromise<Rec>;
  getRecurrenceTimeframeList(): MaybePromise<Rec>;
  getRecurrenceBasedateList(): MaybePromise<Rec>;
}

/** `PredefinedTaskDescriptionModel`. Owning milestone: M4. */
export interface PredefinedTaskDescriptionModelLike {
  getAll(projectId: unknown): MaybePromise<Rec[]>;
}

/** `TagModel`. Owning milestone: M4. */
export interface TagModelLike {
  getAssignableList(projectId: unknown, enableGlobalTags: unknown): MaybePromise<string[] | Record<string, string>>;
}

/** `ColumnModel`. Owning milestone: M3 (project, board). */
export interface ColumnModelLike {
  getList(projectId: unknown): MaybePromise<Rec>;
}

/** `TaskModel::getProgress()`. Owning milestone: M4. */
export interface TaskModelLike {
  getProgress(task: Rec, columns: Rec): MaybePromise<number>;
}

/** `ExternalTask\ExternalTaskProviderInterface`. Owning milestone: M4. */
export interface ExternalTaskProviderLike {
  getName(): string;
  getIcon(): string;
  getMenuAddLabel(): string;
}

/** `ExternalTask\ExternalTaskManager`. Owning milestone: M4. */
export interface ExternalTaskManagerLike {
  getProviders(): ExternalTaskProviderLike[];
}

/** `Core\User\Avatar\AvatarManager`. Owning milestone: M5. */
export interface AvatarManagerLike {
  render(userId: unknown, username: unknown, name: unknown, email: unknown, avatarPath: unknown, size: number): string;
  renderDefault(size: number): string;
}

/** `Core\Http\Request`. Owning milestone: M8 (controllers); only `getStringParam` is needed. */
export interface RequestLike {
  getStringParam(name: string, defaultValue?: string): string;
}

/** `Core\Template`. Owning milestone: M7 (template engine, concurrent task). */
export interface TemplateLike {
  render(name: string, vars?: Rec): MaybePromise<string>;
}

/** `Core\Security\Token`. Owning milestone: M5. */
export interface TokenLike {
  getReusableCSRFToken(): string;
}

/** `Core\Date\DateParser`. Owning milestone: M5 (needs configModel). */
export interface DateParserLike {
  getUserDateTimeFormat(): MaybePromise<string>;
}

/** `CategoryModel`. Owning milestone: M3. */
export interface CategoryModelLike {
  getList(projectId: unknown, prepend?: boolean, addAllCategories?: boolean): MaybePromise<Rec>;
}

/** `CustomFilterModel`. Owning milestone: M3. */
export interface CustomFilterModelLike {
  getAll(projectId: unknown, userId: unknown): MaybePromise<Rec[]>;
}

/** Activity filters (`app/Filter/ProjectActivity*Filter.php`). Owning milestone: M4 (filters/formatters). */
export class ProjectActivityProjectIdFilter {
  constructor(readonly projectId: unknown) {}
}
export class ProjectActivityProjectIdsFilter {
  constructor(readonly projectIds: unknown[]) {}
}
export class ProjectActivityTaskIdFilter {
  constructor(readonly taskId: unknown) {}
}
export type ProjectActivityFilterLike = ProjectActivityProjectIdFilter | ProjectActivityProjectIdsFilter | ProjectActivityTaskIdFilter;

/** Query part of the project activity query builder (`desc` / `limit`, chainable). */
export interface ActivityQueryLike {
  desc(column: string): ActivityQueryLike;
  limit(limit: number): ActivityQueryLike;
}

/** `Core\Filter\QueryBuilder` as used for the project activity. Owning milestone: M4. */
export interface ActivityQueryBuilderLike {
  withFilter(filter: ProjectActivityFilterLike): ActivityQueryBuilderLike;
  getQuery(): ActivityQueryLike;
  format(formatter: unknown): MaybePromise<Rec[]>;
}

/** `ProjectActivityLexer`. Owning milestone: M4. */
export interface ProjectActivityLexerLike {
  build(search: string): ActivityQueryBuilderLike;
}

export interface BatchBCollaborators {
  session: SessionFlagsLike;
  role: RoleService;
  userUnreadNotificationModel: UserUnreadNotificationModelLike;
  groupMemberModel: GroupMemberModelLike;
  applicationAuthorization: AuthorizationLike;
  projectAuthorization: AuthorizationLike;
  projectUserRoleModel: ProjectUserRoleModelLike;
  columnMoveRestrictionCacheDecorator: ColumnMoveRestrictionCacheDecoratorLike;
  columnRestrictionCacheDecorator: RestrictionCacheDecoratorLike;
  projectRoleRestrictionCacheDecorator: RestrictionCacheDecoratorLike;
  userMetadataCacheDecorator: UserMetadataCacheDecoratorLike;
  colorModel: ColorModelLike;
  taskRecurrenceModel: TaskRecurrenceModelLike;
  predefinedTaskDescriptionModel: PredefinedTaskDescriptionModelLike;
  tagModel: TagModelLike;
  columnModel: ColumnModelLike;
  taskModel: TaskModelLike;
  externalTaskManager: ExternalTaskManagerLike;
  avatarManager: AvatarManagerLike;
  request: RequestLike;
  template: TemplateLike;
  token: TokenLike;
  dateParser: DateParserLike;
  categoryModel: CategoryModelLike;
  customFilterModel: CustomFilterModelLike;
  projectActivityLexer: ProjectActivityLexerLike;
  projectActivityQuery: ActivityQueryBuilderLike;
  projectActivityEventFormatter: object;
}

const emptyQuery: ActivityQueryLike = {
  desc: () => emptyQuery,
  limit: () => emptyQuery,
};

const emptyBuilder: ActivityQueryBuilderLike = {
  withFilter: () => emptyBuilder,
  getQuery: () => emptyQuery,
  format: () => [],
};

/** Compiling stubs (nobody logged in, nothing stored). Removed in M15. */
const STUBS: { [K in keyof BatchBCollaborators]: () => BatchBCollaborators[K] } = {
  session: () => ({ isTrue: () => false }),
  role: () => new RoleService(),
  userUnreadNotificationModel: () => ({ hasNotifications: () => false }),
  groupMemberModel: () => ({ getGroups: () => [] }),
  // Deny by default: the access map arrives with M5.
  applicationAuthorization: () => ({ isAllowed: () => false }),
  projectAuthorization: () => ({ isAllowed: () => false }),
  projectUserRoleModel: () => ({
    getUserRole: () => '',
    getActiveProjectsByUser: () => ({}),
    getAssignableUsersList: () => ({}),
  }),
  columnMoveRestrictionCacheDecorator: () => ({ getSortableColumns: () => [] }),
  columnRestrictionCacheDecorator: () => ({ getAllByRole: () => [] }),
  projectRoleRestrictionCacheDecorator: () => ({ getAllByRole: () => [] }),
  userMetadataCacheDecorator: () => {
    const store = new Map<string, unknown>();
    return {
      get: (key, defaultValue = '') => (store.has(key) ? store.get(key) : defaultValue),
      set: (key, value) => void store.set(key, value),
    };
  },
  colorModel: () => ({ getList: () => ({}) }),
  taskRecurrenceModel: () => ({
    getRecurrenceTriggerList: () => ({}),
    getRecurrenceTimeframeList: () => ({}),
    getRecurrenceBasedateList: () => ({}),
  }),
  predefinedTaskDescriptionModel: () => ({ getAll: () => [] }),
  tagModel: () => ({ getAssignableList: () => [] }),
  columnModel: () => ({ getList: () => ({}) }),
  taskModel: () => ({ getProgress: () => 0 }),
  externalTaskManager: () => ({ getProviders: () => [] }),
  avatarManager: () => ({ render: () => '', renderDefault: () => '' }),
  request: () => ({ getStringParam: (_name, defaultValue = '') => defaultValue }),
  template: () => ({ render: () => '' }),
  token: () => ({ getReusableCSRFToken: () => '' }),
  dateParser: () => ({ getUserDateTimeFormat: () => 'm/d/Y H:i' }),
  categoryModel: () => ({ getList: () => ({}) }),
  customFilterModel: () => ({ getAll: () => [] }),
  projectActivityLexer: () => ({ build: () => emptyBuilder }),
  projectActivityQuery: () => emptyBuilder,
  projectActivityEventFormatter: () => ({}),
};

const stubCache = new WeakMap<object, Map<string, unknown>>();

/**
 * Resolve a not yet migrated collaborator: the service registered in the container under `key` when there is
 * one, otherwise the compiling stub (cached per container).
 */
export function collaborator<K extends keyof BatchBCollaborators>(container: Container, key: K): BatchBCollaborators[K] {
  const loose = container as unknown as Container<Record<string, unknown>>;
  if (loose.has(key)) return loose.get(key) as BatchBCollaborators[K];

  let cache = stubCache.get(container);
  if (cache === undefined) {
    cache = new Map();
    stubCache.set(container, cache);
  }
  if (!cache.has(key)) cache.set(key, STUBS[key]());
  return cache.get(key) as BatchBCollaborators[K];
}

/** Base class of the batch B helpers: `Core\Base` with the helper registry and collaborator accessors. */
export abstract class BatchBHelper extends Base implements HelperInterface {
  protected get helper(): HelperRegistry {
    return this.service('helper');
  }

  protected get userSession(): UserSessionLike {
    return completeUserSession(this.service('userSession'));
  }

  protected collab<K extends keyof BatchBCollaborators>(key: K): BatchBCollaborators[K] {
    return collaborator(this.container, key);
  }

  protected get text(): TextHelperLike {
    return sibling<TextHelperLike>(this.helper, 'text');
  }

  protected get form(): FormHelperLike {
    return sibling<FormHelperLike>(this.helper, 'form');
  }

  protected get url(): UrlHelperLike {
    return sibling<UrlHelperLike>(this.helper, 'url');
  }
}
