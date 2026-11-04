import { Table } from './table.js';
import type { DbRow } from './types.js';

/** Key/value table helper (port of `PicoDb\Hashtable`, e.g. the `settings` table). */
export class Hashtable extends Table<DbRow> {
  private keyColumn = 'key';
  private valueColumn = 'value';

  columnKey(column: string): this {
    this.keyColumn = column;
    return this;
  }

  columnValue(column: string): this {
    this.valueColumn = column;
    return this;
  }

  /** Insert or replace the entries of the dictionary, atomically. */
  async put(hashmap: Record<string, string | number | boolean | null>): Promise<boolean> {
    const keys = Object.keys(hashmap);

    if (keys.length === 0) {
      return true;
    }

    const sql = this.db.getDriver().upsert(this.name, this.keyColumn, this.valueColumn, keys.length);
    const values = keys.flatMap((key) => [key, hashmap[key] as string | number | boolean | null]);

    const result = await this.db.transaction(async (tx) => tx.execute(sql, values));
    return result !== false;
  }

  /** Read the dictionary, optionally restricted to the given keys. */
  async get(...keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length > 0) {
      this.in(this.keyColumn, keys);
    }

    this.columns(this.keyColumn, this.valueColumn);

    const result = await this.db.execute(this.buildSelectQuery(), this.getConditionBuilder().getValues());
    const hashmap: Record<string, unknown> = {};

    for (const row of result === false ? [] : result.rows) {
      hashmap[String(row[this.keyColumn])] = row[this.valueColumn];
    }

    return hashmap;
  }

  /** Read the whole dictionary using the given key and value columns. */
  getAll(key: string, value: string): Promise<Record<string, unknown>> {
    this.keyColumn = key;
    this.valueColumn = value;
    return this.get();
  }
}
