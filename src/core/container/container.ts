/**
 * Typed service container replacing the Pimple container used by Kanboard
 * (`app/ServiceProvider/*`).
 *
 * Services are described by the {@link ServiceRegistry} interface which maps a service
 * key to its type. The interface is empty by default and is meant to be extended through
 * declaration merging, so every module (and every plugin) can declare the services it provides:
 *
 * ```ts
 * declare module '../core/container/container.js' {
 *   interface ServiceRegistry {
 *     taskModel: TaskModel;
 *   }
 * }
 * ```
 *
 * The container is also generic over its registry so it can be used with a custom map
 * (`new Container<{ a: number }>()`), which is what the unit tests do.
 */

/**
 * Registry mapping service keys to service types. Extend through declaration merging.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServiceRegistry {}

/** Factory building a service; receives the container to resolve dependencies lazily. */
export type ServiceFactory<R, K extends keyof R> = (container: Container<R>) => R[K];

/** Decorator wrapping an already registered service (Pimple `extend`). */
export type ServiceExtender<R, K extends keyof R> = (service: R[K], container: Container<R>) => R[K];

export class ContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContainerError';
  }
}

interface Definition<R, K extends keyof R> {
  factory: ServiceFactory<R, K>;
  shared: boolean;
}

export class Container<R = ServiceRegistry> {
  private readonly definitions = new Map<keyof R, Definition<R, keyof R>>();
  private readonly instances = new Map<keyof R, R[keyof R]>();
  private readonly resolving = new Set<keyof R>();

  /**
   * Register a lazy singleton service: the factory runs on first `get()` and its result is cached.
   * Registering an existing key replaces it (and drops any cached instance).
   */
  register<K extends keyof R>(key: K, factory: ServiceFactory<R, K>): this {
    this.define(key, factory, true);
    return this;
  }

  /** Register a non-shared service: the factory runs on every `get()` (Pimple `factory()`). */
  factory<K extends keyof R>(key: K, factory: ServiceFactory<R, K>): this {
    this.define(key, factory, false);
    return this;
  }

  /** Register an already built value as a service. */
  set<K extends keyof R>(key: K, value: R[K]): this {
    this.define(key, () => value, true);
    this.instances.set(key, value);
    return this;
  }

  /** Whether a service is registered under `key`. */
  has(key: keyof R): boolean {
    return this.definitions.has(key);
  }

  /** Resolve a service. Throws {@link ContainerError} if unknown or on circular dependencies. */
  get<K extends keyof R>(key: K): R[K] {
    const definition = this.definitions.get(key);
    if (definition === undefined) {
      throw new ContainerError(`Identifier "${String(key)}" is not defined.`);
    }

    if (definition.shared && this.instances.has(key)) {
      return this.instances.get(key) as R[K];
    }

    if (this.resolving.has(key)) {
      throw new ContainerError(`Circular dependency detected while resolving "${String(key)}".`);
    }

    this.resolving.add(key);
    try {
      const instance = (definition as unknown as Definition<R, K>).factory(this);
      if (definition.shared) {
        this.instances.set(key, instance);
      }
      return instance;
    } finally {
      this.resolving.delete(key);
    }
  }

  /**
   * Decorate an existing service definition (plugin override). The extender receives the
   * original service and returns the replacement (or the same, mutated, object).
   * Keeps the shared / non-shared nature of the original definition.
   */
  extend<K extends keyof R>(key: K, extender: ServiceExtender<R, K>): this {
    const definition = this.definitions.get(key) as unknown as Definition<R, K> | undefined;
    if (definition === undefined) {
      throw new ContainerError(`Identifier "${String(key)}" is not defined.`);
    }

    const previous = definition.factory;
    this.define(key, (container) => extender(previous(container), container), definition.shared);
    return this;
  }

  /** Remove a service definition and its cached instance. */
  unregister(key: keyof R): boolean {
    this.instances.delete(key);
    return this.definitions.delete(key);
  }

  /** All registered service keys. */
  keys(): Array<keyof R> {
    return [...this.definitions.keys()];
  }

  private define<K extends keyof R>(key: K, factory: ServiceFactory<R, K>, shared: boolean): void {
    this.instances.delete(key);
    this.definitions.set(key, { factory, shared } as unknown as Definition<R, keyof R>);
  }
}

/** A service provider groups registrations, like Pimple's `ServiceProviderInterface`. */
export interface ServiceProvider<R = ServiceRegistry> {
  register(container: Container<R>): void;
}

/** Apply a list of providers to a container. */
export function registerProviders<R>(container: Container<R>, providers: ReadonlyArray<ServiceProvider<R>>): Container<R> {
  for (const provider of providers) {
    provider.register(container);
  }
  return container;
}
