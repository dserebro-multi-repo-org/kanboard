/**
 * Compiling interfaces of the not-yet-migrated services the validators depend on
 * (models, session, authentication, date parser...). They describe only the methods the
 * validators call; the real services replace them as their milestones land (stubs removed in M15).
 */
import type { MaybePromise } from '../validator/simple-validator.js';

/** Application / project roles (`app/Core/Security/Role.php` constants). */
export const Role = {
  APP_ADMIN: 'app-admin',
  APP_MANAGER: 'app-manager',
  APP_USER: 'app-user',
  APP_PUBLIC: 'app-public',
  PROJECT_MANAGER: 'project-manager',
  PROJECT_MEMBER: 'project-member',
  PROJECT_VIEWER: 'project-viewer',
} as const;

/** A `id => label` list as returned by the `getList()` family of model methods. */
export type IdList = Record<string | number, string>;

export interface ColorModelLike {
  getList(): MaybePromise<IdList>;
}

export interface ColumnListModelLike {
  getList(projectId: number): MaybePromise<IdList>;
}

export interface ProjectUserRoleModelLike {
  getAssignableUsersList(projectId: number): MaybePromise<IdList>;
}

export interface ProjectPermissionModelLike {
  isUserAllowed(projectId: number, userId: number): MaybePromise<boolean>;
  isAssignable(projectId: number, userId: number): MaybePromise<boolean>;
}

export interface TaskFinderModelLike {
  getProjectId(taskId: number): MaybePromise<number>;
}

export interface TagModelLike {
  exists(projectId: number, name: string, tagId?: number): MaybePromise<boolean>;
}

export interface LanguageModelLike {
  getLanguages(): MaybePromise<IdList>;
}

export interface ThemeModelLike {
  getThemes(): MaybePromise<IdList>;
}

export interface RoleLike {
  getApplicationRoles(): IdList;
}

export interface EmailClientLike {
  getAvailableTransports(): IdList;
}

export interface DateParserLike {
  getDateFormats(iso?: boolean): string[];
  getTimeFormats(): string[];
  getParserFormats(): string[];
  /** Unix timestamp of a date string, 0 when it cannot be parsed. */
  getTimestamp(value: unknown): number;
}

export interface ValidatorUserSession {
  isLogged(): boolean;
  isAdmin(): boolean;
  getId(): number;
  getUsername(): string;
}

export interface AuthenticationManagerLike {
  passwordAuthentication(username: string, password: string, fireEvent?: boolean): MaybePromise<boolean>;
}

export interface UserLockingModelLike {
  isLocked(username: string): MaybePromise<boolean>;
  hasCaptcha(username: string): MaybePromise<boolean>;
}

export interface CaptchaModelLike {
  isLocked(ipAddress: string): MaybePromise<boolean>;
}

export interface RequestLike {
  getIpAddress(): string;
}

export interface LoggerLike {
  error(message: string): void;
}

/** Session storage used for the captcha phrase (PHP `session_exists/get/remove`). */
export interface ValidatorSession {
  exists(key: string): boolean;
  get(key: string): unknown;
  remove(key: string): void;
}
