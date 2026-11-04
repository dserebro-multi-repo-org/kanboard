import type { Container } from '../core/container/container.js';

/** Marker contract of template helpers (`app/Helper/*Helper.php`): constructed with the container. */
export interface HelperInterface {
  readonly container: Container;
}

export type HelperConstructor<H extends HelperInterface = HelperInterface> = new (container: Container) => H;
export type HelperFactory<H extends HelperInterface = HelperInterface> = (container: Container) => H;

/**
 * Lazy helper registry, port of `app/Core/Helper.php` (`$this->helper->url`, ...).
 * Helpers are instantiated on first access and cached.
 */
export class HelperRegistry {
  private readonly factories = new Map<string, HelperFactory>();
  private readonly instances = new Map<string, HelperInterface>();

  constructor(private readonly container: Container) {}

  /** Register a helper class under a name (PHP `register($property, $className)`). */
  register(name: string, helperClass: HelperConstructor): this {
    return this.registerFactory(name, (container) => new helperClass(container));
  }

  /** Register a helper built by a factory. */
  registerFactory(name: string, factory: HelperFactory): this {
    this.factories.set(name, factory);
    this.instances.delete(name);
    return this;
  }

  /** Attach an already built helper (PHP `__set`). */
  set(name: string, instance: HelperInterface): this {
    this.instances.set(name, instance);
    this.factories.set(name, () => instance);
    return this;
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  /** Resolve a helper; throws when unknown. */
  get<H extends HelperInterface = HelperInterface>(name: string): H {
    const cached = this.instances.get(name);
    if (cached !== undefined) return cached as H;

    const factory = this.factories.get(name);
    if (factory === undefined) {
      throw new Error(`Identifier "${name}" is not defined.`);
    }

    const instance = factory(this.container);
    this.instances.set(name, instance);
    return instance as H;
  }

  names(): string[] {
    return [...this.factories.keys()];
  }
}
