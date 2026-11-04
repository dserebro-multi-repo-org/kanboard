import type { Database } from './database.js';
import { getSchema, type SchemaDefinition } from './schema/index.js';

/** Name of the table storing the current schema version (same as the PostgreSQL/MySQL PHP drivers). */
export const SCHEMA_VERSION_TABLE = 'schema_version';

/** Outcome of {@link migrate}. */
export interface MigrationResult {
  /** Version found before the run. */
  from: number;
  /** Version after the run. */
  to: number;
  /** Versions executed by this run, in order. */
  applied: number[];
}

/** Raised when a migration fails; the failing version was rolled back. */
export class MigrationError extends Error {
  constructor(
    readonly version: number,
    cause: unknown,
  ) {
    super(`Unable to run SQL migrations: version ${version}: ${cause instanceof Error ? cause.message : String(cause)} (You may have to fix it manually)`, { cause });
    this.name = 'MigrationError';
  }
}

/**
 * Current schema version, 0 for an empty database. Creates the `schema_version` table when needed.
 * A SQLite database created by the PHP application (which stored the version in `PRAGMA user_version`)
 * is recognised and its version is adopted.
 */
export async function getSchemaVersion(db: Database): Promise<number> {
  await db.exec(`CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (version INTEGER DEFAULT 0)`);

  const { rows } = await db.exec(`SELECT ${db.escapeIdentifier('version')} FROM ${SCHEMA_VERSION_TABLE}`);
  const first = rows[0];

  if (first !== undefined) {
    return Number(first.version);
  }

  let version = 0;

  if (db.driver === 'sqlite') {
    const pragma = await db.exec('PRAGMA user_version');
    version = Number(pragma.rows[0]?.user_version ?? 0);
  }

  await db.exec(`INSERT INTO ${SCHEMA_VERSION_TABLE} VALUES (?)`, [version]);
  return version;
}

/** Store the schema version. */
export async function setSchemaVersion(db: Database, version: number): Promise<void> {
  await db.exec(`UPDATE ${SCHEMA_VERSION_TABLE} SET version=?`, [version]);
}

/**
 * Bring the database schema up to date (port of `PicoDb\Schema::check()` / `migrateTo()`).
 *
 * For each version after the stored one, in sequence: foreign keys are disabled, the migration runs
 * in a transaction together with the version bump, then foreign keys are enabled again. The call is
 * idempotent: when the database is already at the latest version nothing is executed.
 *
 * @param db       database to migrate
 * @param schema   schema definition, defaults to the one of the database driver
 * @param target   last version to apply, defaults to the latest one
 * @throws MigrationError when a version fails (the failing version is rolled back)
 */
export async function migrate(db: Database, schema: SchemaDefinition = getSchema(db.driver), target: number = schema.latestVersion): Promise<MigrationResult> {
  const from = await getSchemaVersion(db);
  const applied: number[] = [];

  for (let version = from + 1; version <= target; version++) {
    try {
      const migration = schema.migrations[version];

      await db.withForeignKeysDisabled((pinned) =>
        pinned.transaction(async (tx) => {
          if (migration !== undefined) {
            await migration(tx);
          }

          await setSchemaVersion(tx, version);
        }),
      );

      applied.push(version);
    } catch (error) {
      throw new MigrationError(version, error);
    }
  }

  return { from, to: Math.max(from, target), applied };
}
