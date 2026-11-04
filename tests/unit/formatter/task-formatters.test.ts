import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import {
  TaskAutoCompleteFormatter,
  TaskListFormatter,
  TaskListSubtaskAssigneeFormatter,
  TaskListSubtaskFormatter,
  TaskSuggestMenuFormatter,
  SubtaskListFormatter,
} from '../../../src/formatter/index.js';
import { createTestContainer, migratedDb, seedProject, seedTask, type LooseContainer } from '../support/m6-container.js';
import { installModels } from '../support/m6-models.js';

let db: Database;
let container: LooseContainer;

beforeEach(async () => {
  db = await migratedDb();
  container = createTestContainer(db);
  installModels(container, db);
});
afterEach(async () => {
  await db.close();
});

const extendedQuery = (): FilterQuery => (container.get('taskFinderModel') as { getExtendedQuery(): FilterQuery }).getExtendedQuery();

describe('TaskAutoCompleteFormatter', () => {
  it('formats value and label', async () => {
    const projectId = await seedProject(db, 'My Project');
    await seedTask(db, { title: 'Task 1', project_id: projectId });
    await seedTask(db, { title: 'Task 2', project_id: projectId });

    const tasks = await TaskAutoCompleteFormatter.getInstance(container).withQuery(extendedQuery()).format();

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ id: 1, value: 'Task 1', label: 'My Project > #1 Task 1' });
    expect(tasks[1]).toMatchObject({ id: 2, value: 'Task 2', label: 'My Project > #2 Task 2' });
  });

  it('applies the limit', async () => {
    const projectId = await seedProject(db, 'My Project');
    for (const title of ['a', 'b', 'c']) await seedTask(db, { title, project_id: projectId });

    expect(await new TaskAutoCompleteFormatter(container).withQuery(extendedQuery()).withLimit(2).format()).toHaveLength(2);
  });

  it('requires a query', async () => {
    await expect(new TaskAutoCompleteFormatter(container).format()).rejects.toThrow('no query defined');
  });
});

describe('TaskSuggestMenuFormatter', () => {
  it('formats the menu entries and escapes the content', async () => {
    const projectId = await seedProject(db, 'My Project');
    await seedTask(db, { title: 'Task 1', project_id: projectId });
    await seedTask(db, { title: '<b>Task 2</b>', project_id: projectId });

    const result = await new TaskSuggestMenuFormatter(container).withQuery(extendedQuery()).format();

    expect(result).toStrictEqual([
      { value: '1', html: '#1 Task 1 <small>My Project</small>' },
      { value: '2', html: '#2 &lt;b&gt;Task 2&lt;/b&gt; <small>My Project</small>' },
    ]);
  });
});

describe('TaskListFormatter', () => {
  it('adds the tags of every task', async () => {
    const projectId = await seedProject(db, 'Test');
    const t1 = await seedTask(db, { title: 'test1', project_id: projectId });
    const t2 = await seedTask(db, { title: 'test2', project_id: projectId, column_id: 3 });
    await seedTask(db, { title: 'test3', project_id: projectId });
    const tag1 = (await db.table('tags').insertAndGetId({ name: 'My tag 1', project_id: projectId })) as number;
    const tag2 = (await db.table('tags').insertAndGetId({ name: 'My tag 2', project_id: projectId })) as number;
    const tag3 = (await db.table('tags').insertAndGetId({ name: 'My tag 3', project_id: projectId })) as number;
    await db.table('task_has_tags').insert({ task_id: t1, tag_id: tag1 });
    await db.table('task_has_tags').insert({ task_id: t1, tag_id: tag2 });
    await db.table('task_has_tags').insert({ task_id: t2, tag_id: tag3 });

    const listing = await TaskListFormatter.getInstance(container).withQuery(extendedQuery().asc('tasks.id')).format();

    expect(listing).toHaveLength(3);
    expect(listing[0]!['tags']).toEqual([
      { id: 1, name: 'My tag 1', task_id: 1, color_id: null },
      { id: 2, name: 'My tag 2', task_id: 1, color_id: null },
    ]);
    expect(listing[1]!['tags']).toEqual([{ id: 3, name: 'My tag 3', task_id: 2, color_id: null }]);
    expect(listing[2]!['tags']).toEqual([]);
  });
});

describe('TaskListSubtaskFormatter / TaskListSubtaskAssigneeFormatter', () => {
  async function seed(): Promise<void> {
    const projectId = await seedProject(db, 'Test');
    const t1 = await seedTask(db, { title: 'task 1', project_id: projectId });
    const t2 = await seedTask(db, { title: 'task 2', project_id: projectId });
    await db.table('subtasks').insert({ title: 'subtask A', task_id: t1, user_id: 1, status: 0 });
    await db.table('subtasks').insert({ title: 'subtask B', task_id: t1, user_id: 2, status: 0 });
    await db.table('subtasks').insert({ title: 'subtask C', task_id: t2, user_id: 2, status: 0 });
  }

  it('adds all the subtasks', async () => {
    await seed();
    const tasks = await new TaskListSubtaskFormatter(container).withQuery(extendedQuery().asc('tasks.id')).format();
    expect((tasks[0]!['subtasks'] as unknown[]).length).toBe(2);
    expect((tasks[1]!['subtasks'] as unknown[]).length).toBe(1);
  });

  it('adds the subtasks of the assignee and can drop the empty tasks', async () => {
    await seed();
    const all = await new TaskListSubtaskAssigneeFormatter(container).withUserId(1).withQuery(extendedQuery().asc('tasks.id')).format();
    expect(all).toHaveLength(2);
    expect((all[0]!['subtasks'] as Array<Record<string, unknown>>).map((s) => s['title'])).toEqual(['subtask A']);
    expect(all[1]!['subtasks']).toEqual([]);

    const filtered = await new TaskListSubtaskAssigneeFormatter(container)
      .withUserId(1)
      .withoutEmptyTasks()
      .withQuery(extendedQuery().asc('tasks.id'))
      .format();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!['title']).toBe('task 1');
  });
});

describe('SubtaskListFormatter', () => {
  it('adds the status name and the timer flag', async () => {
    const projectId = await seedProject(db, 'Test');
    const task = await seedTask(db, { title: 'task 1', project_id: projectId });
    await db.table('subtasks').insert({ title: 'a', task_id: task, status: 1 });
    await db.table('subtasks').insert({ title: 'b', task_id: task, status: 2 });
    await db.table('subtask_time_tracking').insert({ user_id: 1, subtask_id: 1, start: 1, end: 0 });

    const subtasks = await new SubtaskListFormatter(container).withQuery(db.table('subtasks').asc('id') as unknown as FilterQuery).format();
    expect(subtasks.map((s) => s['status_name'])).toEqual(['In progress', 'Done']);
    expect(subtasks.map((s) => s['timer_start_date'])).toEqual([0, 0]);
    expect(subtasks.map((s) => s['is_timer_started'])).toEqual([false, false]);
  });

  it('flags the started timers', async () => {
    const rows = [{ id: 1, status: 0, timer_start_date: 123 }, { id: 2, status: 1, timer_start_date: null }];
    const query = { findAll: async () => rows } as unknown as FilterQuery;
    const subtasks = await new SubtaskListFormatter(container).withQuery(query).format();
    expect(subtasks.map((s) => s['is_timer_started'])).toEqual([true, false]);
    expect(subtasks.map((s) => s['status_name'])).toEqual(['Todo', 'In progress']);
  });
});
