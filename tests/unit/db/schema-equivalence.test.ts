import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import { migrate } from '../../../src/db/migrate.js';
import { memoryDb } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

interface TableInfo {
  columns: { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[];
  foreign_keys: { table: string; from: string; to: string | null; on_update: string; on_delete: string }[];
  indexes: { name: string; unique: number; columns: string[] }[];
}

type Dump = Record<string, TableInfo>;

/** Introspect a SQLite database the same way `fixtures/php-schema-dump.php` does. */
async function introspect(db: Database): Promise<Dump> {
  const out: Dump = {};
  const { rows: tables } = await db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");

  for (const t of tables) {
    const name = String(t.name);
    const cols = (await db.exec(`PRAGMA table_info("${name}")`)).rows;
    const fks = (await db.exec(`PRAGMA foreign_key_list("${name}")`)).rows;
    const idx = (await db.exec(`PRAGMA index_list("${name}")`)).rows;
    const indexes = [];

    for (const i of idx) {
      const info = (await db.exec(`PRAGMA index_info("${String(i.name)}")`)).rows;
      indexes.push({ name: String(i.name), unique: Number(i.unique), columns: info.map((c) => String(c.name)) });
    }

    out[name] = normalize({
      columns: cols.map((c) => ({ name: String(c.name), type: String(c.type), notnull: Number(c.notnull), dflt_value: c.dflt_value === null ? null : String(c.dflt_value), pk: Number(c.pk) })),
      foreign_keys: fks.map((f) => ({ table: String(f.table), from: String(f.from), to: f.to === null ? null : String(f.to), on_update: String(f.on_update), on_delete: String(f.on_delete) })),
      indexes,
    });
  }

  return out;
}

function normalize(info: TableInfo): TableInfo {
  return {
    columns: info.columns,
    foreign_keys: [...info.foreign_keys].sort((a, b) => `${a.from}.${a.table}`.localeCompare(`${b.from}.${b.table}`)),
    indexes: [...info.indexes].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

let phpDump: { version: number; tables: Dump } | null = null;
let tsDb: Database;

beforeAll(async () => {
  try {
    const stdout = execFileSync('php', [resolve(here, 'fixtures/php-schema-dump.php'), root], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const raw = JSON.parse(stdout) as { version: number; tables: Record<string, TableInfo> };
    const tables: Dump = {};

    for (const [name, info] of Object.entries(raw.tables)) {
      tables[name] = normalize({
        columns: info.columns.map((c) => ({ name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk })),
        foreign_keys: info.foreign_keys.map((f) => ({ table: f.table, from: f.from, to: f.to, on_update: f.on_update, on_delete: f.on_delete })),
        indexes: info.indexes.map((i) => ({ name: i.name, unique: Number(i.unique), columns: i.columns })),
      });
    }

    phpDump = { version: raw.version, tables };
  } catch {
    phpDump = null; // PHP (with vendor/ installed) unavailable: the equivalence test is skipped
  }

  tsDb = memoryDb();
  await migrate(tsDb);
});

afterAll(async () => {
  await tsDb.close();
});

describe('SQLite schema equivalence with app/Schema/Sqlite.php', () => {
  it('creates the same tables, columns, foreign keys and indexes as the PHP schema', async (ctx) => {
    if (phpDump === null) return ctx.skip();

    const ts = await introspect(tsDb);
    delete ts.schema_version; // replaces PRAGMA user_version

    expect(Object.keys(ts)).toEqual(Object.keys(phpDump.tables));
    expect(ts).toEqual(phpDump.tables);
  });

  it('reaches the same schema version as PHP', async (ctx) => {
    if (phpDump === null) return ctx.skip();

    const { rows } = await tsDb.exec('SELECT version FROM schema_version');
    expect(Number(rows[0]?.version)).toBe(phpDump.version);
  });
});
