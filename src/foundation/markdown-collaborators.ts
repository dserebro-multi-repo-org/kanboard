/**
 * Contracts of the collaborators of `Core\Markdown` that are not migrated yet (`Decorator\UserCacheDecorator`,
 * `Helper\UrlHelper`, `Model\TaskFinderModel`). The real classes satisfy them structurally; they are
 * registered in the container under the PHP service names (`userCacheDecorator`, `helper` -> `url`,
 * `taskFinderModel`) and may be sync or async.
 */

type MaybePromise<T> = T | Promise<T>;

/** `UrlHelper::to()`. */
export interface UrlHelperLike {
  to(controller: string, action: string, params?: Record<string, string | number>, anchor?: string, absolute?: boolean): MaybePromise<string>;
}

/** Subset of `UserCacheDecorator` (`getByUsername`). */
export interface UserCacheDecoratorLike {
  getByUsername(username: string): MaybePromise<{ id: number | string; username: string; name?: string | null } | null | undefined | false>;
}

/** Subset of `TaskFinderModel` (`getProjectToken`). */
export interface TaskFinderModelLike {
  getProjectToken(taskId: number | string): MaybePromise<string | null | undefined | false>;
}
