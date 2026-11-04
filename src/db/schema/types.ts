import type { Database } from '../database.js';
import type { DbDriver } from '../types.js';

/** One schema version step (`Schema\version_N(PDO $pdo)` in the PHP code base). */
export type MigrationFunction = (db: Database) => Promise<void>;

/** The ordered list of schema migrations of a database engine. */
export interface SchemaDefinition {
  /** Engine of the schema. `'mssql'` is schema-only: there is no runtime MSSQL driver (`DbDriver`) yet. */
  readonly driver: DbDriver | 'mssql';
  /** Highest version (`Schema\VERSION`). */
  readonly latestVersion: number;
  /** Migrations by version number; a missing version is a no-op that only bumps the version. */
  readonly migrations: Readonly<Record<number, MigrationFunction>>;
}
