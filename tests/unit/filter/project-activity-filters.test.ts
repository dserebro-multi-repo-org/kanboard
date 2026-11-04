import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import { ProjectActivityCreationDateFilter } from '../../../src/filter/project-activity-creation-date-filter.js';
import { ProjectActivityCreatorFilter } from '../../../src/filter/project-activity-creator-filter.js';
import { ProjectActivityProjectIdFilter } from '../../../src/filter/project-activity-project-id-filter.js';
import { ProjectActivityProjectIdsFilter } from '../../../src/filter/project-activity-project-ids-filter.js';
import { ProjectActivityProjectNameFilter } from '../../../src/filter/project-activity-project-name-filter.js';
import { ProjectActivityTaskIdFilter } from '../../../src/filter/project-activity-task-id-filter.js';
import { ProjectActivityTaskStatusFilter } from '../../../src/filter/project-activity-task-status-filter.js';
import { ProjectActivityTaskTitleFilter } from '../../../src/filter/project-activity-task-title-filter.js';
import { activityQuery, addEvent, addProject, addTask, createDb, dateParser, ymd } from './fixtures.js';

let db: Database;
beforeEach(async () => {
  db = await createDb();
});
afterEach(async () => {
  await db.close();
});

async function countWith(filter: { withQuery(q: ReturnType<typeof activityQuery>): { apply(): unknown } }): Promise<Record<string, unknown>[]> {
  const query = activityQuery(db);
  filter.withQuery(query).apply();
  return query.findAll();
}

async function oneEvent(): Promise<void> {
  expect(await addProject(db, 'P1')).toBe(1);
  expect(await addTask(db, { title: 'Test', project_id: 1 })).toBe(1);
  await addEvent(db, 1, 1, 1);
}

describe('ProjectActivityCreationDateFilter', () => {
  beforeEach(oneEvent);
  const today = ymd(new Date());
  const filter = (value: string) => new ProjectActivityCreationDateFilter(value).setDateParser(dateParser);

  it.each([
    ['today', 1],
    ['yesterday', 0],
    ['<=last week', 0],
    [today, 1],
    [`>=${today}`, 1],
    [`<${today}`, 0],
    [`>${today}`, 0],
  ])('value %s matches %i event(s)', async (value, count) => {
    expect(await countWith(filter(value))).toHaveLength(count);
  });

  it('exposes its attribute', () => {
    expect(filter('today').getAttributes()).toEqual(['created']);
  });
});

describe('ProjectActivityCreatorFilter', () => {
  beforeEach(oneEvent);

  it('matches by username', async () => {
    expect(await countWith(new ProjectActivityCreatorFilter('admin'))).toHaveLength(1);
  });
  it('does not match another username', async () => {
    expect(await countWith(new ProjectActivityCreatorFilter('John Doe'))).toHaveLength(0);
  });
  it('matches the current user', async () => {
    expect(await countWith(new ProjectActivityCreatorFilter('me').setCurrentUserId(1))).toHaveLength(1);
  });
  it('does not match another current user', async () => {
    expect(await countWith(new ProjectActivityCreatorFilter('me').setCurrentUserId(2))).toHaveLength(0);
  });
});

describe('ProjectActivityProjectIdFilter / ProjectIdsFilter / ProjectNameFilter / TaskIdFilter', () => {
  beforeEach(async () => {
    for (const name of ['P1', 'P2', 'P3']) await addProject(db, name);
    for (const id of [1, 2, 3]) {
      await addTask(db, { title: 'Test', project_id: id });
      await addEvent(db, id, id, 1);
    }
  });

  it('filters by project id', async () => {
    expect(await countWith(new ProjectActivityProjectIdFilter(1))).toHaveLength(1);
  });
  it('filters by project ids', async () => {
    expect(await countWith(new ProjectActivityProjectIdsFilter([1, 2]))).toHaveLength(2);
  });
  it('matches nothing with an empty list of project ids', async () => {
    expect(await countWith(new ProjectActivityProjectIdsFilter([]))).toHaveLength(0);
  });
  it('filters by project name', async () => {
    expect(await countWith(new ProjectActivityProjectNameFilter('P1'))).toHaveLength(1);
  });
  it('filters by task id', async () => {
    expect(await countWith(new ProjectActivityTaskIdFilter(1))).toHaveLength(1);
  });
});

describe('ProjectActivityTaskStatusFilter', () => {
  it('filters by task status', async () => {
    await addProject(db, 'P1');
    await addTask(db, { title: 'Test', project_id: 1 });
    await addTask(db, { title: 'Test', project_id: 1 });
    await addEvent(db, 1, 1, 1);
    await addEvent(db, 1, 2, 1);
    await db.table('tasks').eq('id', 1).update({ is_active: 0 });

    const open = await countWith(new ProjectActivityTaskStatusFilter('open'));
    expect(open).toHaveLength(1);
    expect(open[0]?.task_id).toBe(2);

    const closed = await countWith(new ProjectActivityTaskStatusFilter('closed'));
    expect(closed).toHaveLength(1);
    expect(closed[0]?.task_id).toBe(1);

    expect(await countWith(new ProjectActivityTaskStatusFilter('all'))).toHaveLength(2);
  });
});

describe('ProjectActivityTaskTitleFilter', () => {
  beforeEach(async () => {
    await addProject(db, 'P1');
    await addTask(db, { title: 'Test1', project_id: 1 });
    await addTask(db, { title: 'Test2', project_id: 1 });
    await addEvent(db, 1, 1, 1);
    await addEvent(db, 1, 2, 1);
  });

  it('matches a full title', async () => {
    expect(await countWith(new ProjectActivityTaskTitleFilter('test2'))).toHaveLength(1);
  });
  it('matches a partial title', async () => {
    expect(await countWith(new ProjectActivityTaskTitleFilter('test'))).toHaveLength(2);
  });
  it('matches an id', async () => {
    const events = await countWith(new ProjectActivityTaskTitleFilter('#2'));
    expect(events).toHaveLength(1);
    expect(events[0]?.task_id).toBe(2);
  });
});
