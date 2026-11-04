import type { CacheInterface } from '../core/cache/cache-interface.js';
import type { ColumnRestrictionModelLike } from '../foundation/formatter-collaborators.js';

/** Caches `ColumnRestrictionModel::getAllByRole()` (port of `Kanboard\Decorator\ColumnRestrictionCacheDecorator`). */
export class ColumnRestrictionCacheDecorator {
  protected cachePrefix = 'column_restriction:';

  constructor(
    protected readonly cache: CacheInterface,
    protected readonly columnRestrictionModel: ColumnRestrictionModelLike,
  ) {}

  /** Proxy method to get the column restrictions of a role. */
  async getAllByRole(projectId: number, role: string): Promise<unknown> {
    const key = `${this.cachePrefix}${projectId}${role}`;
    let columnRestrictions = this.cache.get(key);

    if (columnRestrictions === null) {
      columnRestrictions = await this.columnRestrictionModel.getAllByRole(projectId, role);
      this.cache.set(key, columnRestrictions);
    }

    return columnRestrictions;
  }
}
