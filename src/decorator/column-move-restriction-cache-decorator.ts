import type { CacheInterface } from '../core/cache/cache-interface.js';
import type { ColumnMoveRestrictionModelLike } from '../foundation/formatter-collaborators.js';

/** Caches `ColumnMoveRestrictionModel::getSortableColumns()` (port of `Kanboard\Decorator\ColumnMoveRestrictionCacheDecorator`). */
export class ColumnMoveRestrictionCacheDecorator {
  protected cachePrefix = 'column_move_restriction:';

  constructor(
    protected readonly cache: CacheInterface,
    protected readonly columnMoveRestrictionModel: ColumnMoveRestrictionModelLike,
  ) {}

  /** Proxy method to get sortable columns. */
  async getSortableColumns(projectId: number, role: string): Promise<unknown> {
    const key = `${this.cachePrefix}${projectId}${role}`;
    let columnIds = this.cache.get(key);

    if (columnIds === null) {
      columnIds = await this.columnMoveRestrictionModel.getSortableColumns(projectId, role);
      this.cache.set(key, columnIds);
    }

    return columnIds;
  }
}
