import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrCriteria } from '../../../../src/core/filter/or-criteria.js';
import type { Database } from '../../../../src/db/database.js';
import { TaskAssigneeFilter } from '../../../../src/filter/task-assignee-filter.js';
import { TaskTitleFilter } from '../../../../src/filter/task-title-filter.js';
import { addProject, addTask, addUser, createDb, extendedQuery } from '../../filter/fixtures.js';

let db: Database;
beforeEach(async () => {
  db = await createDb();
  expect(await addUser(db, 'foobar', 'Foo Bar')).toBe(2);
  expect(await addProject(db, 'Test')).toBe(1);
});
afterEach(async () => {
  await db.close();
});

describe('OrCriteria', () => {
  it('works with the same filter', async () => {
    await addTask(db, { title: 'Test 1', project_id: 1, owner_id: 2 });
    await addTask(db, { title: 'Test 2', project_id: 1, owner_id: 1 });
    await addTask(db, { title: 'Test 3', project_id: 1, owner_id: 0 });

    const query = extendedQuery(db);
    new OrCriteria().withQuery(query).withFilter(TaskAssigneeFilter.getInstance(1)).withFilter(TaskAssigneeFilter.getInstance(2)).apply();

    expect(await query.findAll()).toHaveLength(2);
  });

  it('works with different filters', async () => {
    await addTask(db, { title: 'ABC', project_id: 1, owner_id: 2 });
    await addTask(db, { title: 'DEF', project_id: 1, owner_id: 1 });

    const query = extendedQuery(db);
    new OrCriteria().withQuery(query).withFilter(TaskAssigneeFilter.getInstance(1)).withFilter(TaskTitleFilter.getInstance('ABC')).apply();

    expect(await query.findAll()).toHaveLength(2);
  });

  it('requires a query', () => {
    expect(() => new OrCriteria().apply()).toThrow('no query');
  });
});
