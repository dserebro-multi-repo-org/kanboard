import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import { BaseFilter } from '../../../src/filter/base-filter.js';
import { ProjectGroupRoleProjectFilter } from '../../../src/filter/project-group-role-project-filter.js';
import { ProjectGroupRoleUsernameFilter } from '../../../src/filter/project-group-role-username-filter.js';
import { ProjectIdsFilter } from '../../../src/filter/project-ids-filter.js';
import { ProjectStatusFilter } from '../../../src/filter/project-status-filter.js';
import { ProjectTypeFilter } from '../../../src/filter/project-type-filter.js';
import { ProjectUserRoleProjectFilter } from '../../../src/filter/project-user-role-project-filter.js';
import { ProjectUserRoleUsernameFilter } from '../../../src/filter/project-user-role-username-filter.js';
import { TaskColorFilter } from '../../../src/filter/task-color-filter.js';
import { TaskColumnFilter } from '../../../src/filter/task-column-filter.js';
import { TaskCompletionDateFilter } from '../../../src/filter/task-completion-date-filter.js';
import { TaskCompletionDateRangeFilter } from '../../../src/filter/task-completion-date-range-filter.js';
import { TaskCreationDateFilter } from '../../../src/filter/task-creation-date-filter.js';
import { TaskCreationDateRangeFilter } from '../../../src/filter/task-creation-date-range-filter.js';
import { TaskDescriptionFilter } from '../../../src/filter/task-description-filter.js';
import { TaskDueDateFilter } from '../../../src/filter/task-due-date-filter.js';
import { TaskDueDateRangeFilter } from '../../../src/filter/task-due-date-range-filter.js';
import { TaskIdExclusionFilter } from '../../../src/filter/task-id-exclusion-filter.js';
import { TaskIdFilter } from '../../../src/filter/task-id-filter.js';
import { TaskModificationDateFilter } from '../../../src/filter/task-modification-date-filter.js';
import { TaskModificationDateRangeFilter } from '../../../src/filter/task-modification-date-range-filter.js';
import { TaskMovedDateRangeFilter } from '../../../src/filter/task-moved-date-range-filter.js';
import { TaskProjectFilter } from '../../../src/filter/task-project-filter.js';
import { TaskProjectsFilter } from '../../../src/filter/task-projects-filter.js';
import { TaskReferenceFilter } from '../../../src/filter/task-reference-filter.js';
import { TaskScoreFilter } from '../../../src/filter/task-score-filter.js';
import { TaskStartDateFilter } from '../../../src/filter/task-start-date-filter.js';
import { TaskSubtaskAssigneeFilter } from '../../../src/filter/task-subtask-assignee-filter.js';
import { TaskSwimlaneFilter } from '../../../src/filter/task-swimlane-filter.js';
import { TaskTitleFilter } from '../../../src/filter/task-title-filter.js';
import { UserNameFilter } from '../../../src/filter/user-name-filter.js';
import { addProject, addTask, addUser, colorModel, createDb, dateParser, extendedQuery, now, ymd } from './fixtures.js';

let db: Database;
beforeEach(async () => {
  db = await createDb();
});
afterEach(async () => {
  await db.close();
});

type Applicable = { withQuery(q: FilterQuery): { apply(): unknown } };

async function run(filter: Applicable, query: FilterQuery = extendedQuery(db)): Promise<Record<string, unknown>[]> {
  filter.withQuery(query).apply();
  return query.findAll();
}
const titles = (rows: Record<string, unknown>[]): unknown[] => rows.map((r) => r.title);
const day = 86400;
const date = (offsetDays: number): string => ymd(new Date(Date.now() + offsetDays * day * 1000));

