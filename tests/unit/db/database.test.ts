import { CompiledQuery } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../../../src/db/database.js';
import { getDialect } from '../../../src/db/dialect.js';
import { SqlException } from '../../../src/db/types.js';
import { memoryDb, seededDb } from './helpers.js';

const opened: Database[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (): Promise<Database> => {
  const db = await seededDb();
  opened.push(db);
  return db;
};

describe('Database', () => {
  it('exposes the raw Kysely connection and the driver', async () => {
    const db = await open();
    expect(db.driver).toBe('sqlite');
    const result = await db.getConnection().executeQuery(CompiledQuery.raw('SELECT 1 AS one'));
    expect(result.rows).toEqual([{ one: 1 }]);
  });

  it('counts queries and logs them', async () => {
    const db = await open();
    const seen: string[] = [];
    db.withLogging((e) => seen.push(e.sql));
    const before = db.getNbQueries();
    await db.table('users').count();
    expect(db.getNbQueries()).toBe(before + 1);
    expect(seen).toEqual(['SELECT COUNT(*) FROM "users"']);
  });

  it('wraps SQL errors', async () => {
    const db = await open();
    await expect(db.exec('SELECT * FROM missing')).rejects.toBeInstanceOf(SqlException);
    expect(await db.execute('INSERT INTO users (name) VALUES (?)', ['alice'])).toBe(false);
  });

  it('getLastId falls back to a query', async () => {
    const db = memoryDb();
    opened.push(db);
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    expect(await db.getLastId()).toBe(0);
    await db.exec('INSERT INTO t (v) VALUES (?)', ['a']);
    expect(await db.getLastId()).toBe(1);
  });

  it('opens a file database, creating its directory, with WAL mode', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const dir = mkdtempSync(path.join(os.tmpdir(), 'kb-db-'));
    const db = Database.connect({ DB_DRIVER: 'sqlite', DB_FILENAME: path.join(dir, 'sub', 'db.sqlite'), DB_WAL_MODE: true });
    try {
      const { rows } = await db.exec('PRAGMA journal_mode');
      expect(rows[0]?.journal_mode).toBe('wal');
    } finally {
      await db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects unknown drivers', () => {
    expect(() => Database.connect({ DB_DRIVER: 'oracle' as never })).toThrow('Database driver not supported');
  });
});

describe('Database transactions', () => {
  it('commits and returns the callback result', async () => {
    const db = await open();
    const result = await db.transaction(async (tx) => {
      await tx.table('users').insert({ name: 'tx1' });
      return 42;
    });
    expect(result).toBe(42);
    expect(await db.table('users').eq('name', 'tx1').exists()).toBe(true);
  });

  it('returns true when the callback returns nothing', async () => {
    const db = await open();
    expect(await db.transaction(async () => undefined)).toBe(true);
  });

  it('rolls back when the callback throws', async () => {
    const db = await open();
    await expect(
      db.transaction(async (tx) => {
        await tx.table('users').insert({ name: 'tx2' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.table('users').eq('name', 'tx2').exists()).toBe(false);
    expect(db.inTransaction()).toBe(false);
  });

  it('rolls back on a SQL error', async () => {
    const db = await open();
    await expect(
      db.transaction(async (tx) => {
        await tx.table('users').insert({ name: 'tx3' });
        await tx.table('missing').insert({ a: 1 });
      }),
    ).rejects.toBeInstanceOf(SqlException);
    expect(await db.table('users').eq('name', 'tx3').exists()).toBe(false);
  });

  it('rolls back and returns false on a constraint violation', async () => {
    const db = await open();
    const result = await db.transaction(async (tx) => {
      await tx.table('users').insert({ name: 'tx4' });
      await tx.table('users').insert({ name: 'alice' });
      return 'done';
    });
    expect(result).toBe(false);
    expect(await db.table('users').eq('name', 'tx4').exists()).toBe(false);
  });

  it('joins nested transactions', async () => {
    const db = await open();
    const result = await db.transaction(async (tx) => {
      await tx.transaction(async (inner) => {
        await inner.table('users').insert({ name: 'nested' });
      });
      expect(tx.inTransaction()).toBe(true);
      return 1;
    });
    expect(result).toBe(1);
    expect(await db.table('users').eq('name', 'nested').exists()).toBe(true);
  });

  it('supports startTransaction / closeTransaction', async () => {
    const db = await open();
    await db.startTransaction();
    await db.startTransaction();
    expect(db.inTransaction()).toBe(true);
    await db.table('users').insert({ name: 'manual' });
    await db.closeTransaction();
    expect(db.inTransaction()).toBe(false);
    expect(await db.table('users').eq('name', 'manual').exists()).toBe(true);
    await db.closeTransaction();
  });

  it('supports cancelTransaction', async () => {
    const db = await open();
    await db.startTransaction();
    await db.table('users').insert({ name: 'cancelled' });
    await db.cancelTransaction();
    expect(await db.table('users').eq('name', 'cancelled').exists()).toBe(false);
  });

  it('cancels a manual transaction on constraint violations', async () => {
    const db = await open();
    await db.startTransaction();
    await db.table('users').insert({ name: 'before' });
    expect(await db.table('users').insert({ name: 'alice' })).toBe(false);
    expect(db.inTransaction()).toBe(false);
    expect(await db.table('users').eq('name', 'before').exists()).toBe(false);
  });
});

describe('Dialects', () => {
  const pg = getDialect('postgres');
  const my = getDialect('mysql');
  const lite = getDialect('sqlite');

  it('quotes identifiers', () => {
    expect(pg.escape('a')).toBe('"a"');
    expect(lite.escape('a')).toBe('"a"');
    expect(my.escape('a')).toBe('`a`');
  });

  it('chooses like operators', () => {
    expect(pg.getOperator('ILIKE')).toBe('ILIKE');
    expect(pg.getOperator('LIKE')).toBe('LIKE');
    expect(my.getOperator('LIKE')).toBe('LIKE BINARY');
    expect(my.getOperator('ILIKE')).toBe('LIKE');
    expect(lite.getOperator('ILIKE')).toBe('LIKE');
  });

  it('rewrites placeholders for PostgreSQL', () => {
    expect(pg.bind('a = ? AND b IN (?, ?)')).toBe('a = $1 AND b IN ($2, $3)');
    expect(my.bind('a = ?')).toBe('a = ?');
  });

  it('detects constraint errors', () => {
    expect(pg.isDuplicateKeyError({ code: '23505' })).toBe(true);
    expect(pg.isDuplicateKeyError({ code: '42P01' })).toBe(false);
    expect(my.isDuplicateKeyError({ code: 'ER_DUP_ENTRY' })).toBe(true);
    expect(my.isDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(lite.isDuplicateKeyError({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(true);
    expect(lite.isDuplicateKeyError(new Error('x'))).toBe(false);
  });

  it('builds upserts', () => {
    expect(pg.upsert('t', 'k', 'v', 2)).toContain('ON CONFLICT ("k") DO UPDATE SET "v" = EXCLUDED."v"');
    expect(my.upsert('t', 'k', 'v', 1)).toBe('REPLACE INTO `t` (`k`, `v`) VALUES (?, ?)');
    expect(lite.upsert('t', 'k', 'v', 1)).toBe('INSERT OR REPLACE INTO "t" ("k", "v") VALUES (?, ?)');
  });

  it('generates dialect specific SQL in the query builder', async () => {
    const db = new Database((await open()).getConnection(), 'postgres');
    const sql = db.table('users').ilike('name', 'a%').in('id', [1]).limit(2).offset(1).buildSelectQuery();
    expect(sql).toBe('SELECT * FROM "users" WHERE "name" ILIKE ? AND "id" IN (?) LIMIT 2 OFFSET 1');
    const my2 = new Database((await open()).getConnection(), 'mysql');
    expect(my2.table('users').like('name', 'a').offset(5).buildSelectQuery()).toBe(
      'SELECT * FROM `users` WHERE `name` LIKE BINARY ? LIMIT 18446744073709551615 OFFSET 5',
    );
  });
});
