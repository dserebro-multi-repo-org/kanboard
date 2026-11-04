import type { DbDriver } from '../types.js';
import { sqliteSchema } from './sqlite.js';
import type { SchemaDefinition } from './types.js';

export type { MigrationFunction, SchemaDefinition } from './types.js';
export { sqliteSchema } from './sqlite.js';

const schemas: Partial<Record<DbDriver, SchemaDefinition>> = {
  sqlite: sqliteSchema,
  // mysql: ported by a later milestone (app/Schema/Mysql.php)
  // postgres: ported by a later milestone (app/Schema/Postgres.php)
};

/** Schema of a driver. Only SQLite is ported yet; MySQL and PostgreSQL are added by later milestones. */
export function getSchema(driver: DbDriver): SchemaDefinition {
  const schema = schemas[driver];

  if (schema === undefined) {
    throw new Error(`No database schema is available yet for the "${driver}" driver`);
  }

  return schema;
}

/** Register the schema of a driver (used by plugins/tests and by the MySQL/PostgreSQL ports). */
export function registerSchema(schema: SchemaDefinition): void {
  schemas[schema.driver] = schema;
}
