import { existsSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { getToken } from '../core/security/token.js';
import { registerDatabaseService } from '../db/register.js';
import { SettingModel, valueOrDefault, type SettingValues } from './setting-model.js';

/** Database specific settings reported by {@link ConfigModel.getDatabaseOptions}. */
export type DatabaseOptions = Record<string, unknown>;

/** Application configuration stored in the database (port of `app/Model/ConfigModel.php`). */
export class ConfigModel extends SettingModel {
  /**
   * Get a config variable with in-memory caching (the whole settings table is loaded once per
   * `memoryCache` lifetime). Missing or empty values give `defaultValue`.
   */
  async get<D = string>(name: string, defaultValue: D = '' as D): Promise<string | D> {
    const options = await this.service('memoryCache').proxy<ConfigModel, Promise<Record<string, unknown>>>(this, 'getAll');
    return valueOrDefault(options[name], defaultValue);
  }

  /** Optimize the database (`VACUUM`); not supported by MySQL. */
  async optimizeDatabase(): Promise<boolean> {
    if (this.db.driver === 'mysql') {
      return false;
    }

    await this.db.exec('VACUUM');
    return true;
  }

  /** Database file compressed with gzip (SQLite only). */
  async downloadDatabase(): Promise<Buffer> {
    return gzipSync(await readFile(this.service('config').DB_FILENAME));
  }

  /** Replace the database file with a gzip compressed one and reconnect (SQLite only). */
  async uploadDatabase(file: string): Promise<boolean> {
    const content = gunzipSync(await readFile(file));
    await this.db.closeConnection();
    await writeFile(this.service('config').DB_FILENAME, content);
    // The old connection is closed: the next access to the `db` service opens a new one.
    registerDatabaseService(this.container);
    return true;
  }

  /** Size in bytes of the SQLite database file (0 for the other drivers or in-memory databases). */
  getDatabaseSize(): number {
    const config = this.service('config');
    return config.DB_DRIVER === 'sqlite' && existsSync(config.DB_FILENAME) ? statSync(config.DB_FILENAME).size : 0;
  }

  /** Extra options of the database engine (SQLite pragmas, empty for the other drivers). */
  async getDatabaseOptions(): Promise<DatabaseOptions> {
    if (this.db.driver !== 'sqlite') {
      return {};
    }

    const options: DatabaseOptions = {};

    for (const pragma of ['journal_mode', 'wal_autocheckpoint', 'synchronous', 'busy_timeout']) {
      const { rows } = await this.db.exec(`PRAGMA ${pragma}`);
      options[pragma] = rows[0] === undefined ? null : Object.values(rows[0])[0];
    }

    return options;
  }

  /** Regenerate a token setting (e.g. `api_token`, `webhook_token`). */
  regenerateToken(option: string): Promise<boolean> {
    return this.save({ [option]: getToken() });
  }

  /** Make sure the application URL ends with a slash. */
  override prepare(values: SettingValues): SettingValues {
    const url = values.application_url;

    if (typeof url === 'string' && url !== '' && !url.endsWith('/')) {
      return { ...values, application_url: `${url}/` };
    }

    return values;
  }
}
