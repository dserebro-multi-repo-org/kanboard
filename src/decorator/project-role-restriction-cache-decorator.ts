import type { CacheInterface } from '../core/cache/cache-interface.js';
import type { ProjectRoleRestrictionModelLike } from '../foundation/formatter-collaborators.js';

/** Caches `ProjectRoleRestrictionModel::getAllByRole()` (port of `Kanboard\Decorator\ProjectRoleRestrictionCacheDecorator`). */
export class ProjectRoleRestrictionCacheDecorator {
  protected cachePrefix = 'project_restriction:';

  constructor(
    protected readonly cache: CacheInterface,
    protected readonly projectRoleRestrictionModel: ProjectRoleRestrictionModelLike,
  ) {}

  /** Proxy method to get the project restrictions of a role. */
  async getAllByRole(projectId: number, role: string): Promise<unknown> {
    const key = `${this.cachePrefix}${projectId}${role}`;
    let projectRestrictions = this.cache.get(key);

    if (projectRestrictions === null) {
      projectRestrictions = await this.projectRoleRestrictionModel.getAllByRole(projectId, role);
      this.cache.set(key, projectRestrictions);
    }

    return projectRestrictions;
  }
}
