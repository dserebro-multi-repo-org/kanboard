import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import { TaskCategoryFilter } from '../../../src/filter/task-category-filter.js';
import { TaskCommentFilter } from '../../../src/filter/task-comment-filter.js';
import { TaskLinkFilter } from '../../../src/filter/task-link-filter.js';
import { TaskMovedDateFilter } from '../../../src/filter/task-moved-date-filter.js';
import { TaskPriorityFilter } from '../../../src/filter/task-priority-filter.js';
import { TaskReferenceFilter } from '../../../src/filter/task-reference-filter.js';
import { TaskSearchFilter } from '../../../src/filter/task-search-filter.js';
import { TaskStartsWithIdFilter } from '../../../src/filter/task-starts-with-id-filter.js';
import { TaskStatusFilter } from '../../../src/filter/task-status-filter.js';
import { TaskTagFilter } from '../../../src/filter/task-tag-filter.js';
import { addComment, addProject, addTask, createDb, dateParser, extendedQuery, now, ymd } from './fixtures.js';

let db: Database;
beforeEach(async () => {
  db = await createDb();
  expect(await addProject(db, 'Test')).toBe(1);
});
afterEach(async () => {
  await db.close();
});

type Applicable = { withQuery(q: ReturnType<typeof extendedQuery>): { apply(): unknown } };

async function run(filter: Applicable, order?: string): Promise<Record<string, unknown>[]> {
  const query = extendedQuery(db);
  filter.withQuery(query).apply();
  if (order !== undefined) query.asc(order);
  return query.findAll();
}

const titles = (rows: Record<string, unknown>[]): unknown[] => rows.map((r) => r.title);

describe('TaskCategoryFilter', () => {
  async function seed(categoryName: string): Promise<void> {
    await db.table('project_has_categories').insert({ name: categoryName, project_id: 1 });
    await addTask(db, { project_id: 1, title: 'test1' });
    await addTask(db, { project_id: 1, title: 'test2', category_id: 1 });
  }

  it('filters by category name', async () => {
    await seed('Some category');
    expect(titles(await run(new TaskCategoryFilter('Some category')))).toEqual(['test2']);
  });
  it('filters by category id', async () => {
    await seed('Some category');
    expect(titles(await run(new TaskCategoryFilter('1')))).toEqual(['test2']);
  });
  it('filters by no category', async () => {
    await seed('Some category');
    expect(titles(await run(new TaskCategoryFilter('none')))).toEqual(['test1']);
  });
  it('filters by numeric category name', async () => {
    await seed('1234');
    expect(titles(await run(new TaskCategoryFilter('1234')))).toEqual(['test2']);
  });
});

describe('TaskCommentFilter', () => {
  it('matches', async () => {
    await addTask(db, { title: 'Test', project_id: 1 });
    await addComment(db, 1, 1, 'This is a test');
    await addComment(db, 1, 1, 'This is another test');
    expect(await run(new TaskCommentFilter('test').setDatabase(db))).toHaveLength(1);
  });
  it('does not match', async () => {
    await addTask(db, { title: 'Test', project_id: 1 });
    await addComment(db, 1, 1, 'This is a test');
    expect(await run(new TaskCommentFilter('foobar').setDatabase(db))).toHaveLength(0);
  });
});

describe('TaskLinkFilter', () => {
  beforeEach(async () => {
    await addTask(db, { title: 'Test 1', project_id: 1 });
    await addTask(db, { title: 'Test 2', project_id: 1 });
    // TaskLinkModel::create(1, 2, 'blocks'): one row per direction with the opposite link.
    await db.table('task_has_links').insert({ task_id: 1, opposite_task_id: 2, link_id: 2 });
    await db.table('task_has_links').insert({ task_id: 2, opposite_task_id: 1, link_id: 3 });
  });

  it('matches the label', async () => {
    const result = await run(new TaskLinkFilter('blocks').setDatabase(db));
    expect(result.map((r) => r.id)).toEqual([1]);
  });
  it('matches the opposite label', async () => {
    const result = await run(new TaskLinkFilter('is blocked by').setDatabase(db));
    expect(result.map((r) => r.id)).toEqual([2]);
  });
});

describe('TaskMovedDateFilter', () => {
  it('filters by moved date', async () => {
    await addTask(db, { title: 'Test1', project_id: 1, date_moved: now() });
    await addTask(db, { title: 'Test2', project_id: 1, date_moved: now() - 86400 });
    await addTask(db, { title: 'Test3', project_id: 1, date_moved: now() - 3 * 86400 });

    const from = ymd(new Date(Date.now() - 86400 * 1000));
    expect(await run(new TaskMovedDateFilter(`>=${from}`).setDateParser(dateParser))).toHaveLength(2);
    expect(await run(new TaskMovedDateFilter('<yesterday').setDateParser(dateParser))).toHaveLength(1);
  });
});

describe('TaskPriorityFilter', () => {
  it('matches a defined priority', async () => {
    await addTask(db, { title: 'Test', project_id: 1, priority: 2 });
    expect(await run(new TaskPriorityFilter(2))).toHaveLength(1);
  });
  it('does not match without priority', async () => {
    await addTask(db, { title: 'Test', project_id: 1 });
    expect(await run(new TaskPriorityFilter(2))).toHaveLength(0);
  });
  it('supports comparison operators', async () => {
    await addTask(db, { title: 'Test', project_id: 1, priority: 2 });
    expect(await run(new TaskPriorityFilter('>=2'))).toHaveLength(1);
    expect(await run(new TaskPriorityFilter('>2'))).toHaveLength(0);
    expect(await run(new TaskPriorityFilter('<=2'))).toHaveLength(1);
    expect(await run(new TaskPriorityFilter('<2'))).toHaveLength(0);
  });
});