describe('BaseFilter', () => {
  it('creates instances with a value, clones and exposes the value setter', () => {
    const filter = TaskIdFilter.getInstance(3);
    expect(filter).toBeInstanceOf(TaskIdFilter);
    expect(filter).toBeInstanceOf(BaseFilter);
    const copy = filter.clone().withValue(4);
    expect(copy).not.toBe(filter);
    expect((filter as unknown as { value: unknown }).value).toBe(3);
    expect((copy as unknown as { value: unknown }).value).toBe(4);
    expect(new TaskIdFilter().getAttributes()).toEqual(['id']);
  });
});

describe('attributes', () => {
  it.each([
    [new TaskColorFilter(), ['color', 'colour']],
    [new TaskDescriptionFilter(), ['description', 'desc']],
    [new TaskModificationDateFilter(), ['updated', 'modified']],
    [new TaskModificationDateRangeFilter(), ['updatedRange', 'modifiedRange']],
    [new TaskCompletionDateRangeFilter(), ['completedRange']],
    [new TaskScoreFilter(), ['score', 'complexity']],
    [new TaskReferenceFilter(), ['reference', 'ref']],
    [new TaskSubtaskAssigneeFilter(), ['subtask:assignee']],
    [new TaskDueDateRangeFilter(), []],
    [new ProjectGroupRoleProjectFilter(), []],
    [new ProjectUserRoleUsernameFilter(), []],
    [new ProjectIdsFilter(), ['project_ids']],
    [new UserNameFilter(), ['name']],
  ])('%#', (filter, attributes) => {
    expect(filter.getAttributes()).toEqual(attributes);
  });
});

