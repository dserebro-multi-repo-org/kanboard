import { Container } from '../../../src/core/container/container.js';
import { HelperRegistry } from '../../../src/foundation/helper.js';
import { HookRegistry } from '../../../src/foundation/plugin.js';
import { htmlspecialchars } from '../../../src/foundation/translator.js';
import { Database } from '../../../src/db/database.js';
import { migrate } from '../../../src/db/migrate.js';
import type { Row } from '../../../src/foundation/model.js';
import { AnalyticServiceProvider } from '../../../src/analytic/provider.js';
import { FormatterServiceProvider } from '../../../src/formatter/provider.js';
import { PaginationServiceProvider } from '../../../src/pagination/provider.js';

/** Container typed loosely so tests can register mocked collaborators under their PHP keys. */
export type LooseContainer = Container & {
  set(key: string, value: unknown): LooseContainer;
  get(key: string): unknown;
};

function query(params: Row | undefined): string {
  return Object.entries(params ?? {})
    .map(([key, value]) => `&${key}=${String(value)}`)
    .join('');
}

/** Template helpers doubles producing predictable output. */
export function fakeHelpers(container: Container): HelperRegistry {
  const helpers = new HelperRegistry(container);
  helpers.set('url', {
    container,
    to: (controller: string, action: string, params?: Row, _anchor?: string, absolute?: boolean) =>
      `${absolute ? 'http://kb/' : ''}?controller=${controller}&action=${action}${query(params)}`,
    link: (label: string, controller: string, action: string, params?: Row, _csrf?: boolean, cls?: string, title?: string, _tab?: boolean, anchor?: string) =>
      `<a href="?controller=${controller}&action=${action}${query(params)}" class="${cls ?? ''}" title="${title ?? ''}" anchor="${anchor ?? ''}">${label}</a>`,
    base: () => 'http://kb/',
  } as never);
  helpers.set('text', {
    container,
    e: (value: unknown) => htmlspecialchars(String(value ?? '')),
    markdown: (text: string) => `<p>${text}</p>`,
  } as never);
  helpers.set('avatar', {
    container,
    small: (id: number, username: string, _name: string, _email: string, _path: string, cls: string) =>
      `<avatar id="${id}" user="${username}" class="${cls}">`,
  } as never);
  helpers.set('projectRole', { container, isDraggable: () => true } as never);
  return helpers;
}

/** Container with hooks, helper doubles and the formatter / pagination / analytic services. */
export function createTestContainer(db?: Database): LooseContainer {
  const container = new Container();
  container.register('hook', () => new HookRegistry());
  container.register('helper', (c) => fakeHelpers(c));
  if (db !== undefined) container.set('db', db);
  new FormatterServiceProvider().register(container);
  new PaginationServiceProvider().register(container);
  new AnalyticServiceProvider().register(container);
  return container as unknown as LooseContainer;
}

/** In-memory SQLite database with the whole schema. */
export async function migratedDb(): Promise<Database> {
  const db = Database.connect({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:' });
  await migrate(db);
  return db;
}

/** Project with the 4 default columns and the default swimlane. */
export async function seedProject(db: Database, name = 'Test'): Promise<number> {
  const projectId = (await db.table('projects').insertAndGetId({ name, is_active: 1 })) as number;
  const titles = ['Backlog', 'Ready', 'Work in progress', 'Done'];
  for (const [position, title] of titles.entries()) {
    await db.table('columns').insert({ title, position: position + 1, project_id: projectId });
  }
  await db.table('swimlanes').insert({ name: 'Default swimlane', position: 1, is_active: 1, project_id: projectId });
  return projectId;
}

/** Insert a task, returns its id. */
export async function seedTask(db: Database, values: Row): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  // Like TaskCreationModel: default to the first column and swimlane of the project.
  const first = async (table: string): Promise<number> =>
    ((await db.table(table).eq('project_id', values['project_id'] as number).asc('position').findOne()) as { id: number } | null)?.id ?? 0;
  const id = await db.table('tasks').insertAndGetId({
    column_id: await first('columns'),
    swimlane_id: await first('swimlanes'),
    date_creation: now,
    date_modification: now,
    date_moved: now,
    is_active: 1,
    position: 1,
    ...values,
  });
  if (id === false) throw new Error(`task insert failed: ${JSON.stringify(values)}`);
  return id;
}

export function set(container: LooseContainer, key: string, value: unknown): void {
  container.set(key, value);
}
