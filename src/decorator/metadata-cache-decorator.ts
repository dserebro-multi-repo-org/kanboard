import type { CacheInterface } from '../core/cache/cache-interface.js';
import type { MetadataModelLike } from '../foundation/formatter-collaborators.js';

/** Caches the metadata of an entity (port of `Kanboard\Decorator\MetadataCacheDecorator`). */
export class MetadataCacheDecorator {
  constructor(
    protected readonly cache: CacheInterface,
    protected readonly metadataModel: MetadataModelLike,
    protected readonly cachePrefix: string,
    protected readonly entityId: number,
  ) {}

  /** Get a metadata value by key, `defaultValue` when it does not exist. */
  async get<T = string>(key: string, defaultValue: T): Promise<string | T> {
    let metadata = this.cache.get<Record<string, string>>(this.getCacheKey());

    if (metadata === null) {
      metadata = await this.metadataModel.getAll(this.entityId);
      this.cache.set(this.getCacheKey(), metadata);
    }

    const value = metadata[key];
    return value !== undefined && value !== null ? value : defaultValue;
  }

  /** Set a new metadata value and refresh the cache. */
  async set(key: string, value: string): Promise<void> {
    await this.metadataModel.save(this.entityId, { [key]: value });

    const metadata = await this.metadataModel.getAll(this.entityId);
    this.cache.set(this.getCacheKey(), metadata);
  }

  protected getCacheKey(): string {
    return `${this.cachePrefix}${this.entityId}`;
  }
}
