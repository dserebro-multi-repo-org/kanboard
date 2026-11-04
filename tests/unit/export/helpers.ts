import path from 'node:path';
import { loadConfig } from '../../../src/config/index.js';
import type { Container } from '../../../src/core/container/container.js';
import { createContainer, runMigrations } from '../../../src/service-provider/index.js';

/** Container on an in-memory SQLite database with the whole schema, plus fake services (not migrated models). */
export async function createTestContainer(fakes: Record<string, unknown> = {}): Promise<Container> {
  const container = createContainer(
    loadConfig({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: 'true' }, { rootDir: path.resolve('/srv/kb-export-test') }),
  );
  await runMigrations(container);
  const loose = container as unknown as Container<Record<string, unknown>>;
  for (const [name, service] of Object.entries(fakes)) {
    loose.set(name, service);
  }
  return container;
}

/** Seeds the project 1 with the default columns/swimlane the PHP `ProjectModel::create()` makes. */
export async function seedProject(container: Container, name = 'Export Project'): Promise<void> {
  const db = container.get('db');
  await db.table('projects').insert({ id: 1, name });
  await db.table('columns').insert({ id: 1, title: 'Backlog', position: 1, project_id: 1 });
  await db.table('columns').insert({ id: 2, title: 'Ready', position: 2, project_id: 1 });
  await db.table('swimlanes').insert({ id: 1, name: 'Default swimlane', position: 1, project_id: 1 });
}
