import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../../../src/core/cache/index.js';
import {
  ColumnMoveRestrictionCacheDecorator,
  ColumnRestrictionCacheDecorator,
  DecoratorServiceProvider,
  MetadataCacheDecorator,
  ProjectRoleRestrictionCacheDecorator,
  UserCacheDecorator,
} from '../../../src/decorator/index.js';
import { Container } from '../../../src/core/container/container.js';
import type { CacheInterface } from '../../../src/core/cache/cache-interface.js';

const CACHE_PREFIX = 'cache_prefix';
const ENTITY_ID = 123;

function mockCache(initial: unknown) {
  return { get: vi.fn((_key: string) => initial), set: vi.fn(), flush: vi.fn(), remove: vi.fn() } as unknown as CacheInterface & {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
}

describe('MetadataCacheDecorator', () => {
  const metadataModel = () => ({ getAll: vi.fn(async () => ({ key: 'something' })), save: vi.fn(async () => true) });

  it('set() saves the value and refreshes the cache', async () => {
    const cache = mockCache(null);
    const model = metadataModel();
    await new MetadataCacheDecorator(cache, model, CACHE_PREFIX, ENTITY_ID).set('key', 'value');

    expect(model.save).toHaveBeenCalledTimes(1);
    expect(model.save).toHaveBeenCalledWith(ENTITY_ID, { key: 'value' });
    expect(model.getAll).toHaveBeenCalledTimes(1);
    expect(model.getAll).toHaveBeenCalledWith(ENTITY_ID);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(CACHE_PREFIX + ENTITY_ID, { key: 'something' });
  });

  it('get() reads from the cache', async () => {
    const cache = mockCache({ key: 'foobar' });
    const model = metadataModel();
    expect(await new MetadataCacheDecorator(cache, model, CACHE_PREFIX, ENTITY_ID).get('key', 'default')).toBe('foobar');
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalledWith(CACHE_PREFIX + ENTITY_ID);
    expect(model.getAll).not.toHaveBeenCalled();
  });

  it('get() returns the default value when the key is not cached', async () => {
    const cache = mockCache({ key1: 'foobar' });
    expect(await new MetadataCacheDecorator(cache, metadataModel(), CACHE_PREFIX, ENTITY_ID).get('key', 'default')).toBe('default');
  });

  it('get() loads and caches the metadata on a cache miss', async () => {
    const cache = mockCache(null);
    const model = metadataModel();
    expect(await new MetadataCacheDecorator(cache, model, CACHE_PREFIX, ENTITY_ID).get('key', 'default')).toBe('something');
    expect(model.getAll).toHaveBeenCalledWith(ENTITY_ID);
    expect(cache.set).toHaveBeenCalledWith(CACHE_PREFIX + ENTITY_ID, { key: 'something' });
  });
});

describe('restriction and user decorators', () => {
  it('ColumnMoveRestrictionCacheDecorator caches getSortableColumns per project and role', async () => {
    const model = { getSortableColumns: vi.fn(async () => [1, 2]) };
    const decorator = new ColumnMoveRestrictionCacheDecorator(new MemoryCache(), model);
    expect(await decorator.getSortableColumns(1, 'project-member')).toEqual([1, 2]);
    expect(await decorator.getSortableColumns(1, 'project-member')).toEqual([1, 2]);
    await decorator.getSortableColumns(2, 'project-member');
    expect(model.getSortableColumns).toHaveBeenCalledTimes(2);
  });

  it('ColumnRestrictionCacheDecorator caches getAllByRole', async () => {
    const cache = new MemoryCache();
    const model = { getAllByRole: vi.fn(async () => [{ id: 1 }]) };
    const decorator = new ColumnRestrictionCacheDecorator(cache, model);
    await decorator.getAllByRole(1, 'r');
    expect(await decorator.getAllByRole(1, 'r')).toEqual([{ id: 1 }]);
    expect(model.getAllByRole).toHaveBeenCalledTimes(1);
    expect(cache.get('column_restriction:1r')).toEqual([{ id: 1 }]);
  });

  it('ProjectRoleRestrictionCacheDecorator caches getAllByRole', async () => {
    const cache = new MemoryCache();
    const model = { getAllByRole: vi.fn(async () => [{ id: 2 }]) };
    const decorator = new ProjectRoleRestrictionCacheDecorator(cache, model);
    await decorator.getAllByRole(3, 'r');
    await decorator.getAllByRole(3, 'r');
    expect(model.getAllByRole).toHaveBeenCalledTimes(1);
    expect(cache.get('project_restriction:3r')).toEqual([{ id: 2 }]);
  });

  it('UserCacheDecorator caches getByUsername', async () => {
    const cache = new MemoryCache();
    const model = { getByUsername: vi.fn(async (username: string) => ({ username })) };
    const decorator = new UserCacheDecorator(cache, model);
    expect(await decorator.getByUsername('admin')).toEqual({ username: 'admin' });
    await decorator.getByUsername('admin');
    expect(model.getByUsername).toHaveBeenCalledTimes(1);
    expect(cache.get('user_model:admin')).toEqual({ username: 'admin' });
  });
});

describe('DecoratorServiceProvider', () => {
  it('registers the decorators bound to the memory cache and the user session', async () => {
    const container = new Container();
    container.register('memoryCache', () => new MemoryCache());
    container.set('userSession', { getId: () => 42 });
    const loose = container as unknown as Container<Record<string, unknown>>;
    const metadataModel = { getAll: vi.fn(async () => ({ theme: 'dark' })), save: vi.fn(async () => true) };
    loose.set('userMetadataModel', metadataModel);
    loose.set('userModel', { getByUsername: vi.fn(async () => ({ id: 1 })) });
    loose.set('columnMoveRestrictionModel', { getSortableColumns: vi.fn() });
    loose.set('columnRestrictionModel', { getAllByRole: vi.fn() });
    loose.set('projectRoleRestrictionModel', { getAllByRole: vi.fn() });
    new DecoratorServiceProvider().register(container);

    expect(await container.get('userMetadataCacheDecorator').get('theme', 'light')).toBe('dark');
    expect(metadataModel.getAll).toHaveBeenCalledWith(42);
    expect(await container.get('userCacheDecorator').getByUsername('a')).toEqual({ id: 1 });
    expect(container.get('columnMoveRestrictionCacheDecorator')).toBeInstanceOf(ColumnMoveRestrictionCacheDecorator);
    expect(container.get('columnRestrictionCacheDecorator')).toBeInstanceOf(ColumnRestrictionCacheDecorator);
    expect(container.get('projectRoleRestrictionCacheDecorator')).toBeInstanceOf(ProjectRoleRestrictionCacheDecorator);
  });
});
