/** Hook listener. Return values are used by `merge`, `first`; `reference` listeners mutate their argument. */
export type HookListener = (...params: never[]) => unknown;

type AnyListener = (...params: unknown[]) => unknown;

/**
 * Plugin hook registry, port of `app/Core/Plugin/Hook.php`. Plugins attach listeners to named
 * hooks (`template:layout:css`, `model:task:creation:prepare`, ...) and the core asks for the results.
 */
export class Hook {
  private readonly hooks = new Map<string, AnyListener[]>();

  /** Register a listener (PHP `on($hook, $value)`). */
  on(hook: string, listener: HookListener): void {
    const listeners = this.hooks.get(hook) ?? [];
    listeners.push(listener as AnyListener);
    this.hooks.set(hook, listeners);
  }

  getListeners(hook: string): AnyListener[] {
    return [...(this.hooks.get(hook) ?? [])];
  }

  exists(hook: string): boolean {
    return this.hooks.has(hook);
  }

  /**
   * Call every listener of the hook and shallow-merge the returned objects into `values`
   * (array_merge semantics for string keys; use mergeList for lists). Returns the merged values.
   */
  merge<T extends Record<string, unknown>>(hook: string, values: T, params: readonly unknown[] = []): T {
    for (const listener of this.getListeners(hook)) {
      const result = listener(...params);
      if (typeof result === 'object' && result !== null && !Array.isArray(result) && Object.keys(result).length > 0) {
        Object.assign(values, result);
      }
    }
    return values;
  }

  /** Same as {@link merge} for lists: results that are non-empty arrays are appended. */
  mergeList<T>(hook: string, values: T[], params: readonly unknown[] = []): T[] {
    for (const listener of this.getListeners(hook)) {
      const result = listener(...params);
      if (Array.isArray(result) && result.length > 0) {
        values.push(...(result as T[]));
      }
    }
    return values;
  }

  /** Result of the first listener, `null` when there is none. */
  first<T = unknown>(hook: string, params: readonly unknown[] = []): T | null {
    const [listener] = this.getListeners(hook);
    return listener === undefined ? null : (listener(...params) as T);
  }

  /** Pass a value through every listener; listeners mutate the given object (PHP by-reference semantics). */
  reference<T>(hook: string, param: T): T {
    for (const listener of this.getListeners(hook)) {
      listener(param);
    }
    return param;
  }

  /** Call every listener with the params and collect their results. */
  emit(hook: string, ...params: unknown[]): unknown[] {
    return this.getListeners(hook).map((listener) => listener(...params));
  }
}
