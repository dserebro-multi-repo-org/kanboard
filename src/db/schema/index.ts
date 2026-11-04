import type { DbDriver } from '../types.js';
import { mysqlSchema } from './mysql.js';
import { mssqlSchema } from './mssql.js';
import { postgresSchema } from './postgres.js';
import { sqliteSchema } from './sqlite.js';
import type { SchemaDefinition } from './types.js';

export type { MigrationFunction, SchemaDefinition } from './types.js';
export { mysqlSchema } from './mysql.js';
export { MSSQL_SCHEMA_VERSION, mssqlSchema } from './mssql.js';
export { postgresSchema } from './postgres.js';
export { sqliteSchema } from './sqlite.js';

const schemas: Partial<Record<DbDriver | 'mssql', SchemaDefinition>> = {
  sqlite: sqliteSchema,
  mysql: mysqlSchema,
  postgres: postgresSchema,
  mssql: mssqlSchema,
};

/** Schema of a driver. SQLite, MySQL and PostgreSQL are ported (MSSQL has no driver in this code base). */
export function getSchema(driver: DbDriver): SchemaDefinition {
  const schema = schemas[driver];

  if (schema === undefined) {
    throw new Error(`No database schema is available yet for the "${driver}" driver`);
  }

  return schema;
}

/** Schema by engine name, including the schema-only `'mssql'` (no runtime driver exists for it). */
export function getSchemaByName(name: DbDriver | 'mssql'): SchemaDefinition {
  const schema = schemas[name];

  if (schema === undefined) {
    throw new Error(`No database schema is available yet for the "${name}" driver`);
  }

  return schema;
}

/** Register the schema of a driver (used by plugins/tests and by the MySQL/PostgreSQL ports). */
export function registerSchema(schema: SchemaDefinition): void {
  schemas[schema.driver] = schema;
}
