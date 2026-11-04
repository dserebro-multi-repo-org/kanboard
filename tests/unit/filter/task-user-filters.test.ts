import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import type { FilterValue } from '../../../src/core/filter/filter-interface.js';
import { TaskAssigneeFilter } from '../../../src/filter/task-assignee-filter.js';
import { TaskCreatorFilter } from '../../../src/filter/task-creator-filter.js';
import { TaskSubtaskAssigneeFilter } from '../../../src/filter/task-subtask-assignee-filter.js';
import { addProject, addTask, addUser, createDb, extendedQuery } from './fixtures.js';

let db: Database;
beforeEach(async () => {
  db = await createDb();
});
afterEach(async () => {
  await db.close();
});

async function count(filter: { withValue(v: FilterValue): unknown; withQuery(q: ReturnType<typeof extendedQuery>): { apply(): unknown } }, value: FilterValue): Promise<number> {
  const query = extendedQuery(db);
  filter.withValue(value);
  filter.withQuery(query).apply();
  return (await query.findAll()).length;
}

describe.each([
  ['TaskAssigneeFilter', 'owner_id', () => new TaskAssigneeFilter()],
  ['TaskCreatorFilter', 'creator_id', () => new TaskCreatorFilter()],
] as const)('%s', (_name, column, make) => {
  it('matches an integer id', async () => {
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1, [column]: 1 });
    expect(await count(make(), 1)).toBe(1);
    expect(await count(make(), 123)).toBe(0);
  });

  it('matches a string id', async () => {
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1, [column]: 1 });
    expect(await count(make(), '1')).toBe(1);
    expect(await count(make(), '123')).toBe(0);
  });

  it('matches a username', async () => {
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1, [column]: 1 });
    expect(await count(make(), 'admin')).toBe(1);
    expect(await count(make(), 'foobar')).toBe(0);
  });

  it('matches a name', async () => {
    await addUser(db, 'foobar', 'Foo Bar');
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1, [column]: 2 });
    expect(await count(make(), 'foo bar')).toBe(1);
    expect(await count(make(), 'bob')).toBe(0);
  });

  it('matches nobody and anybody', async () => {
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1 });
    expect(await count(make(), 'nobody')).toBe(1);
    expect(await count(make(), 'anybody')).toBe(0);
  });

  it('matches the current user', async () => {
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1, [column]: 1 });
    expect(await count(make().setCurrentUserId(1), 'me')).toBe(1);
    expect(await count(make().setCurrentUserId(2), 'me')).toBe(0);
    expect(await count(make(), 'anybody')).toBe(1);
  });
});

describe('TaskSubtaskAssigneeFilter', () => {
  const make = () => new TaskSubtaskAssigneeFilter().setDatabase(db);
  const addSubtask = (title: string, taskId: number, userId = 0) => db.table('subtasks').insert({ title, task_id: taskId, user_id: userId, status: 0 });

  async function seed(): Promise<void> {
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1 });
  }

  it('matches an integer id', async () => {
    await seed();
    await addSubtask('subtask', 1, 1);
    expect(await count(make(), 1)).toBe(1);
    expect(await count(make(), 123)).toBe(0);
  });

  it('matches a string id', async () => {
    await seed();
    await addSubtask('subtask', 1, 1);
    expect(await count(make(), '1')).toBe(1);
    expect(await count(make(), '123')).toBe(0);
  });

  it('matches a username', async () => {
    await seed();
    await addSubtask('subtask', 1, 1);
    expect(await count(make(), 'admin')).toBe(1);
    expect(await count(make(), 'foobar')).toBe(0);
  });

  it('matches a name', async () => {
    await addUser(db, 'foobar', 'Foo Bar');
    await seed();
    await addSubtask('subtask', 1, 2);
    expect(await count(make(), 'foo bar')).toBe(1);
    expect(await count(make(), 'bob')).toBe(0);
  });

  it('matches nobody', async () => {
    await seed();
    await addSubtask('subtask', 1);
    expect(await count(make(), 'nobody')).toBe(1);
  });

  it('matches the current user', async () => {
    await seed();
    await addSubtask('subtask', 1, 1);
    expect(await count(make().setCurrentUserId(1), 'me')).toBe(1);
    expect(await count(make().setCurrentUserId(2), 'me')).toBe(0);
  });

  it('ignores completed subtasks', async () => {
    await seed();
    await db.table('subtasks').insert({ title: 'done', task_id: 1, user_id: 1, status: 2 });
    expect(await count(make(), 'anybody')).toBe(0);
  });

  it('handles multiple subtasks', async () => {
    await addUser(db, 'foobar', 'Foo Bar');
    await addProject(db, 'Test');
    await addTask(db, { title: 'Test', project_id: 1 });
    await addSubtask('subtask #1', 1, 2);
    await addSubtask('subtask #2', 1, 1);
    await addTask(db, { title: 'Test 2', project_id: 1 });
    await addSubtask('subtask #3', 2);
    await addSubtask('subtask #4', 2, 1);
    await addTask(db, { title: 'Test 3', project_id: 1 });
    await addSubtask('subtask #5', 3);
    await addSubtask('subtask #6', 3, 2);

    expect(await count(make(), 'foo bar')).toBe(2);
    expect(await count(make(), 'nobody')).toBe(2);
    expect(await count(make(), 'admin')).toBe(2);
  });
});
