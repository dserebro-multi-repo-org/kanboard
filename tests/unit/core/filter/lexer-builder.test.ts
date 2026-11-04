import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LexerBuilder } from '../../../../src/core/filter/lexer-builder.js';
import type { Database } from '../../../../src/db/database.js';
import { TaskAssigneeFilter } from '../../../../src/filter/task-assignee-filter.js';
import { TaskTitleFilter } from '../../../../src/filter/task-title-filter.js';
import { addProject, addTask, addUser, createDb, extendedQuery } from '../../filter/fixtures.js';

let db: Database;
beforeEach(async () => {
  db = await createDb();
  expect(await addProject(db, 'Project')).toBe(1);
});
afterEach(async () => {
  await db.close();
});

function builder(): LexerBuilder {
  return new LexerBuilder().withFilter(new TaskAssigneeFilter()).withFilter(new TaskTitleFilter(), true).withQuery(extendedQuery(db));
}

describe('LexerBuilder', () => {
  it('returns a result', async () => {
    await addTask(db, { project_id: 1, title: 'Test' });
    const tasks = await builder().build('assignee:nobody').toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Test');
  });

  it('returns nothing', async () => {
    await addTask(db, { project_id: 1, title: 'Test' });
    expect(await builder().build('something').toArray()).toHaveLength(0);
  });

  it('works with an empty input', async () => {
    await addTask(db, { project_id: 1, title: 'Test' });
    expect(await builder().build('').toArray()).toHaveLength(1);
  });

  it('handles multiple matches', async () => {
    await addTask(db, { project_id: 1, title: 'ABC', owner_id: 1 });
    await addTask(db, { project_id: 1, title: 'DEF' });
    expect(await builder().build('assignee:nobody assignee:1').toArray()).toHaveLength(2);
  });

  it('clones with a deep copy', async () => {
    const original = builder();
    const clone = original.clone();
    expect(clone).not.toBe(original);
    expect(original.build('test').getQuery()).not.toBe(clone.build('test').getQuery());
  });

  it('matches attributes case-insensitively', async () => {
    await addTask(db, { project_id: 1, title: 'Test' });
    const tasks = await builder().build('AsSignEe:nobody').toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Test');
  });

  it('applies an OR criteria for repeated attributes', async () => {
    await addUser(db, 'foobar', 'Foo Bar');
    await addTask(db, { title: 'Test 1', project_id: 1, owner_id: 2 });
    await addTask(db, { title: 'Test 2', project_id: 1, owner_id: 1 });
    await addTask(db, { title: 'Test 3', project_id: 1, owner_id: 0 });

    const tasks = await builder().build('assignee:admin assignee:foobar').toArray();
    expect(tasks.map((t) => t.title)).toEqual(['Test 1', 'Test 2']);
  });

  it('handles multiple expressions with quotes', async () => {
    await addUser(db, 'foobar', 'Foo Bar');
    await addTask(db, { title: 'Test 1', project_id: 1, owner_id: 2 });
    await addTask(db, { title: 'Test 2', project_id: 1, owner_id: 1 });
    await addTask(db, { title: 'Test 3', project_id: 1, owner_id: 0 });

    const tasks = await builder().build('assignee:"admin" assignee:"foobar"').toArray();
    expect(tasks.map((t) => t.title)).toEqual(['Test 1', 'Test 2']);
  });

  it('fails without a query', () => {
    expect(() => new LexerBuilder().withFilter(new TaskTitleFilter(), true).build('x')).toThrow('no query');
  });
});
