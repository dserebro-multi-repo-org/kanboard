import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import {
  AverageLeadCycleTimeAnalytic,
  AverageTimeSpentColumnAnalytic,
  EstimatedActualColumnAnalytic,
  EstimatedTimeComparisonAnalytic,
  TaskDistributionAnalytic,
  UserDistributionAnalytic,
  round,
} from '../../../src/analytic/index.js';
import { createTestContainer, migratedDb, seedProject, seedTask, type LooseContainer } from '../support/m6-container.js';
import { installModels } from '../support/m6-models.js';

let db: Database;
let container: LooseContainer;
let projectId: number;

beforeEach(async () => {
  db = await migratedDb();
  container = createTestContainer(db);
  installModels(container, db);
  projectId = await seedProject(db, 'test1');
  await seedProject(db, 'test2');
});
afterEach(async () => {
  await db.close();
});

const now = () => Math.floor(Date.now() / 1000);

describe('AverageLeadCycleTimeAnalytic', () => {
  it('builds the lead and cycle time statistics', async () => {
    const t = now();
    // LT=3600 CT=1800
    await seedTask(db, { project_id: projectId, title: 'test', date_completed: t + 3600, date_started: t + 1800 });
    // LT=1800 CT=900
    await seedTask(db, { project_id: projectId, title: 'test', date_completed: t + 1800, date_started: t + 900 });
    // LT=3600 CT=0
    await seedTask(db, { project_id: projectId, title: 'test', date_completed: t + 3600 });
    // LT=2*3600 CT=0
    await seedTask(db, { project_id: projectId, title: 'test', date_completed: t + 2 * 3600 });
    // CT=0
    await seedTask(db, { project_id: projectId, title: 'test', date_started: t + 900 });

    const stats = await new AverageLeadCycleTimeAnalytic(container).build(projectId);

    expect(stats.count).toBe(5);
    expect(Math.abs(stats.total_lead_time - (3600 + 1800 + 3600 + 2 * 3600))).toBeLessThanOrEqual(10);
    expect(Math.abs(stats.total_cycle_time - (1800 + 900))).toBeLessThanOrEqual(5);
    expect(Math.abs(stats.avg_lead_time - (3600 + 1800 + 3600 + 2 * 3600) / 5)).toBeLessThanOrEqual(5);
    expect(Math.abs(stats.avg_cycle_time - (1800 + 900) / 5)).toBeLessThanOrEqual(5);
  });

  it('builds the statistics without task', async () => {
    expect(await new AverageLeadCycleTimeAnalytic(container).build(projectId)).toEqual({
      count: 0,
      total_lead_time: 0,
      total_cycle_time: 0,
      avg_lead_time: 0,
      avg_cycle_time: 0,
    });
  });
});

describe('AverageTimeSpentColumnAnalytic', () => {
  it('computes the average without transitions', async () => {
    const t = now();
    await seedTask(db, { project_id: projectId, title: 'test', column_id: 1, date_completed: t + 3600, date_moved: t });
    await seedTask(db, { project_id: projectId, title: 'test', column_id: 1, date_completed: t + 1800, date_moved: t });

    const stats = await new AverageTimeSpentColumnAnalytic(container).build(projectId);

    expect(stats[1]!.count).toBe(2);
    expect(Math.abs(stats[1]!.time_spent - (3600 + 1800))).toBeLessThanOrEqual(3);
    expect(Math.abs(stats[1]!.average - Math.trunc((3600 + 1800) / 2))).toBeLessThanOrEqual(3);
    expect(stats[1]!.title).toBe('Backlog');
    expect([stats[2]!.count, stats[2]!.time_spent, stats[2]!.average, stats[2]!.title]).toEqual([0, 0, 0, 'Ready']);
    expect([stats[3]!.count, stats[3]!.title]).toEqual([0, 'Work in progress']);
    expect([stats[4]!.count, stats[4]!.title]).toEqual([0, 'Done']);
  });

  it('adds the time spent in previous columns from the transitions', async () => {
    const t = now();
    for (const completed of [3600, 1800]) {
      const id = await seedTask(db, { project_id: projectId, title: 'test', column_id: 1, date_completed: t + completed, date_moved: t - 900 });
      await db.table('transitions').insert({
        user_id: 1,
        project_id: projectId,
        task_id: id,
        src_column_id: 3,
        dst_column_id: 1,
        date: t,
        time_spent: 900,
      });
    }

    const stats = await new AverageTimeSpentColumnAnalytic(container).build(projectId);

    expect(stats[1]!.count).toBe(2);
    expect(Math.abs(stats[1]!.time_spent - (3600 + 1800 + 2 * 900))).toBeLessThanOrEqual(3);
    expect(stats[3]).toMatchObject({ count: 2, time_spent: 1800, average: 900, title: 'Work in progress' });
    expect(stats[2]!.count).toBe(0);
    expect(stats[4]!.count).toBe(0);
  });
});

