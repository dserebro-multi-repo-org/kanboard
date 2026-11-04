import path from 'node:path';
import { loadConfig } from '../../../src/config/index.js';
import type { Container } from '../../../src/core/container/container.js';
import { runMigrations, createContainer } from '../../../src/service-provider/index.js';
import type { HelperRegistry } from '../../../src/foundation/helper.js';

/** Container with the core services; `db` adds an in-memory sqlite database with migrations. */
export async function makeContainer(db = false, env: Record<string, string> = {}): Promise<Container> {
  const container = createContainer(
    loadConfig({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: db ? 'true' : 'false', ...env }, { rootDir: path.resolve('/srv/kb-helper-test') }),
  );
  if (db) await runMigrations(container);
  return container;
}

/** Register a service that is not part of the typed registry yet (request, token, template, ...). */
export function setService(container: Container, key: string, value: unknown): void {
  (container as unknown as { set(key: string, value: unknown): void }).set(key, value);
}

export function helpers(container: Container): HelperRegistry {
  return container.get('helper');
}
