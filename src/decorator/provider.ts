import type { Container, ServiceProvider } from '../core/container/container.js';
import { collaborator } from '../foundation/formatter-collaborators.js';
import { ColumnMoveRestrictionCacheDecorator } from './column-move-restriction-cache-decorator.js';
import { ColumnRestrictionCacheDecorator } from './column-restriction-cache-decorator.js';
import { MetadataCacheDecorator } from './metadata-cache-decorator.js';
import { ProjectRoleRestrictionCacheDecorator } from './project-role-restriction-cache-decorator.js';
import { UserCacheDecorator } from './user-cache-decorator.js';
import '../service-provider/registry.js';
import './registry.js';

/** Registers the cache decorators (decorator part of the PHP `CacheProvider`). */
export class DecoratorServiceProvider implements ServiceProvider {
  register(container: Container): void {
    container.register('userCacheDecorator', (c) => new UserCacheDecorator(c.get('memoryCache'), collaborator(c, 'userModel')));

    container.register(
      'userMetadataCacheDecorator',
      (c) =>
        new MetadataCacheDecorator(
          c.get('memoryCache'),
          collaborator(c, 'userMetadataModel'),
          'user.metadata.',
          c.get('userSession').getId(),
        ),
    );

    container.register(
      'columnMoveRestrictionCacheDecorator',
      (c) => new ColumnMoveRestrictionCacheDecorator(c.get('memoryCache'), collaborator(c, 'columnMoveRestrictionModel')),
    );

    container.register(
      'columnRestrictionCacheDecorator',
      (c) => new ColumnRestrictionCacheDecorator(c.get('memoryCache'), collaborator(c, 'columnRestrictionModel')),
    );

    container.register(
      'projectRoleRestrictionCacheDecorator',
      (c) => new ProjectRoleRestrictionCacheDecorator(c.get('memoryCache'), collaborator(c, 'projectRoleRestrictionModel')),
    );
  }
}
