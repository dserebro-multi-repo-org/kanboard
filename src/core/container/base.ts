import type { Container, ServiceRegistry } from './container.js';

/**
 * Base class of everything that needs access to services (models, helpers, controllers,
 * subscribers, ...). Mirrors `app/Core/Base.php`, where `$this->taskModel` proxied to the
 * Pimple container. In TypeScript use the explicit, fully typed accessor:
 *
 * ```ts
 * class TaskModel extends Base { find(id: number) { return this.service('db').table('tasks'); } }
 * ```
 */
export class Base<R = ServiceRegistry> {
  /** The container is public so that `Base` subclasses satisfy `HelperInterface` / `BaseModelContract`. */
  constructor(readonly container: Container<R>) {}

  /** Resolve a service from the container. */
  protected service<K extends keyof R>(key: K): R[K] {
    return this.container.get(key);
  }

  /** Public accessor to the container (used by factories/plugins). */
  getContainer(): Container<R> {
    return this.container;
  }
}
