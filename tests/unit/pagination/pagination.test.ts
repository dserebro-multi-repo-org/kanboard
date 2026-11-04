import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import {
  DashboardPagination,
  PaginationServiceProvider,
  ProjectPagination,
  SubtaskPagination,
  TaskPagination,
  UserPagination,
} from '../../../src/pagination/index.js';
import { createTestContainer, migratedDb, seedProject, seedTask, type LooseContainer } from '../support/m6-container.js';
import { fakeRequest, installModels } from '../support/m6-models.js';

let db: Database;
let container: LooseContainer;

beforeEach(async () => {
  db = await migratedDb();
  container = createTestContainer(db);
  installModels(container, db);
  container.set('request', fakeRequest());
});
afterEach(async () => {
  await db.close();
});

async function addUser(username: string): Promise<number> {
  return (await db.table('users').insertAndGetId({ username, password: 'x' })) as number;
}

async function addMember(projectId: number, userId: number): Promise<void> {
  await db.table('project_has_users').insert({ project_id: projectId, user_id: userId, role: 'project-member' });
}

describe('DashboardPagination', () => {
  it('lists the projects of the user with their tasks and subtasks', async () => {
    const p1 = await seedProject(db, 'Project #1');
    const p2 = await seedProject(db, 'Project #2');
    await addMember(p1, 1);
    const task1 = await seedTask(db, { title: 'Task #1', project_id: p2, column_id: 5, swimlane_id: 2, owner_id: 0 });
    const task2 = await seedTask(db, { title: 'Task #2', project_id: p1, column_id: 2, swimlane_id: 1, owner_id: 1 });
    await db.table('subtasks').insert({ task_id: task1, title: 'subtask A', user_id: 1, status: 0 });
    await db.table('subtasks').insert({ task_id: task2, title: 'subtask B', user_id: 1, status: 0 });
    await db.table('subtasks').insert({ task_id: task2, title: 'subtask C', status: 0 });

    const dashboard = await new DashboardPagination(container as never).getOverview(1);

    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]!.project_id).toBe(p1);
    expect(dashboard[0]!.project_name).toBe('Project #1');
    expect(dashboard[0]!.paginator.getTotal()).toBe(1);
    const tasks = await dashboard[0]!.paginator.getCollection();
    expect(tasks).toHaveLength(1);
    expect((tasks[0]!['subtasks'] as Array<Record<string, unknown>>).map((s) => s['title'])).toEqual(['subtask B']);
  });

  it('only shows the subtasks of the user, including tasks of other owners', async () => {
    const user2 = await addUser('user1');
    const p1 = await seedProject(db, 'Project #1');
    const p2 = await seedProject(db, 'Project #2');
    await addMember(p1, 1);
    await addMember(p1, user2);
    await addMember(p2, user2);
    const task1 = await seedTask(db, { title: 'Task #1', project_id: p2, column_id: 5, swimlane_id: 2, priority: 3 });
    const task2 = await seedTask(db, { title: 'Task #2', project_id: p1, column_id: 2, swimlane_id: 1, owner_id: user2 });
    await seedTask(db, { title: 'Task #3', project_id: p2, column_id: 5, swimlane_id: 2, owner_id: user2 });
    await db.table('subtasks').insert({ task_id: task1, title: 'subtask A', user_id: user2, status: 0 });
    await db.table('subtasks').insert({ task_id: task2, title: 'subtask B', user_id: 1, status: 0 });
    await db.table('subtasks').insert({ task_id: task2, title: 'subtask C', status: 0 });
    const pagination = new DashboardPagination(container as never);

    let dashboard = await pagination.getOverview(1);
    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]!.project_name).toBe('Project #1');
    expect(dashboard[0]!.paginator.getTotal()).toBe(1);
    let tasks = await dashboard[0]!.paginator.getCollection();
    expect(tasks).toHaveLength(1);
    expect((tasks[0]!['subtasks'] as Array<Record<string, unknown>>).map((s) => s['title'])).toEqual(['subtask B']);

    dashboard = await pagination.getOverview(user2);
    expect(dashboard.map((d) => d.project_name)).toEqual(['Project #1', 'Project #2']);
    expect(dashboard[0]!.paginator.getTotal()).toBe(1);
    tasks = await dashboard[0]!.paginator.getCollection();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!['subtasks']).toEqual([]);
    tasks = await dashboard[1]!.paginator.getCollection();
    expect(tasks).toHaveLength(2);
    expect((tasks[0]!['subtasks'] as Array<Record<string, unknown>>).map((s) => s['title'])).toEqual(['subtask A']);
  });

  it('hides the tasks of the columns hidden on the dashboard', async () => {
    const p1 = await seedProject(db, 'Project #1');
    await addMember(p1, 1);
    const task = await seedTask(db, { title: 'Task #1', project_id: p1, column_id: 1, swimlane_id: 1 });
    await db.table('subtasks').insert({ task_id: task, title: 'subtask #1', user_id: 1, status: 0 });
    const pagination = new DashboardPagination(container as never);

    expect(await pagination.getOverview(1)).toHaveLength(1);
    await db.table('columns').eq('id', 1).update({ hide_in_dashboard: 1 });
    expect(await pagination.getOverview(1)).toHaveLength(0);
  });

  it('passes the paginator through the pagination:dashboard:task:query hook', async () => {
    const p1 = await seedProject(db, 'Project #1');
    await addMember(p1, 1);
    await seedTask(db, { title: 'Task #1', project_id: p1, owner_id: 1, swimlane_id: 1, column_id: 1 });
    let calls = 0;
    (container.get('hook') as { on(h: string, l: () => void): void }).on('pagination:dashboard:task:query', () => {
      calls++;
    });
    await new DashboardPagination(container as never).getOverview(1);
    expect(calls).toBe(1);
  });

  it('uses the request to calculate the offset of the paginator of the current project', async () => {
    const p1 = await seedProject(db, 'Project #1');
    await addMember(p1, 1);
    for (let i = 0; i < 20; i++) await seedTask(db, { title: `T${i}`, project_id: p1, owner_id: 1, swimlane_id: 1, column_id: 1, priority: 0 });
    container.set('request', fakeRequest({ pagination: `tasks-${p1}`, page: 2 }));

    const [item] = await new DashboardPagination(container as never).getOverview(1);
    expect(item!.paginator.getPage()).toBe(2);
    expect(await item!.paginator.getCollection()).toHaveLength(5);
  });
});

