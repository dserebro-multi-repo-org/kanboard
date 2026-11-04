import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import { getSchema, getSchemaByName, mssqlSchema as indexMssql } from '../../../src/db/schema/index.js';
import { MSSQL_SCHEMA_VERSION, mssqlSchema } from '../../../src/db/schema/mssql.js';

interface Call {
  sql: string;
  values: readonly unknown[];
}

/** Fake Database recording every statement. */
function fakeDb(): { db: Database; calls: Call[] } {
  const calls: Call[] = [];
  const db = {
    exec: async (sql: string, values: readonly unknown[] = []) => {
      calls.push({ sql: sql.trim(), values });
      return { rows: [], rowCount: 0, insertId: null };
    },
  } as unknown as Database;
  return { db, calls };
}

const run = async (version: number): Promise<Call[]> => {
  const { db, calls } = fakeDb();
  await mssqlSchema.migrations[version]!(db);
  return calls;
};

const php = readFileSync(new URL('../../../app/Schema/Mssql.php', import.meta.url), 'utf8');

describe('mssqlSchema', () => {
  it('declares driver and latest version 3', () => {
    expect(mssqlSchema.driver).toBe('mssql');
    expect(mssqlSchema.latestVersion).toBe(3);
    expect(MSSQL_SCHEMA_VERSION).toBe(3);
    expect(php).toMatch(/const VERSION = 3;/);
  });

  it('has a migration for every version_N of app/Schema/Mssql.php and no others', () => {
    const versions = [...php.matchAll(/^function version_(\d+)\(PDO \$pdo\)/gm)].map((m) => Number(m[1]));
    expect(versions.sort()).toEqual([1, 2, 3]);
    expect(Object.keys(mssqlSchema.migrations).map(Number).sort()).toEqual([1, 2, 3]);
  });

  it('is registered by name but not through getSchema(DbDriver)', () => {
    expect(getSchemaByName('mssql')).toBe(mssqlSchema);
    expect(indexMssql).toBe(mssqlSchema);
    expect(getSchemaByName('postgres').driver).toBe('postgres');
    expect(getSchema('sqlite').driver).toBe('sqlite');
  });

  it('version 2 and 3 add columns', async () => {
    expect((await run(2)).map((c) => c.sql)).toEqual(["ALTER TABLE dbo.users ADD theme nvarchar(50) DEFAULT N'light' NOT NULL"]);
    expect((await run(3)).map((c) => c.sql)).toEqual(["ALTER TABLE dbo.comments ADD visibility nvarchar(25) DEFAULT N'app-user' NOT NULL"]);
  });

  it('version 1 creates every table, trigger and default of the PHP schema', async () => {
    const calls = await run(1);
    const phpTables = [...php.matchAll(/CREATE TABLE (dbo\.\w+)/g)].map((m) => m[1]);
    const tsTables = calls.flatMap((c) => [...c.sql.matchAll(/CREATE TABLE (dbo\.\w+)/g)].map((m) => m[1]));
    expect(phpTables.length).toBe(47);
    expect(tsTables).toEqual(phpTables);

    const phpTriggers = [...php.matchAll(/CREATE TRIGGER ([\w.]+)/g)].map((m) => m[1]);
    const tsTriggers = calls.flatMap((c) => [...c.sql.matchAll(/CREATE TRIGGER ([\w.]+)/g)].map((m) => m[1]));
    expect(tsTriggers).toEqual(phpTriggers);
    expect(tsTriggers).toHaveLength(4);

    // PHP: 47 tables + 4 triggers + 2 defaults + admin + 6 settings + settings batch + links batch + indexes batch
    expect(calls).toHaveLength(47 + 4 + 2 + 1 + 6 + 3);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql).toContain("ADD DEFAULT N'project-viewer' FOR role;");
    expect(sql).toContain("ADD DEFAULT N'app-user' FOR role;");
    expect(sql).toContain('CREATE UNIQUE INDEX users_username_idx ON dbo.users(username);');
    expect(sql).toContain('CREATE INDEX transitions_user_index ON dbo.transitions(user_id);');
  });

  it('version 1 inserts the admin user, tokens and default data', async () => {
    const calls = await run(1);
    const admin = calls.find((c) => c.sql.startsWith('INSERT INTO dbo.users'))!;
    expect(admin.values[0]).toBe('admin');
    expect(admin.values[1]).toMatch(/^\$2y\$10\$/);
    expect(admin.values[2]).toBe('app-admin');

    const settings = calls.filter((c) => c.sql === 'INSERT INTO dbo.settings ([option],value) VALUES (?, ?);');
    expect(settings.map((c) => c.values[0])).toEqual([
      'api_token',
      'application_url',
      'board_highlight_period',
      'board_private_refresh_interval',
      'board_public_refresh_interval',
      'webhook_token',
    ]);
    expect(settings[0]!.values[1]).toMatch(/^[0-9a-f]+$/);
    expect(settings[5]!.values[1]).toMatch(/^[0-9a-f]+$/);
    expect(settings[0]!.values[1]).not.toBe(settings[5]!.values[1]);
    expect(settings[2]!.values[1]).toBe(172800);
    expect(settings[3]!.values[1]).toBe(10);
    expect(settings[4]!.values[1]).toBe(60);

    const batch = calls.find((c) => c.sql.includes("('application_currency','USD')"))!;
    expect(batch.sql).toContain("('webhook_url','')");
    expect(batch.sql).toContain("('subtask_time_tracking','1')");
    const links = calls.find((c) => c.sql.includes('SET IDENTITY_INSERT dbo.links ON'))!;
    expect(links.sql).toContain("(11,'is fixed by',10)");
    expect(links.sql).toContain('SET IDENTITY_INSERT dbo.links OFF;');
  });
});
