import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import { SqlException } from '../../../src/db/types.js';
import { seededDb } from './helpers.js';

let db: Database;
beforeEach(async () => {
  db = await seededDb();
});
afterEach(async () => {
  await db.close();
});

describe('Table: reading', () => {
  it('findAll returns every row, findOne the first or null', async () => {
    expect(await db.table('users').findAll()).toHaveLength(3);
    expect((await db.table('users').eq('name', 'bob').findOne())?.age).toBe(20);
    expect(await db.table('users').eq('name', 'nobody').findOne()).toBeNull();
  });

  it('supports the comparison operators', async () => {
    expect(await db.table('users').neq('name', 'bob').count()).toBe(2);
    expect(await db.table('users').gt('age', 30).count()).toBe(1);
    expect(await db.table('users').gte('age', 30).count()).toBe(2);
    expect(await db.table('users').lt('age', 30).count()).toBe(1);
    expect(await db.table('users').lte('age', 30).count()).toBe(2);
  });

  it('supports in / notIn and ignores empty lists like PicoDb', async () => {
    expect(await db.table('users').in('id', [1, 2]).count()).toBe(2);
    expect(await db.table('users').notIn('id', [1, 2]).count()).toBe(1);
    expect(await db.table('users').in('id', []).count()).toBe(3);
    expect(await db.table('users').notIn('id', []).count()).toBe(3);
  });

  it('eq / neq accept arrays', async () => {
    expect(await db.table('users').eq('id', [1, 3]).count()).toBe(2);
    expect(await db.table('users').neq('id', [1, 3]).count()).toBe(1);
    expect(await db.table('users').eq('id', []).count()).toBe(0);
  });

  it('supports like / ilike, isNull / notNull', async () => {
    expect(await db.table('users').like('name', 'a%').count()).toBe(1);
    expect(await db.table('users').ilike('name', 'c%').count()).toBe(1);
    expect(await db.table('users').isNull('score').count()).toBe(1);
    expect(await db.table('users').notNull('score').count()).toBe(2);
  });

  it('supports subquery conditions', async () => {
    const sub = db.table('tasks').columns('owner_id').gt('points', 2);
    expect(await db.table('users').inSubquery('id', sub).count()).toBe(1);
    const sub2 = db.table('tasks').columns('owner_id').gt('points', 2);
    expect(await db.table('users').notInSubquery('id', sub2).count()).toBe(2);
    const max = db.table('tasks').select('MAX(points)');
    expect(await db.table('tasks').gteSubquery('points', max).count()).toBe(1);
  });

  it('groups conditions with beginOr / closeOr and or()', async () => {
    const rows = await db.table('users').eq('role', 'admin').beginOr().eq('name', 'alice').eq('name', 'bob').closeOr().findAll();
    expect(rows.map((r) => r.name)).toEqual(['alice']);

    const names = await db.table('users').beginOr().eq('name', 'alice').eq('name', 'bob').closeOr().asc('id').findAllByColumn('name');
    expect(names).toEqual(['alice', 'bob']);

    const nested = await db
      .table('users')
      .beginOr()
      .eq('name', 'alice')
      .beginOr()
      .eq('name', 'bob')
      .eq('age', 40)
      .closeOr()
      .closeOr()
      .count();
    expect(nested).toBe(3);

    expect(await db.table('users').or((t) => t.eq('name', 'alice').eq('name', 'Carol')).count()).toBe(2);
    expect(() => db.table('users').closeOr()).toThrow();
  });

  it('adds raw conditions with parameters', async () => {
    expect(await db.table('users').addCondition('age > ? AND age < ?', 25, 35).count()).toBe(1);
  });

  it('orders, limits and offsets', async () => {
    expect(await db.table('users').desc('age').findAllByColumn('name')).toEqual(['Carol', 'alice', 'bob']);
    expect(await db.table('users').orderBy('role', 'asc').orderBy('id', 'DESC').findAllByColumn('id')).toEqual([3, 1, 2]);
    expect(await db.table('users').asc('id').limit(2).findAllByColumn('id')).toEqual([1, 2]);
    expect(await db.table('users').asc('id').limit(1).offset(1).findAllByColumn('id')).toEqual([2]);
    expect(await db.table('users').asc('id').offset(2).findAllByColumn('id')).toEqual([3]);
    expect(await db.table('users').asc('id').limit(null).findAll()).toHaveLength(3);
  });

  it('selects columns, custom selects, distinct and sub query columns', async () => {
    const row = await db.table('users').columns('id', 'name').eq('id', 1).findOne();
    expect(row).toEqual({ id: 1, name: 'alice' });
    expect(await db.table('users').select('COUNT(*) AS nb').findOne()).toEqual({ nb: 3 });
    expect(await db.table('tasks').distinct('owner_id').asc('owner_id').findAllByColumn('owner_id')).toEqual([1, 2, 99]);
    const sub = await db.table('users').columns('id').subquery('SELECT COUNT(*) FROM tasks WHERE tasks.owner_id=users.id', 'nb_tasks').eq('id', 1).findOne();
    expect(sub).toEqual({ id: 1, nb_tasks: 2 });
  });

  it('left joins, aliases and groups', async () => {
    const rows = await db
      .table('tasks')
      .columns('tasks.title', 'users.name AS owner')
      .join('users', 'id', 'owner_id')
      .asc('tasks.id')
      .findAll();
    expect(rows.map((r) => r.owner)).toEqual(['alice', 'alice', 'bob', null]);

    const aliased = await db.table('tasks').select('tasks.title, u.name AS owner').left('users', 'u', 'id', 'tasks', 'owner_id').eq('tasks.title', 'three').findOne();
    expect(aliased).toEqual({ title: 'three', owner: 'bob' });

    const inner = await db.table('tasks').select('tasks.title').inner('users', 'u', 'id', 'tasks', 'owner_id').findAll();
    expect(inner).toHaveLength(3);

    const joinAlias = await db.table('tasks').select('o.name AS owner').join('users', 'id', 'owner_id', '', 'o').eq('tasks.id', 1).findOne();
    expect(joinAlias).toEqual({ owner: 'alice' });

    const grouped = await db.table('tasks').select('owner_id, SUM(points) AS total').groupBy('owner_id').asc('owner_id').findAll();
    expect(grouped).toEqual([
      { owner_id: 1, total: 8 },
      { owner_id: 2, total: 1 },
      { owner_id: 99, total: 0 },
    ]);
  });

  it('counts with joins and conditions', async () => {
    expect(await db.table('tasks').join('users', 'id', 'owner_id').eq('users.name', 'alice').count()).toBe(2);
  });

  it('aggregates', async () => {
    expect(await db.table('tasks').sum('points')).toBe(9);
    expect(await db.table('tasks').avg('points')).toBe(2.25);
    expect(await db.table('tasks').min('points')).toBe(0);
    expect(await db.table('tasks').max('points')).toBe(5);
    expect(await db.table('tasks').eq('id', 999).sum('points')).toBe(0);
    expect(await db.table('tasks').eq('id', 999).max('points')).toBeNull();
    expect(await db.table('tasks').eq('id', 999).count()).toBe(0);
  });

  it('exists, findOneColumn and findAllByColumn', async () => {
    expect(await db.table('users').eq('name', 'bob').exists()).toBe(true);
    expect(await db.table('users').eq('name', 'zed').exists()).toBe(false);
    expect(await db.table('users').eq('name', 'bob').findOneColumn('age')).toBe(20);
    expect(await db.table('users').eq('name', 'zed').findOneColumn('age')).toBeNull();
    expect(await db.table('tasks').eq('owner_id', 1).asc('id').findAllByColumn('title')).toEqual(['one', 'two']);
  });

  it('applies a result callback only to non empty result sets', async () => {
    const rows = await db
      .table('users')
      .eq('id', 1)
      .callback((r) => r.map((x) => ({ ...x, extra: true })))
      .findAll();
    expect(rows[0]?.extra).toBe(true);
    const none = await db.table('users').eq('id', 99).callback(() => [{ called: true }]).findAll();
    expect(none).toEqual([]);
  });

  it('clones independently', async () => {
    const base = db.table('users').gt('age', 10);
    const copy = base.clone().eq('name', 'bob');
    expect(await base.count()).toBe(3);
    expect(await copy.count()).toBe(1);
  });

  it('rejects invalid identifiers', async () => {
    expect(() => db.table('users').eq('name; DROP TABLE users', 1)).not.toThrow();
    expect(() => db.table('users').eq('na"me', 1)).toThrow(SqlException);
    expect(() => db.escapeIdentifier('Bad')).toThrow(SqlException);
    expect(db.escapeIdentifier('id', 'users')).toBe('"users"."id"');
    expect(db.escapeIdentifier('COUNT(*)  x')).toBe('COUNT(*)  x');
  });
});