describe('ProjectPagination', () => {
  it('lists the active projects of the user', async () => {
    const p1 = await seedProject(db, 'Project #1');
    const p2 = await seedProject(db, 'Project #2');
    await seedProject(db, 'Project #3');
    const user = await addUser('test');
    await addMember(p1, user);
    await addMember(p2, user);
    const pagination = new ProjectPagination(container as never);

    expect(await (await pagination.getDashboardPaginator(user, 'projects', 5)).getCollection()).toHaveLength(2);
    expect(await (await pagination.getDashboardPaginator(3, 'projects', 5)).getCollection()).toHaveLength(0);
    for (const order of ['projects.id', 'projects.is_private', 'projects.name']) {
      expect(await (await pagination.getDashboardPaginator(user, 'projects', 5)).setOrder(order).getCollection()).toHaveLength(2);
    }
  });
});

describe('TaskPagination', () => {
  it('lists the tasks of the user and accepts the sortable columns', async () => {
    const project = await seedProject(db, 'Project #1');
    await seedTask(db, { title: 'Task #1', project_id: project });
    await seedTask(db, { title: 'Task #2', project_id: project, column_id: 2, owner_id: 1 });
    const pagination = new TaskPagination(container as never);

    expect(await (await pagination.getDashboardPaginator(1, 'tasks', 5)).getCollection()).toHaveLength(1);
    expect(await (await pagination.getDashboardPaginator(2, 'tasks', 5)).getCollection()).toHaveLength(0);
    for (const order of ['tasks.id', 'project_name', 'tasks.title', 'tasks.priority', 'tasks.date_due']) {
      expect(await (await pagination.getDashboardPaginator(1, 'tasks', 5)).setOrder(order).getCollection()).toHaveLength(1);
    }
  });

  it('computes the total', async () => {
    const project = await seedProject(db, 'Project #1');
    for (let i = 1; i <= 11; i++) await seedTask(db, { title: `Task #${i}`, project_id: project, owner_id: 0 });
    const paginator = await new TaskPagination(container as never).getDashboardPaginator(0, 'tasks', 5);
    expect(paginator.getTotal()).toBe(11);
  });

  it('pages through the tasks', async () => {
    const project = await seedProject(db, 'Project #1');
    const numTasks = 12;
    for (let i = 1; i <= numTasks; i++) await seedTask(db, { title: `Task #${i}`, project_id: project, owner_id: 0 });
    const pagination = new TaskPagination(container as never);

    for (let m = 1; m <= numTasks; m++) {
      for (let p = 1; p <= Math.ceil(numTasks / m); p++) {
        container.set('request', fakeRequest({ page: p, pagination: 'tasks' }));
        const paginator = (await pagination.getDashboardPaginator(0, 'tasks', m)).calculate();
        expect((await paginator.getCollection())[0]!['id']).toBe(1 + (p - 1) * m);
      }
    }
  });
});

describe('SubtaskPagination', () => {
  it('lists only the tasks that have subtasks assigned to the user', async () => {
    const project = await seedProject(db, 'Project #1');
    const t1 = await seedTask(db, { title: 'Task #1', project_id: project, owner_id: 1 });
    await seedTask(db, { title: 'Task #2', project_id: project, owner_id: 1 });
    await db.table('subtasks').insert({ task_id: t1, title: 'A', user_id: 1, status: 0 });

    const paginator = await new SubtaskPagination(container as never).getDashboardPaginator(1);
    const tasks = await paginator.getCollection();
    expect(paginator.getMax()).toBe(50);
    expect(paginator.getTotal()).toBe(2);
    expect(tasks.map((t) => t['title'])).toEqual(['Task #1']);
  });
});

describe('UserPagination', () => {
  it('lists the users with every sortable column', async () => {
    await addUser('test1');
    await addUser('test2');
    const pagination = new UserPagination(container as never);

    for (const order of ['id', 'username', 'name', 'email', 'role', 'twofactor_activated', 'is_ldap_user', 'is_active']) {
      const paginator = await pagination.getListingPaginator();
      paginator.setOrder(order);
      if (order === 'twofactor_activated') paginator.setDirection('DESC');
      expect(await paginator.getCollection()).toHaveLength(3);
    }
  });
});

describe('PaginationServiceProvider', () => {
  it('registers a new paginator for every access', () => {
    const provider = createTestContainer();
    new PaginationServiceProvider().register(provider as never);
    expect(provider.get('paginator')).not.toBe(provider.get('paginator'));
    expect(provider.get('userPagination')).toBeInstanceOf(UserPagination);
  });
});