describe('task filters', () => {
  beforeEach(async () => {
    expect(await addProject(db, 'Test')).toBe(1);
  });

  it('TaskColorFilter resolves the color through the color model', async () => {
    await addTask(db, { title: 'yellow', project_id: 1 });
    await addTask(db, { title: 'red', project_id: 1, color_id: 'red' });
    expect(titles(await run(new TaskColorFilter('Red').setColorModel(colorModel)))).toEqual(['red']);
  });

  it('TaskColumnFilter filters by id or title', async () => {
    await addTask(db, { title: 'a', project_id: 1 });
    expect(await run(new TaskColumnFilter(1))).toHaveLength(1);
    expect(await run(new TaskColumnFilter('Backlog'))).toHaveLength(1);
    expect(await run(new TaskColumnFilter('Done'))).toHaveLength(0);
  });

  it('TaskDescriptionFilter, TaskTitleFilter, TaskSwimlaneFilter', async () => {
    await addTask(db, { title: 'Hello world', description: 'Some Text', project_id: 1 });
    await addTask(db, { title: '2 things', project_id: 1 });
    expect(await run(new TaskDescriptionFilter('text'))).toHaveLength(1);
    expect(await run(new TaskTitleFilter('WORLD'))).toHaveLength(1);
    expect(titles(await run(new TaskTitleFilter('#2')))).toEqual(['2 things']);
    expect(await run(new TaskTitleFilter('2'))).toHaveLength(1);
    expect(await run(new TaskSwimlaneFilter('default swimlane'))).toHaveLength(2);
    expect(await run(new TaskSwimlaneFilter('other'))).toHaveLength(0);
  });

  it('TaskIdFilter and TaskIdExclusionFilter', async () => {
    await addTask(db, { title: 'a', project_id: 1 });
    await addTask(db, { title: 'b', project_id: 1 });
    await addTask(db, { title: 'c', project_id: 1 });
    expect(titles(await run(new TaskIdFilter(2)))).toEqual(['b']);
    expect(titles(await run(new TaskIdExclusionFilter([1, 3])))).toEqual(['b']);
  });

  it('TaskProjectFilter and TaskProjectsFilter', async () => {
    await addProject(db, 'Other');
    await addTask(db, { title: 'a', project_id: 1 });
    await addTask(db, { title: 'b', project_id: 2 });
    expect(titles(await run(new TaskProjectFilter(2)))).toEqual(['b']);
    expect(titles(await run(new TaskProjectFilter('1')))).toEqual(['a']);
    expect(titles(await run(new TaskProjectFilter('other')))).toEqual(['b']);
    expect(await run(new TaskProjectFilter('99999999999'))).toHaveLength(0);
    expect(await run(new TaskProjectsFilter([1, 2]))).toHaveLength(2);
    expect(await run(new TaskProjectsFilter([]))).toHaveLength(0);
  });

  it('TaskScoreFilter supports operators', async () => {
    await addTask(db, { title: 'a', project_id: 1, score: 5 });
    expect(await run(new TaskScoreFilter(5))).toHaveLength(1);
    expect(await run(new TaskScoreFilter('>=6'))).toHaveLength(0);
    expect(await run(new TaskScoreFilter('<=5'))).toHaveLength(1);
  });

  it('TaskReferenceFilter treats the value as a wildcard pattern', async () => {
    await addTask(db, { title: 'a', project_id: 1, reference: 'ABC-1' });
    expect(await run(new TaskReferenceFilter('abc-*'))).toHaveLength(1);
    expect(await run(new TaskReferenceFilter('none'))).toHaveLength(0);
  });

  it('date filters use the date parser and operators', async () => {
    await addTask(db, { title: 'old', project_id: 1, date_creation: now() - 5 * day, date_modification: now() - 5 * day, date_completed: now() - 5 * day, date_started: now() - 5 * day });
    await addTask(db, { title: 'new', project_id: 1 });
    expect(titles(await run(new TaskCreationDateFilter(date(0)).setDateParser(dateParser)))).toEqual(['new']);
    expect(titles(await run(new TaskCreationDateFilter(`<${date(-1)}`).setDateParser(dateParser)))).toEqual(['old']);
    expect(titles(await run(new TaskCreationDateFilter(`>${date(-1)}`).setDateParser(dateParser)))).toEqual(['new']);
    expect(titles(await run(new TaskCreationDateFilter(`<=${date(-5)}`).setDateParser(dateParser)))).toEqual(['old']);
    expect(titles(await run(new TaskModificationDateFilter(`>=${date(-1)}`).setDateParser(dateParser)))).toEqual(['new']);
    expect(titles(await run(new TaskCompletionDateFilter(date(-5)).setDateParser(dateParser)))).toEqual(['old']);
    expect(titles(await run(new TaskStartDateFilter(date(-5)).setDateParser(dateParser)))).toEqual(['old']);
  });

  it('date range filters filter between two dates', async () => {
    await addTask(db, { title: 'old', project_id: 1, date_creation: now() - 5 * day, date_modification: now() - 5 * day, date_completed: now() - 5 * day, date_moved: now() - 5 * day });
    await addTask(db, { title: 'new', project_id: 1 });
    const range = `${date(-6)}..${date(-4)}`;
    expect(titles(await run(new TaskCreationDateRangeFilter(range).setDateParser(dateParser)))).toEqual(['old']);
    expect(titles(await run(new TaskModificationDateRangeFilter(range).setDateParser(dateParser)))).toEqual(['old']);
    expect(titles(await run(new TaskCompletionDateRangeFilter(range).setDateParser(dateParser)))).toEqual(['old']);
    expect(titles(await run(new TaskMovedDateRangeFilter(range).setDateParser(dateParser)))).toEqual(['old']);
    // Not a range: no condition is added.
    expect(await run(new TaskCreationDateRangeFilter('2020-01-01').setDateParser(dateParser))).toHaveLength(2);
  });

  it('TaskDueDateFilter handles none and dates', async () => {
    await addTask(db, { title: 'nodue', project_id: 1, date_due: 0 });
    await addTask(db, { title: 'due', project_id: 1, date_due: now() + 2 * day });
    expect(titles(await run(new TaskDueDateFilter('none').setDateParser(dateParser)))).toEqual(['nodue']);
    expect(titles(await run(new TaskDueDateFilter(`>${date(0)}`).setDateParser(dateParser)))).toEqual(['due']);
    expect(titles(await run(new TaskDueDateFilter(date(2)).setDateParser(dateParser)))).toEqual(['due']);
  });

  it('TaskDueDateRangeFilter takes timestamps or date strings', async () => {
    await addTask(db, { title: 'a', project_id: 1, date_due: 1000, date_started: 0 });
    await addTask(db, { title: 'b', project_id: 1, date_due: 1000, date_started: 5 });
    expect(titles(await run(new TaskDueDateRangeFilter([500, '2000'])))).toEqual(['a']);
    expect(await run(new TaskDueDateRangeFilter(['1970-01-01', '2100-01-01']))).toHaveLength(1);
    expect(await run(new TaskDueDateRangeFilter(['2100-01-01', '2100-01-02']))).toHaveLength(0);
  });
});

