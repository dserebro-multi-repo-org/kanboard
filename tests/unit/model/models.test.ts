import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config/index.js';
import type { Container } from '../../../src/core/container/container.js';
import { migrate } from '../../../src/db/migrate.js';
import { BaseModel, ConfigModel, SettingModel } from '../../../src/model/index.js';
import { createContainer, runMigrations } from '../../../src/service-provider/index.js';

let container: Container;
let config: ConfigModel;

beforeEach(async () => {
  container = createContainer(loadConfig({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: 'true' }, { rootDir: path.resolve('/srv/kb-model-test') }));
  await runMigrations(container);
  config = container.get('configModel');
});

afterEach(async () => {
  await container.get('db').close();
});

describe('service registration', () => {
  it('registers db and the models as lazy singletons', () => {
    expect(container.get('db')).toBe(container.get('db'));
    expect(container.get('configModel')).toBeInstanceOf(ConfigModel);
    expect(container.get('settingModel')).toBeInstanceOf(SettingModel);
    expect(container.get('configModel')).toBe(container.get('configModel'));
  });

  it('skips the migrations when DB_RUN_MIGRATIONS is off', async () => {
    const other = createContainer(loadConfig({ DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: 'false' }, { rootDir: '/srv/x' }));
    expect(await runMigrations(other)).toBeNull();
  });

  it('reports the migration result', async () => {
    const other = createContainer(loadConfig({ DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: 'true' }, { rootDir: '/srv/x' }));
    expect((await runMigrations(other))?.to).toBe(128);
    await other.get('db').close();
  });
});

describe('BaseModel', () => {
  class FooModel extends BaseModel {
    getTable(): string {
      return 'settings';
    }
    query() {
      return this.table();
    }
    database() {
      return this.db;
    }
    digest(v: string) {
      return this.hash(v);
    }
  }

  it('gives access to db and the main table', async () => {
    const foo = FooModel.getInstance(container);
    expect(foo.container).toBe(container);
    expect(foo.database()).toBe(container.get('db'));
    expect(await foo.query().eq('option', 'application_currency').findOneColumn('value')).toBe('USD');
  });

  it('generates tokens and hashes', () => {
    const foo = new FooModel(container);
    expect(foo.generateToken()).toMatch(/^[0-9a-f]{60}$/);
    expect(foo.generateToken(8)).toHaveLength(16);
    expect(foo.generateToken()).not.toBe(foo.generateToken());
    expect(foo.digest('a')).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
  });
});

describe('SettingModel', () => {
  it('has its own table and an identity prepare()', async () => {
    const model = container.get('settingModel');
    expect(model.getTable()).toBe('settings');
    expect(model.prepare({ a: 1 })).toEqual({ a: 1 });
    expect(await model.save({ some: 'value' })).toBe(true);
    expect(await model.getOption('some')).toBe('value');
    expect(await model.remove('some')).toBe(true);
    expect(await model.exists('some')).toBe(false);
    expect(await model.remove('some')).toBe(false);
  });

  it('stores changed_on / changed_by', async () => {
    await config.save({ k: 'v' });
    const row = await container.get('db').table('settings').eq('option', 'k').findOne();
    expect(row?.changed_by).toBe(0);
    expect(Number(row?.changed_on)).toBeGreaterThan(1_600_000_000);
  });

  it('coerces non scalar values', async () => {
    await config.save({ n: 5, b: true, nul: null, arr: [1, 2] });
    expect(await config.getOption('n')).toBe('5');
    expect(await config.getOption('b')).toBe('1');
    expect(await config.getOption('nul', 'd')).toBe('d');
    expect(await config.getOption('arr')).toBe('1,2');
  });
});