describe('TaskReferenceFilter', () => {
  it('does not match without reference', async () => {
    await addTask(db, { title: 'Test', project_id: 1 });
    expect(await run(new TaskReferenceFilter('aaa-bbb'))).toHaveLength(0);
  });
  it('matches exactly', async () => {
    await addTask(db, { title: 'Test', project_id: 1, reference: 'aaa-bbb' });
    expect(await run(new TaskReferenceFilter('aaa-bbb'))).toHaveLength(1);
  });
  it('matches with a wildcard', async () => {
    await addTask(db, { title: 'Test', project_id: 1, reference: 'aaa-bbb' });
    expect(await run(new TaskReferenceFilter('aaa-*'))).toHaveLength(1);
  });
  it('matches none', async () => {
    await addTask(db, { title: 'A', project_id: 1, reference: 'aaa-bbb' });
    await addTask(db, { title: 'B', project_id: 1 });
    expect(titles(await run(new TaskReferenceFilter('none')))).toEqual(['B']);
  });
});

describe('TaskSearchFilter', () => {
  it('matches title, description and comment', async () => {
    await addTask(db, { title: 'needle title', project_id: 1 });
    await addTask(db, { title: 'Description task', description: 'needle description', project_id: 1 });
    await addTask(db, { title: 'Comment task', project_id: 1 });
    await addComment(db, 3, 1, 'needle comment');

    const ids = (await run(new TaskSearchFilter('needle').setDatabase(db))).map((r) => r.id);
    expect(ids.sort()).toEqual([1, 2, 3]);
  });

  it('matches a task id', async () => {
    await addTask(db, { title: 'Task 1', project_id: 1 });
    await addTask(db, { title: 'Task 2', project_id: 1 });
    const tasks = await run(new TaskSearchFilter('#2').setDatabase(db));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe(2);
  });
});

describe('TaskStartsWithIdFilter', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 20; i++) await addTask(db, { project_id: 1, title: `Task #${i}` });
  });

  it('returns many results', async () => {
    const tasks = await run(new TaskStartsWithIdFilter(1));
    expect(tasks).toHaveLength(11);
    expect(tasks[0]?.title).toBe('Task #1');
    expect(tasks[10]?.title).toBe('Task #19');
  });
  it('returns one result', async () => {
    expect(titles(await run(new TaskStartsWithIdFilter(3)))).toEqual(['Task #3']);
  });
  it('returns an empty result', async () => {
    expect(await run(new TaskStartsWithIdFilter(30))).toHaveLength(0);
  });
  it('works with two digits', async () => {
    expect(titles(await run(new TaskStartsWithIdFilter(11)))).toEqual(['Task #11']);
  });
});

describe('TaskStatusFilter', () => {
  beforeEach(async () => {
    await addTask(db, { project_id: 1, title: 'test1' });
    await addTask(db, { project_id: 1, title: 'test2', is_active: 0 });
  });

  it.each([
    ['open', ['test1']],
    [1, ['test1']],
    ['closed', ['test2']],
    [0, ['test2']],
    ['all', ['test1', 'test2']],
  ])('value %s', async (value, expected) => {
    expect(titles(await run(new TaskStatusFilter(value), 'tasks.title'))).toEqual(expected);
  });
});

describe('TaskTagFilter', () => {
  async function seed(): Promise<void> {
    await addTask(db, { project_id: 1, title: 'test1' });
    await addTask(db, { project_id: 1, title: 'test2' });
    await addTask(db, { project_id: 1, title: 'test3' });
    for (const name of ['My tag 1', 'My tag 2', 'My tag 3']) await db.table('tags').insert({ name, project_id: 1 });
    for (const [task, tag] of [[1, 1], [1, 2], [1, 3], [2, 3]]) await db.table('task_has_tags').insert({ task_id: task, tag_id: tag });
  }

  it('matches multiple tasks', async () => {
    await seed();
    expect(titles(await run(new TaskTagFilter('my tag 3').setDatabase(db), 'tasks.title'))).toEqual(['test1', 'test2']);
  });
  it('matches a single task', async () => {
    await seed();
    expect(titles(await run(new TaskTagFilter('my tag 2').setDatabase(db)))).toEqual(['test1']);
  });
  it('does not match', async () => {
    await seed();
    expect(await run(new TaskTagFilter('my tag 42').setDatabase(db))).toHaveLength(0);
  });
  it('matches the same tag in multiple projects', async () => {
    expect(await addProject(db, 'Test 2')).toBe(2);
    await addTask(db, { project_id: 1, title: 'test1' });
    await addTask(db, { project_id: 2, title: 'test2' });
    await db.table('tags').insert({ name: 'My tag', project_id: 1 });
    await db.table('tags').insert({ name: 'My tag', project_id: 2 });
    await db.table('task_has_tags').insert({ task_id: 1, tag_id: 1 });
    await db.table('task_has_tags').insert({ task_id: 2, tag_id: 2 });
    expect(titles(await run(new TaskTagFilter('my tag').setDatabase(db), 'tasks.title'))).toEqual(['test1', 'test2']);
  });
  it('matches tasks without tags', async () => {
    await seed();
    expect(titles(await run(new TaskTagFilter('none').setDatabase(db)))).toEqual(['test3']);
  });
});