describe('user and project filters', () => {
  it('UserNameFilter matches username or name', async () => {
    await addUser(db, 'foobar', 'Foo Bar');
    const query = db.table('users');
    expect(await run(new UserNameFilter('o ba'), query)).toHaveLength(1);
    expect(await run(new UserNameFilter('ADMIN'), db.table('users'))).toHaveLength(1);
    expect(await run(new UserNameFilter('zzz'), db.table('users'))).toHaveLength(0);
  });

  it('ProjectIdsFilter, ProjectStatusFilter and ProjectTypeFilter', async () => {
    await addProject(db, 'Open');
    await addProject(db, 'Closed');
    await addProject(db, 'Private');
    await db.table('projects').eq('id', 2).update({ is_active: 0 });
    await db.table('projects').eq('id', 3).update({ is_private: 1 });

    expect(await run(new ProjectIdsFilter([1, 3]), db.table('projects'))).toHaveLength(2);
    expect(await run(new ProjectIdsFilter([]), db.table('projects'))).toHaveLength(0);
    for (const [value, count] of [['closed', 1], ['inactive', 1], ['disabled', 1], [0, 1], ['1', 2], ['open', 2], ['anything', 2]] as const) {
      expect(await run(new ProjectStatusFilter(value), db.table('projects'))).toHaveLength(count);
    }
    expect(await run(new ProjectTypeFilter('private'), db.table('projects'))).toHaveLength(1);
    expect(await run(new ProjectTypeFilter('team'), db.table('projects'))).toHaveLength(2);
    expect(await run(new ProjectTypeFilter(1), db.table('projects'))).toHaveLength(1);
  });

  it('ProjectUserRole filters', async () => {
    await addProject(db, 'P1');
    await addUser(db, 'john', 'John');
    await db.table('project_has_users').insert({ project_id: 1, user_id: 1, role: 'project-manager' });
    await db.table('project_has_users').insert({ project_id: 1, user_id: 2, role: 'project-member' });

    const query = () => db.table('project_has_users');
    expect(await run(new ProjectUserRoleProjectFilter(1), query())).toHaveLength(2);
    expect(await run(new ProjectUserRoleProjectFilter(2), query())).toHaveLength(0);
    expect(await run(new ProjectUserRoleUsernameFilter('jo'), query())).toHaveLength(1);
    expect(await run(new ProjectUserRoleUsernameFilter('x'), query())).toHaveLength(0);
  });

  it('ProjectGroupRole filters', async () => {
    await addProject(db, 'P1');
    await db.table('groups').insert({ name: 'Group', external_id: '' });
    await db.table('group_has_users').insert({ group_id: 1, user_id: 1 });
    await db.table('project_has_groups').insert({ group_id: 1, project_id: 1, role: 'project-member' });

    const query = () => db.table('project_has_groups');
    expect(await run(new ProjectGroupRoleProjectFilter(1), query())).toHaveLength(1);
    expect(await run(new ProjectGroupRoleProjectFilter(2), query())).toHaveLength(0);
    expect(await run(new ProjectGroupRoleUsernameFilter('adm'), query())).toHaveLength(1);
    expect(await run(new ProjectGroupRoleUsernameFilter('zzz'), query())).toHaveLength(0);
  });
});
