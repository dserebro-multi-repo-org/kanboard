import { BaseCache } from './base-cache.js';

/** In-process cache (`app/Core/Cache/MemoryCache.php`). */
export class MemoryCache extends BaseCache {
  private storage = new Map<string, unknown>();

  set(key: string, value: unknown): void {
    this.storage.set(key, value);
  }

  get<T = unknown>(key: string): T | null {
    const value = this.storage.get(key);
    return value === undefined ? null : (value as T);
  }

  flush(): void {
    this.storage = new Map();
  }

  remove(key: string): void {
    this.storage.delete(key);
  }
}