describe('EstimatedTimeComparisonAnalytic', () => {
  async function create(values: Record<string, unknown>): Promise<void> {
    await seedTask(db, { project_id: projectId, title: 'test', ...values });
  }

  it('compares open and closed tasks', async () => {
    await create({ time_estimated: 5.5 });
    await create({ time_estimated: 1.75 });
    await create({ time_estimated: 1.25, is_active: 0 });
    await create({ time_spent: 8.25 });
    await create({ time_spent: 0.25 });
    await create({ time_spent: 0.5, is_active: 0 });

    expect(await new EstimatedTimeComparisonAnalytic(container).build(projectId)).toEqual({
      open: { time_spent: 8.5, time_estimated: 7.25 },
      closed: { time_spent: 0.5, time_estimated: 1.25 },
    });
  });

  it('handles projects without closed task', async () => {
    await create({ time_estimated: 5.5 });
    await create({ time_estimated: 1.75 });
    await create({ time_spent: 8.25 });
    await create({ time_spent: 0.25 });

    expect(await new EstimatedTimeComparisonAnalytic(container).build(projectId)).toEqual({
      open: { time_spent: 8.5, time_estimated: 7.25 },
      closed: { time_spent: 0, time_estimated: 0 },
    });
  });

  it('handles projects with only closed tasks', async () => {
    await create({ time_estimated: 5.5, is_active: 0 });
    await create({ time_estimated: 1.75, is_active: 0 });
    await create({ time_spent: 8.25, is_active: 0 });
    await create({ time_spent: 0.25, is_active: 0 });

    expect(await new EstimatedTimeComparisonAnalytic(container).build(projectId)).toEqual({
      closed: { time_spent: 8.5, time_estimated: 7.25 },
      open: { time_spent: 0, time_estimated: 0 },
    });
  });
});

describe('EstimatedActualColumnAnalytic', () => {
  it('sums the estimated and spent hours per column', async () => {
    await seedTask(db, { project_id: projectId, title: 'a', column_id: 1, time_estimated: 2, time_spent: 1 });
    await seedTask(db, { project_id: projectId, title: 'b', column_id: 1, time_estimated: 1.5, time_spent: 0.5 });
    await seedTask(db, { project_id: projectId, title: 'c', column_id: 3, time_estimated: 4, time_spent: 6 });

    expect(await new EstimatedActualColumnAnalytic(container).build(projectId)).toEqual({
      1: { hours_spent: 1.5, hours_estimated: 3.5, title: 'Backlog' },
      2: { hours_spent: 0, hours_estimated: 0, title: 'Ready' },
      3: { hours_spent: 6, hours_estimated: 4, title: 'Work in progress' },
      4: { hours_spent: 0, hours_estimated: 0, title: 'Done' },
    });
  });
});

describe('TaskDistributionAnalytic', () => {
  it('builds the distribution by column and ignores closed tasks', async () => {
    const create = async (column: number, active: number, inactive: number) => {
      for (let i = 0; i < active; i++) await seedTask(db, { project_id: projectId, title: 'test', column_id: column, is_active: 1 });
      for (let i = 0; i < inactive; i++) await seedTask(db, { project_id: projectId, title: 'test', column_id: column, is_active: 0 });
    };
    await create(1, 20, 1);
    await create(2, 30, 1);
    await create(3, 40, 1);
    await create(4, 10, 1);

    expect(await new TaskDistributionAnalytic(container).build(projectId)).toEqual([
      { column_title: 'Backlog', nb_tasks: 20, percentage: 20.0 },
      { column_title: 'Ready', nb_tasks: 30, percentage: 30.0 },
      { column_title: 'Work in progress', nb_tasks: 40, percentage: 40.0 },
      { column_title: 'Done', nb_tasks: 10, percentage: 10.0 },
    ]);
  });

  it('returns an empty report without task', async () => {
    expect(await new TaskDistributionAnalytic(container).build(projectId)).toEqual([]);
  });

  it('rounds the percentage with 2 decimals', async () => {
    for (const column of [1, 2, 3]) await seedTask(db, { project_id: projectId, title: 't', column_id: column });
    const metrics = await new TaskDistributionAnalytic(container).build(projectId);
    expect(metrics.map((m) => m.percentage)).toEqual([33.33, 33.33, 33.33, 0]);
  });

  it('round() rounds half away from zero', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(-2.5, 0)).toBe(-3);
    expect(round(33.3333, 2)).toBe(33.33);
  });
});

describe('UserDistributionAnalytic', () => {
  it('builds the distribution by assignee sorted by user name', async () => {
    for (const username of ['user1', 'user2', 'user3', 'user4']) {
      const userId = (await db.table('users').insertAndGetId({ username, password: 'x' })) as number;
      await db.table('project_has_users').insert({ project_id: projectId, user_id: userId, role: 'project-member' });
    }
    const create = async (owner: number, active: number, inactive: number) => {
      for (let i = 0; i < active; i++) await seedTask(db, { project_id: projectId, title: 'test', owner_id: owner, is_active: 1 });
      for (let i = 0; i < inactive; i++) await seedTask(db, { project_id: projectId, title: 'test', owner_id: owner, is_active: 0 });
    };
    // user ids start at 2 (the default admin has id 1)
    await create(0, 10, 1);
    await create(2, 30, 1);
    await create(3, 40, 1);
    await create(4, 10, 1);
    await create(5, 10, 1);

    expect(await new UserDistributionAnalytic(container).build(projectId)).toEqual([
      { user: 'Unassigned', nb_tasks: 10, percentage: 10.0 },
      { user: 'user1', nb_tasks: 30, percentage: 30.0 },
      { user: 'user2', nb_tasks: 40, percentage: 40.0 },
      { user: 'user3', nb_tasks: 10, percentage: 10.0 },
      { user: 'user4', nb_tasks: 10, percentage: 10.0 },
    ]);
  });

  it('returns an empty report without task', async () => {
    expect(await new UserDistributionAnalytic(container).build(projectId)).toEqual([]);
  });

  it('counts tasks of users that are not assignable as unassigned', async () => {
    await seedTask(db, { project_id: projectId, title: 'x', owner_id: 99 });
    expect(await new UserDistributionAnalytic(container).build(projectId)).toEqual([{ user: 'Unassigned', nb_tasks: 1, percentage: 100 }]);
  });
});
