import type { SqlValue } from '../db/types.js';
import { BaseModel } from './base-model.js';

/** Row of the `settings` table. */
export interface SettingRow {
  option: string;
  value: string | null;
  changed_by?: number;
  changed_on?: number;
}

/** Values accepted by {@link SettingModel.save}. */
export type SettingValues = Record<string, unknown>;

function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return value;
  if (value instanceof Date || value instanceof Uint8Array) return value;
  return String(value);
}

/**
 * Application settings stored in the `settings` table (port of `app/Model/SettingModel.php`,
 * which is abstract in PHP: subclasses override {@link prepare}).
 */
export class SettingModel extends BaseModel<SettingRow> {
  static readonly TABLE = 'settings';

  getTable(): string {
    return SettingModel.TABLE;
  }

  /** Prepare the data before saving (hook for subclasses). */
  prepare(values: SettingValues): SettingValues {
    return values;
  }

  /** All settings as an `option => value` dictionary. */
  getAll(): Promise<Record<string, unknown>> {
    return this.db.hashtable(SettingModel.TABLE).getAll('option', 'value');
  }

  /** Value of a setting; `defaultValue` when it is missing or empty. */
  async getOption<D = string>(name: string, defaultValue: D = '' as D): Promise<string | D> {
    const value = await this.table().eq('option', name).findOneColumn<string>('value');
    return value === null || value === '' ? defaultValue : value;
  }

  /** Whether the setting exists. */
  exists(name: string): Promise<boolean> {
    return this.table().eq('option', name).exists();
  }

  /** Update or insert settings, atomically. Resolves to `false` if one of the writes failed. */
  async save(values: SettingValues): Promise<boolean> {
    const prepared = this.prepare(values);
    const userId = this.service('userSession').getId();
    const timestamp = Math.floor(Date.now() / 1000);

    const results = await this.db.transaction(async (tx) => {
      const results: boolean[] = [];

      for (const [option, value] of Object.entries(prepared)) {
        const data = { value: toSqlValue(value), changed_on: timestamp, changed_by: userId };
        const table = tx.table(SettingModel.TABLE);

        if (await tx.table(SettingModel.TABLE).eq('option', option).exists()) {
          results.push(await table.eq('option', option).update(data));
        } else {
          results.push(await table.insert({ option, ...data }));
        }
      }

      return results;
    });

    return results !== false && !results.includes(false);
  }

  /** Remove a setting. */
  remove(option: string): Promise<boolean> {
    return this.table().eq('option', option).remove();
  }
}
