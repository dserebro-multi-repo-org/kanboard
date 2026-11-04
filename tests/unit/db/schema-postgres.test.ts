import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import { POSTGRES_SCHEMA_VERSION, postgresSchema } from '../../../src/db/schema/postgres.js';

type Row = Record<string, unknown>;
interface Call {
  sql: string;
  values: readonly unknown[];
}

/** Fake Database recording every statement; `responder` supplies rows for SELECT/RETURNING statements. */
function fakeDb(responder: (sql: string, values: readonly unknown[]) => Row[] = () => []): { db: Database; calls: Call[] } {
  const calls: Call[] = [];
  const db = {
    exec: async (sql: string, values: readonly unknown[] = []) => {
      calls.push({ sql: sql.trim(), values });
      const rows = responder(sql, values);
      return { rows, rowCount: rows.length, insertId: null };
    },
  } as unknown as Database;
  return { db, calls };
}

const run = async (version: number, responder?: (sql: string, values: readonly unknown[]) => Row[]): Promise<Call[]> => {
  const { db, calls } = fakeDb(responder);
  await postgresSchema.migrations[version]!(db);
  return calls;
};

describe('postgresSchema', () => {
  it('declares driver and latest version 117', () => {
    expect(postgresSchema.driver).toBe('postgres');
    expect(postgresSchema.latestVersion).toBe(117);
    expect(POSTGRES_SCHEMA_VERSION).toBe(117);
  });

  it('has a migration for every version_N of app/Schema/Postgres.php', () => {
    const php = readFileSync(new URL('../../../app/Schema/Postgres.php', import.meta.url), 'utf8');
    const versions = [...php.matchAll(/^function version_(\d+)\(PDO \$pdo\)/gm)].map((m) => Number(m[1]));
    expect(versions).toContain(117);
    for (const v of versions) {
      expect(typeof postgresSchema.migrations[v], `version_${v}`).toBe('function');
    }
    expect(Object.keys(postgresSchema.migrations).every((k) => Number(k) <= 117)).toBe(true);
  });

  it('keeps the statements of simple versions', async () => {
    expect((await run(117)).map((c) => c.sql)).toEqual([`ALTER TABLE "comments" ADD COLUMN "visibility" VARCHAR(25) NOT NULL DEFAULT 'app-user'`]);
    expect((await run(116)).map((c) => c.sql)).toEqual([`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light' NOT NULL`]);
    expect((await run(99)).map((c) => c.sql)[1]).toBe(`DELETE FROM settings WHERE "option"='application_datetime_format'`);
  });

  it('version 1 creates the schema, the admin user and tokens', async () => {
    const calls = await run(1);
    expect(calls[0]!.sql).toContain('CREATE TABLE config');
    expect(calls[0]!.sql).toContain('id SERIAL PRIMARY KEY');
    expect(calls[1]!.sql).toMatch(/INSERT INTO users[\s\S]*'admin', '\$2y\$10\$[^']+', '1'/);
    expect(calls[2]!.sql).toMatch(/INSERT INTO config[\s\S]*VALUES \('[0-9a-f]+', '[0-9a-f]+'\)/);
  });

  it('version 10 migrates config to settings', async () => {
    const calls = await run(10, (sql) => (sql.startsWith('SELECT * FROM config') ? [{ default_columns: 'a', webhooks_token: 't', language: 'en_US' }] : []));
    const inserts = calls.filter((c) => c.sql.startsWith('INSERT INTO settings'));
    expect(inserts).toHaveLength(11);
    expect(inserts[0]!.values).toEqual(['board_highlight_period', 172800]);
    expect(inserts[3]!.values).toEqual(['board_columns', 'a']);
    expect(calls.at(-1)!.sql).toBe('DROP TABLE config');
  });

  it('version 77 maps is_admin/is_project_admin to roles (boolean columns)', async () => {
    const users = [
      { id: 1, is_admin: true, is_project_admin: false },
      { id: 2, is_admin: false, is_project_admin: true },
      { id: 3, is_admin: false, is_project_admin: false },
    ];
    const calls = await run(77, (sql) => (sql.startsWith('SELECT * FROM "users"') ? users : []));
    expect(calls[0]!.sql).toContain(`DEFAULT 'app-user'`);
    expect(calls.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.values)).toEqual([
      ['app-admin', 1],
      ['app-manager', 2],
      ['app-user', 3],
    ]);
    expect(calls.slice(-2).map((c) => c.sql)).toEqual(['ALTER TABLE users DROP COLUMN "is_admin"', 'ALTER TABLE users DROP COLUMN "is_project_admin"']);
  });

  it('version 76 maps is_owner to project roles', async () => {
    const calls = await run(76, (sql) => (sql.startsWith('SELECT * FROM project_has_users') ? [{ id: 1, is_owner: true }, { id: 2, is_owner: false }] : []));
    expect(calls[1]!.sql).toContain(`DEFAULT 'project-viewer'`);
    expect(calls.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.values)).toEqual([
      ['project-manager', 1],
      ['project-member', 2],
    ]);
  });

  it('version 79 rewrites action names', async () => {
    const rows = [
      { id: 1, event_name: 'task.move.column', action_name: 'TaskAssignCurrentUser' },
      { id: 2, event_name: 'task.move.column', action_name: 'TaskClose' },
      { id: 3, event_name: 'x', action_name: 'TaskLogMoveAnotherColumn' },
      { id: 4, event_name: 'x', action_name: 'TaskClose' },
      { id: 5, event_name: 'x', action_name: '\\Already\\Namespaced' },
    ];
    const calls = await run(79, (sql) => (sql.startsWith('SELECT') ? rows : []));
    expect(calls.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.values)).toEqual([
      ['\\Kanboard\\Action\\TaskAssignCurrentUserColumn', 1],
      ['\\Kanboard\\Action\\TaskCloseColumn', 2],
      ['\\Kanboard\\Action\\CommentCreationMoveTaskColumn', 3],
      ['\\Kanboard\\Action\\TaskClose', 4],
      ['\\Already\\Namespaced', 5],
    ]);
  });

  it('version 30 numbers subtasks per task', async () => {
    const rows = [{ id: 1, task_id: 1 }, { id: 2, task_id: 1 }, { id: 3, task_id: 2 }];
    const calls = await run(30, (sql) => (sql.startsWith('SELECT') ? rows : []));
    expect(calls.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.values)).toEqual([[1, 1], [2, 2], [1, 3]]);
  });

  it('version 69 enables email notifications for users with notifications', async () => {
    const calls = await run(69, (sql) => (sql.startsWith('SELECT id FROM users') ? [{ id: 4 }, { id: 9 }] : []));
    expect(calls.filter((c) => c.sql.startsWith('INSERT')).map((c) => c.values)).toEqual([[4, 'email'], [9, 'email']]);
  });

  it('version 21 sets ownership of private projects', async () => {
    const calls = await run(21, (sql) => (sql.startsWith('SELECT id FROM projects') ? [{ id: 3 }] : []));
    expect(calls.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.values)).toEqual([[3]]);
  });

  it('version 101 migrates the default swimlane using RETURNING id', async () => {
    const responder = (sql: string, values: readonly unknown[]): Row[] => {
      if (sql === 'SELECT * FROM projects') return [{ id: 7, default_swimlane: 'Main', show_default_swimlane: true }];
      if (sql.startsWith('SELECT 1 FROM swimlanes')) return values[0] === 'Main' ? [{ '?column?': 1 }] : [];
      if (sql.startsWith('INSERT INTO swimlanes')) return [{ id: 42 }];
      if (sql.startsWith('SELECT action_has_params.id')) return [{ id: 5 }];
      return [];
    };
    const calls = await run(101, responder);
    const insert = calls.find((c) => c.sql.startsWith('INSERT INTO swimlanes'))!;
    expect(insert.sql).toMatch(/RETURNING id$/);
    expect(insert.values).toEqual([7, 'Main (Default swimlane)', 1, 1]);
    expect(calls.find((c) => c.sql.startsWith('UPDATE swimlanes'))!.values).toEqual([7, 42]);
    expect(calls.find((c) => c.sql.startsWith('UPDATE tasks'))!.values).toEqual([42, 7]);
    expect(calls.find((c) => c.sql.startsWith('UPDATE action_has_params'))!.values).toEqual([42, 5]);
    expect(calls.at(-1)!.sql).toBe('ALTER TABLE "tasks" ADD FOREIGN KEY (swimlane_id) REFERENCES swimlanes ON DELETE CASCADE');
  });

  it('every migration runs against the fake database', async () => {
    for (let v = 1; v <= 117; v++) {
      const fn = postgresSchema.migrations[v];
      if (!fn) continue;
      const { db } = fakeDb(() => []);
      await expect(fn(db)).resolves.toBeUndefined();
    }
  });
});
