import type { CacheInterface } from './cache-interface.js';

/** Base class adding the `proxy()` memoization helper (`app/Core/Cache/BaseCache.php`). */
export abstract class BaseCache implements CacheInterface {
  abstract set(key: string, value: unknown): void;
  abstract get<T = unknown>(key: string): T | null;
  abstract flush(): void;
  abstract remove(key: string): void;

  /**
   * Call `instance[method](...args)` and memoize the result, keyed by class name, method and arguments.
   * A `null`/`undefined` result is not cached (same behaviour as the PHP version).
   */
  proxy<T extends object, R>(instance: T, method: keyof T & string, ...args: unknown[]): R {
    const key = `proxy:${instance.constructor.name}:${[method, ...args].join(':')}`;
    let result = this.get<R>(key);

    if (result === null) {
      const fn = instance[method] as unknown as (...a: unknown[]) => R;
      result = fn.apply(instance, args);
      this.set(key, result);
    }

    return result;
  }
}