// Port of tests/units/Model/ConfigModelTest.php
describe('ConfigModel', () => {
  it('testRegenerateToken', async () => {
    const token = await config.getOption('api_token');
    expect(await config.regenerateToken('api_token')).toBe(true);
    expect(await config.getOption('api_token')).not.toBe(token);
  });

  it('testCRUDOperations', async () => {
    expect(await config.save({ key1: 'value1' })).toBe(true);
    expect(await config.save({ key1: 'value2' })).toBe(true);
    expect(await config.save({ key2: 'value2' })).toBe(true);

    expect(await config.getOption('key1')).toBe('value2');
    expect(await config.getOption('key2')).toBe('value2');
    expect(await config.getOption('key3')).toBe('');
    expect(await config.getOption('key3', 'default')).toBe('default');

    expect(await config.exists('key1')).toBe(true);
    expect(await config.exists('key3')).toBe(false);

    expect(await config.save({ key1: 'value1' })).toBe(true);

    const all = await config.getAll();
    expect(all).toHaveProperty('key1');
    expect(all).toHaveProperty('key2');
    expect(Object.values(all)).toContain('value1');
    expect(Object.values(all)).toContain('value2');
  });

  it('testSaveApplicationUrl', async () => {
    expect(await config.save({ application_url: 'http://localhost/' })).toBe(true);
    expect(await config.getOption('application_url')).toBe('http://localhost/');
    expect(await config.save({ application_url: 'http://localhost' })).toBe(true);
    expect(await config.getOption('application_url')).toBe('http://localhost/');
    expect(await config.save({ application_url: '' })).toBe(true);
    expect(await config.getOption('application_url')).toBe('');
  });

  it('testDefaultValues', async () => {
    const o = (name: string) => config.getOption(name);
    expect(Number(await o('board_highlight_period'))).toBe(172800);
    expect(Number(await o('board_public_refresh_interval'))).toBe(60);
    expect(Number(await o('board_private_refresh_interval'))).toBe(10);
    expect(await o('board_columns')).toBe('');

    expect(await o('default_color')).toBe('yellow');
    expect(await o('application_language')).toBe('en_US');
    expect(await o('application_timezone')).toBe('UTC');
    expect(await o('application_date_format')).toBe('m/d/Y');
    expect(await o('application_url')).toBe('');
    expect(await o('application_stylesheet')).toBe('');
    expect(await o('application_currency')).toBe('USD');

    expect(Number(await o('calendar_user_subtasks_time_tracking'))).toBe(0);
    expect(await o('calendar_user_tasks')).toBe('date_started');
    expect(await o('calendar_project_tasks')).toBe('date_started');

    expect(Number(await o('integration_gravatar'))).toBe(0);
    expect(Number(await o('cfd_include_closed_tasks'))).toBe(1);
    expect(Number(await o('password_reset'))).toBe(1);

    expect(Number(await o('subtask_time_tracking'))).toBe(1);
    expect(Number(await o('subtask_restriction'))).toBe(0);
    expect(await o('project_categories')).toBe('');

    expect(await o('webhook_url_task_modification')).toBe('');
    expect(await o('webhook_url_task_creation')).toBe('');
    expect(await o('webhook_token')).not.toBe('');
    expect(await o('webhook_url')).toBe('');

    expect(await o('api_token')).not.toBe('');
  });

  it('testGetOption', async () => {
    expect(await config.getOption('board_columns')).toBe('');
    expect(await config.getOption('board_columns', 'test')).toBe('test');
    expect(await config.getOption('board_columns', 0)).toBe(0);
  });

  it('testGetWithCaching', async () => {
    expect(await config.get('application_timezone')).toBe('UTC');
    expect(await config.save({ application_timezone: 'Europe/Paris' })).toBe(true);

    expect(await config.get('application_timezone')).toBe('UTC'); // cached value
    expect(await config.getOption('application_timezone')).toBe('Europe/Paris');

    expect(await config.get('board_columns')).toBe('');
    expect(await config.get('board_columns', 'test')).toBe('test');
    expect(await config.get('empty_value', 'test')).toBe('test');
  });

  it('testValueLength', async () => {
    const string = 'a'.repeat(65535);
    expect(await config.save({ application_stylesheet: string })).toBe(true);
    expect(await config.getOption('application_stylesheet')).toBe(string);
  });

  it('exposes database information and maintenance', async () => {
    expect(await config.optimizeDatabase()).toBe(true);
    expect(config.getDatabaseSize()).toBe(0);
    const options = await config.getDatabaseOptions();
    expect(Object.keys(options)).toEqual(['journal_mode', 'wal_autocheckpoint', 'synchronous', 'busy_timeout']);
    expect(options.journal_mode).toBe('memory');
  });
});

describe('ConfigModel with a database file', () => {
  it('downloads, uploads and sizes the database file', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const os = await import('node:os');
    const zlib = await import('node:zlib');
    const dir = mkdtempSync(path.join(os.tmpdir(), 'kb-cfg-'));
    const file = path.join(dir, 'db.sqlite');
    const c = createContainer(loadConfig({ DB_FILENAME: file, DB_RUN_MIGRATIONS: 'true' }, { rootDir: dir }));
    try {
      await runMigrations(c);
      const model = c.get('configModel');
      await model.save({ marker: 'before' });
      expect(model.getDatabaseSize()).toBeGreaterThan(0);

      const gz = await model.downloadDatabase();
      expect(zlib.gunzipSync(gz).subarray(0, 15).toString()).toBe('SQLite format 3');

      // restore the dump after changing the data: the db service reconnects
      await model.save({ marker: 'after' });
      const upload = path.join(dir, 'dump.gz');
      writeFileSync(upload, gz);
      const before = c.get('db');
      expect(await model.uploadDatabase(upload)).toBe(true);
      expect(c.get('db')).not.toBe(before);
    } finally {
      await c.get('db').close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('migrate() through the container', () => {
  it('is idempotent on the container database', async () => {
    expect((await migrate(container.get('db'))).applied).toEqual([]);
  });
});