describe('Table: writing', () => {
  it('inserts, returning a boolean, and persists with the generated id', async () => {
    expect(await db.table('users').insert({ name: 'dave', age: 1 })).toBe(true);
    const id = await db.table('users').persist({ name: 'erin', age: 2 });
    expect(id).toBe(5);
    expect(await db.getLastId()).toBe(5);
    expect(await db.table('users').insertAndGetId({ name: 'frank' })).toBe(6);
  });

  it('inserts booleans and undefined as 1/0 and null', async () => {
    await db.table('users').insert({ name: 'flag', age: true, score: undefined });
    const row = await db.table('users').eq('name', 'flag').findOne();
    expect(row?.age).toBe(1);
    expect(row?.score).toBeNull();
  });

  it('returns false on constraint violations', async () => {
    expect(await db.table('users').insert({ name: 'alice' })).toBe(false);
    expect(await db.table('users').persist({ name: 'alice' })).toBe(false);
    expect(await db.table('users').insert({ name: null })).toBe(false);
    expect(await db.table('users').eq('id', 2).update({ name: 'alice' })).toBe(false);
  });

  it('throws SqlException on other errors', async () => {
    await expect(db.table('nope').insert({ a: 1 })).rejects.toBeInstanceOf(SqlException);
    await expect(db.table('nope').findAll()).rejects.toThrow(/no such table/);
  });

  it('updates, with sum columns', async () => {
    expect(await db.table('users').eq('name', 'bob').update({ age: 21 })).toBe(true);
    expect((await db.table('users').eq('name', 'bob').findOne())?.age).toBe(21);
    expect(await db.table('tasks').eq('owner_id', 1).sumColumn('points', 10).update({ title: 'x' })).toBe(true);
    expect(await db.table('tasks').eq('owner_id', 1).findAllByColumn('points')).toEqual([13, 15]);
  });

  it('saves: update with conditions, insert without', async () => {
    expect(await db.table('users').save({ name: 'gina' })).toBe(true);
    expect(await db.table('users').eq('name', 'gina').save({ age: 9 })).toBe(true);
    expect((await db.table('users').eq('name', 'gina').findOne())?.age).toBe(9);
    expect(await db.table('users').count()).toBe(4);
  });

  it('removes and reports whether rows were deleted', async () => {
    expect(await db.table('tasks').eq('owner_id', 1).remove()).toBe(true);
    expect(await db.table('tasks').count()).toBe(2);
    expect(await db.table('tasks').eq('owner_id', 1).remove()).toBe(false);
  });

  it('increments and decrements', async () => {
    expect(await db.table('tasks').eq('id', 1).increment('points', 4)).toBe(true);
    expect(await db.table('tasks').eq('id', 1).findOneColumn('points')).toBe(7);
    expect(await db.table('tasks').eq('id', 1).decrement('points', 2)).toBe(true);
    expect(await db.table('tasks').eq('id', 1).findOneColumn('points')).toBe(5);
    await expect(db.table('tasks').increment('points', Number.NaN)).rejects.toThrow(TypeError);
  });
});

describe('Hashtable', () => {
  it('puts, gets and replaces', async () => {
    await db.exec('CREATE TABLE kv (option TEXT PRIMARY KEY, value TEXT)');
    const kv = (): ReturnType<Database['hashtable']> => db.hashtable('kv');
    expect(await kv().columnKey('option').columnValue('value').put({ a: '1', b: '2' })).toBe(true);
    expect(await kv().put({})).toBe(true);
    expect(await kv().columnKey('option').columnValue('value').put({ a: '3' })).toBe(true);
    expect(await kv().getAll('option', 'value')).toEqual({ a: '3', b: '2' });
    expect(await kv().columnKey('option').columnValue('value').get('b')).toEqual({ b: '2' });
  });
});
