import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from '../../../src/core/container/container.js';
import { phpDate } from '../../../src/core/php-date.js';
import { ExternalLinkProviderNotFound } from '../../../src/foundation/export-import-collaborators.js';
import { TaskImport } from '../../../src/import/task-import.js';
import { createTestContainer, spyLogger } from './helpers.js';

let container: Container;
let created: Array<Record<string, unknown>>;
let tags: unknown[][];
let links: Array<Record<string, unknown>>;
const log = spyLogger();
let linkValid = true;
let provider: 'ok' | 'missing' = 'ok';
let dir: string;

beforeEach(async () => {
  created = [];
  tags = [];
  links = [];
  linkValid = true;
  provider = 'ok';
  log.debug.length = 0;
  log.error.length = 0;
  dir = mkdtempSync(path.join(tmpdir(), 'kb-import-'));

  const manager = {
    setUserInputText() { return this; },
    setUserInputType() { return this; },
    find() {
      if (provider === 'missing') throw new ExternalLinkProviderNotFound('nope');
      return { getLink: () => ({ getTitle: () => '', getUrl: () => 'http://example.com' }), getDependencies: () => ({ related: 'Related' }), getType: () => 'weblink' };
    },
  };

  container = await createTestContainer({
    logger: log.instance,
    userModel: { getIdByUsername: (n: string) => (n === 'admin' ? 1 : false) },
    colorModel: { find: (c: string) => c.toLowerCase() },
    columnModel: { getColumnIdByTitle: (p: number, title: string) => (title === 'Ready' ? 2 : false) },
    categoryModel: { getIdByName: () => 5 },
    swimlaneModel: { getIdByName: () => 0 },
    taskCreationModel: {
      create: (values: Record<string, unknown>) => {
        created.push(values);
        return values.title === 'fail' ? false : created.length;
      },
    },
    taskTagModel: { save: (...args: unknown[]) => void tags.push(args) },
    externalLinkManager: manager,
    externalLinkValidator: { validateCreation: () => [linkValid, linkValid ? {} : { url: ['bad'] }] },
    taskExternalLinkModel: { create: (values: Record<string, unknown>) => void links.push(values) },
  });
  // The `logger` service is the real one by default: replace it for the assertions.
  (container as unknown as Container<Record<string, unknown>>).set('logger', log.instance);
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
  await container.get('db').close();
});

const row = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  reference: 'R1', title: 'Title', description: 'Desc', assignee: '', creator: '', color: '', column: '', category: '', swimlane: '', score: '3',
  time_estimated: '1.5', time_spent: '2', date_started: '', date_due: '', priority: '1', is_active: 'no', tags: '', external_link: '', ...extra,
});

describe('TaskImport', () => {
  it('maps the columns', () => {
    const mapping = new TaskImport(container).getColumnMapping();
    expect(Object.keys(mapping)).toHaveLength(18);
    expect(mapping.title).toBe('Title');
    expect(mapping.external_link).toBe('External Link');
  });

  it('prepares a task', async () => {
    const importer = new TaskImport(container).setProjectId(7);
    const values = await importer.prepareTask(
      row({ assignee: 'admin', creator: 'ghost', color: 'Red', column: 'Ready', category: 'C', swimlane: 'S', date_due: '2016-06-09', is_active: 'Yes', priority: '0' }),
    );

    expect(values).toMatchObject({
      project_id: 7, reference: 'R1', title: 'Title', description: 'Desc', is_active: 0, score: 3,
      time_estimated: 1.5, time_spent: 2, owner_id: 1, color_id: 'red', column_id: 2, category_id: 5,
    });
    expect(phpDate('Y-m-d', values.date_due as number)).toBe('2016-06-09');
    // empty values are removed: unknown creator (false), swimlane 0, priority 0, no start date
    expect(values).not.toHaveProperty('creator_id');
    expect(values).not.toHaveProperty('swimlane_id');
    expect(values).not.toHaveProperty('priority');
    expect(values).not.toHaveProperty('date_started');
  });

  it('imports valid rows and counts them', async () => {
    const importer = new TaskImport(container).setProjectId(1);
    await importer.importTask(row({ tags: 'a, b,, c', external_link: 'http://example.com' }), 1);

    expect(importer.getNumberOfImportedTasks()).toBe(1);
    expect(tags).toEqual([[1, 1, ['a', 'b', 'c']]]);
    expect(links).toEqual([{ task_id: 1, title: 'http://example.com', url: 'http://example.com', link_type: 'weblink', dependency: 'related' }]);
    expect(log.debug[0]).toContain('imported successfully line 1');
  });

  it('logs validation and creation errors', async () => {
    const importer = new TaskImport(container).setProjectId(1);
    await importer.importTask(row({ title: '' }), 2);
    await importer.importTask(row({ title: 'fail' }), 3);

    expect(importer.getNumberOfImportedTasks()).toBe(0);
    expect(log.error[0]).toContain('validation error at line 2');
    expect(log.error[1]).toContain('creation error at line 3');
  });

  it('logs external link errors', async () => {
    const importer = new TaskImport(container).setProjectId(1);
    linkValid = false;
    await importer.importTask(row({ external_link: 'x' }), 1);
    expect(links).toHaveLength(0);
    expect(log.error[0]).toContain('{"url":["bad"]}');

    provider = 'missing';
    await importer.importTask(row({ external_link: 'x' }), 2);
    expect(log.error[1]).toContain('nope');
  });

  it('imports a CSV file', async () => {
    const file = path.join(dir, 'tasks.csv');
    writeFileSync(file, 'Reference,Title,Description,Assignee\nr1,First,"multi\nline",admin\nr2,Second,,\n,,,\n');
    const importer = new TaskImport(container).setProjectId(1);
    await importer.importFile(file);

    expect(importer.getNumberOfImportedTasks()).toBe(2);
    expect(created[0]).toMatchObject({ reference: 'r1', title: 'First', description: 'multi\nline', owner_id: 1 });
    expect(created[1]).toMatchObject({ reference: 'r2', title: 'Second' });
  });
});
