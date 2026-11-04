import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../../../src/db/database.js';
import { MigrationError, getSchemaVersion, migrate } from '../../../src/db/migrate.js';
import { getSchema, registerSchema, sqliteSchema } from '../../../src/db/schema/index.js';
import { memoryDb } from './helpers.js';

const opened: Database[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const fresh = (): Database => {
  const db = memoryDb();
  opened.push(db);
  return db;
};

async function tables(db: Database): Promise<string[]> {
  const { rows } = await db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return rows.map((r) => String(r.name));
}

describe('migrate()', () => {
  it('creates the whole SQLite schema and stores the version', async () => {
    const db = fresh();
    expect(await getSchemaVersion(db)).toBe(0);
    const result = await migrate(db);
    expect(result.from).toBe(0);
    expect(result.to).toBe(128);
    expect(result.applied).toHaveLength(128);
    expect(await getSchemaVersion(db)).toBe(128);
    expect(await db.table('schema_version').findAllByColumn('version')).toEqual([128]);
  });

  it('is idempotent', async () => {
    const db = fresh();
    await migrate(db);
    const again = await migrate(db);
    expect(again).toEqual({ from: 128, to: 128, applied: [] });
    expect(await db.table('schema_version').count()).toBe(1);
    expect(await db.table('users').count()).toBe(1);
  });

  it('creates the expected tables', async () => {
    const db = fresh();
    await migrate(db);
    // Identical to the tables created by app/Schema/Sqlite.php (verified against the PHP migration output; `schema_version` replaces PRAGMA user_version).
    expect(await tables(db)).toEqual([
        'action_has_params',
        'actions',
        'column_has_move_restrictions',
        'column_has_restrictions',
        'columns',
        'comments',
        'currencies',
        'custom_filters',
        'group_has_users',
        'groups',
        'invites',
        'last_logins',
        'links',
        'password_reset',
        'plugin_schema_versions',
        'predefined_task_descriptions',
        'project_activities',
        'project_daily_column_stats',
        'project_daily_stats',
        'project_has_categories',
        'project_has_files',
        'project_has_groups',
        'project_has_metadata',
        'project_has_notification_types',
        'project_has_roles',
        'project_has_users',
        'project_role_has_restrictions',
        'projects',
        'remember_me',
        'schema_version',
        'sessions',
        'settings',
        'subtask_time_tracking',
        'subtasks',
        'swimlanes',
        'tags',
        'task_has_external_links',
        'task_has_files',
        'task_has_links',
        'task_has_metadata',
        'task_has_tags',
        'tasks',
        'transitions',
        'user_has_metadata',
        'user_has_notification_types',
        'user_has_notifications',
        'user_has_unread_notifications',
        'users',
    ]);
  });

  it('inserts the default admin user and settings', async () => {
    const db = fresh();
    await migrate(db);
    const admin = await db.table('users').eq('username', 'admin').findOne();
    expect(admin?.role).toBe('app-admin');
    expect(String(admin?.password)).toMatch(/^\$2y\$10\$/);
    expect(await db.table('settings').eq('option', 'api_token').findOneColumn<string>('value')).toHaveLength(60);
    expect(await db.table('links').count()).toBe(11);
    expect(await db.table('settings').eq('option', 'application_currency').findOneColumn('value')).toBe('USD');
  });

  it('leaves foreign keys enabled afterwards', async () => {
    const db = fresh();
    await migrate(db);
    const { rows } = await db.exec('PRAGMA foreign_keys');
    expect(rows[0]?.foreign_keys).toBe(1);
    expect(await db.exec('PRAGMA foreign_key_check').then((r) => r.rows)).toEqual([]);
  });

  it('can stop at a target version and continue later', async () => {
    const db = fresh();
    const first = await migrate(db, sqliteSchema, 10);
    expect(first.to).toBe(10);
    expect(await getSchemaVersion(db)).toBe(10);
    const second = await migrate(db);
    expect(second.from).toBe(10);
    expect(second.applied[0]).toBe(11);
  });

  it('adopts the version stored in PRAGMA user_version by the PHP application', async () => {
    const db = fresh();
    await migrate(db, sqliteSchema, 5);
    await db.exec('DROP TABLE schema_version');
    await db.exec('PRAGMA user_version = 5');
    expect(await getSchemaVersion(db)).toBe(5);
  });

  it('runs each version in a transaction and reports failures', async () => {
    const db = fresh();
    registerSchema({
      driver: 'sqlite',
      latestVersion: 3,
      migrations: {
        1: async (d) => void (await d.exec('CREATE TABLE a (id INTEGER)')),
        2: async (d) => {
          await d.exec('CREATE TABLE b (id INTEGER)');
          await d.exec('THIS IS NOT SQL');
        },
      },
    });
    try {
      await expect(migrate(db)).rejects.toSatisfy((e: unknown) => e instanceof MigrationError && e.version === 2);
      expect(await getSchemaVersion(db)).toBe(1);
      expect(await tables(db)).toEqual(['a', 'schema_version']);
      const { rows } = await db.exec('PRAGMA foreign_keys');
      expect(rows[0]?.foreign_keys).toBe(1);
    } finally {
      registerSchema(sqliteSchema);
    }
  });

  it('knows the SQLite, MySQL and PostgreSQL schemas', () => {
    expect(getSchema('sqlite')).toBe(sqliteSchema);
    expect(getSchema('mysql').latestVersion).toBe(139);
    expect(getSchema('postgres').latestVersion).toBe(117);
    expect(sqliteSchema.latestVersion).toBe(128);
  });

  it('migrates data of old versions (swimlanes, roles, action names)', async () => {
    const db = fresh();
    await migrate(db, sqliteSchema, 89);
    await db.exec("INSERT INTO users (username, is_admin, is_project_admin) VALUES ('mgr', 0, 1), ('plain', 0, 0)");
    await db.exec("INSERT INTO projects (name) VALUES ('P')");
    await db.exec("INSERT INTO actions (project_id, event_name, action_name) VALUES (1, 'task.move.column', 'TaskClose')");
    await migrate(db, sqliteSchema, 92);
    const roles = await db.table('users').asc('id').findAllByColumn('role');
    expect(roles).toEqual(['app-admin', 'app-manager', 'app-user']);
    expect(await db.table('actions').findOneColumn('action_name')).toBe('\\Kanboard\\Action\\TaskCloseColumn');
    await migrate(db);
    const swimlanes = await db.table('swimlanes').findAll();
    expect(swimlanes).toHaveLength(1);
    expect(swimlanes[0]?.name).toBe('Default swimlane');
  });

  it('leaves foreign keys enabled after a successful and after a failing migration', async () => {
    const db = fresh();
    await migrate(db, sqliteSchema, 5);
    expect(Number((await db.exec('PRAGMA foreign_keys')).rows[0]?.foreign_keys)).toBe(1);

    const failing = { ...sqliteSchema, latestVersion: 6, migrations: { ...sqliteSchema.migrations, 6: async () => { throw new Error('boom'); } } };
    await expect(migrate(db, failing, 6)).rejects.toBeInstanceOf(MigrationError);
    expect(Number((await db.exec('PRAGMA foreign_keys')).rows[0]?.foreign_keys)).toBe(1);
  });
});
