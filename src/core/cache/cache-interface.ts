/** Cache contract (`app/Core/Cache/CacheInterface.php`). `get()` returns `null` on a miss. */
export interface CacheInterface {
  set(key: string, value: unknown): void;
  get<T = unknown>(key: string): T | null;
  flush(): void;
  remove(key: string): void;
}
