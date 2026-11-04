import type { ColumnMoveRestrictionCacheDecorator } from './column-move-restriction-cache-decorator.js';
import type { ColumnRestrictionCacheDecorator } from './column-restriction-cache-decorator.js';
import type { MetadataCacheDecorator } from './metadata-cache-decorator.js';
import type { ProjectRoleRestrictionCacheDecorator } from './project-role-restriction-cache-decorator.js';
import type { UserCacheDecorator } from './user-cache-decorator.js';

declare module '../core/container/container.js' {
  interface ServiceRegistry {
    userCacheDecorator: UserCacheDecorator;
    userMetadataCacheDecorator: MetadataCacheDecorator;
    columnMoveRestrictionCacheDecorator: ColumnMoveRestrictionCacheDecorator;
    columnRestrictionCacheDecorator: ColumnRestrictionCacheDecorator;
    projectRoleRestrictionCacheDecorator: ProjectRoleRestrictionCacheDecorator;
  }
}
