import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from '../../../src/core/container/container.js';
import { phpDate } from '../../../src/core/php-date.js';
import { SubtaskExport } from '../../../src/export/subtask-export.js';
import { createTestContainer, seedProject } from './helpers.js';

let container: Container;

beforeEach(async () => {
  container = await createTestContainer({
    subtaskModel: { getStatusList: () => ({ 0: 'Todo', 1: 'In progress', 2: 'Done' }) },
  });
  await seedProject(container);
});
afterEach(async () => container.get('db').close());

describe('SubtaskExport', () => {
  it('has the expected columns', () => {
    expect(new SubtaskExport(container).getColumns()).toEqual([
      'Subtask Id', 'Title', 'Status', 'Assignee', 'Time estimated', 'Time spent', 'Task Id', 'Task Title',
    ]);
  });

  it('exports the subtasks of a project', async () => {
    const db = container.get('db');
    const now = Math.floor(Date.now() / 1000);
    await db.table('users').insert({ id: 2, username: 'bob', name: 'Bob B' });
    await db.table('tasks').insert({ id: 1, project_id: 1, column_id: 1, swimlane_id: 1, title: 'Task 1', color_id: 'yellow', is_active: 1, date_creation: now, position: 1 });
    await db.table('subtasks').insert({ id: 1, title: 'Sub 1', status: 2, time_estimated: 1.5, time_spent: 2, task_id: 1, user_id: 2 });
    await db.table('subtasks').insert({ id: 2, title: 'Sub 2', status: 0, time_estimated: 0, time_spent: 0, task_id: 1, user_id: 1 });

    const today = phpDate('Y-m-d');
    const report = await new SubtaskExport(container).export(1, today, today);

    expect(report).toHaveLength(3);
    expect(report[1]).toEqual([1, 'Sub 1', 'Done', 'Bob B', 1.5, 2, 1, 'Task 1']);
    expect(report[2]).toEqual([2, 'Sub 2', 'Todo', 'admin', 0, 0, 1, 'Task 1']);
  });

  it('keeps an empty assignee when nobody is assigned', () => {
    const exporter = new SubtaskExport(container);
    expect(exporter.format({ id: 1, title: 't', status: 0, assignee_name: null, assignee_username: null, time_estimated: 0, time_spent: 0, task_id: 1, task_title: 'x' })[3]).toBeNull();
  });
});
