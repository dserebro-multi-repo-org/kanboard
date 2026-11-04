import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from '../../../src/core/container/container.js';
import { phpDate } from '../../../src/core/php-date.js';
import { TaskExport } from '../../../src/export/task-export.js';
import { createTestContainer, seedProject } from './helpers.js';

let container: Container;

beforeEach(async () => {
  container = await createTestContainer({
    colorModel: { getList: () => ({ yellow: 'Yellow', red: 'Red' }) },
    taskTagModel: { getTagsByTaskIds: () => ({ 2: [{ name: 'tag 1' }, { name: 'tag 2' }] }) },
  });
  await seedProject(container);
});
afterEach(async () => container.get('db').close());

describe('TaskExport', () => {
  it('exports the tasks of a project', async () => {
    const db = container.get('db');
    const now = Math.floor(Date.now() / 1000);
    await db.table('swimlanes').insert({ id: 2, name: 'S1', position: 2, project_id: 1 });
    await db.table('project_has_categories').insert({ id: 1, name: 'Category #1', project_id: 1 });
    await db.table('tasks').insert({
      id: 1, project_id: 1, column_id: 2, swimlane_id: 1, category_id: 1, reference: 'REF1', title: 'Task 1', color_id: 'yellow',
      time_estimated: 2.5, time_spent: 3, position: 1, is_active: 1, date_creation: now, date_modification: now, creator_id: 1, owner_id: 0, score: 0,
    });
    await db.table('tasks').insert({
      id: 2, project_id: 1, column_id: 1, swimlane_id: 2, category_id: 0, reference: '', title: 'Task 2', color_id: 'yellow',
      position: 1, is_active: 1, date_creation: now, date_modification: now, date_due: now, creator_id: 1, owner_id: 0, score: 0,
    });

    const today = phpDate('Y-m-d');
    const report = await new TaskExport(container).export(1, today, today);

    expect(report).toHaveLength(3);
    expect(report[0]).toHaveLength(24);
    expect(report[0]![0]).toBe('Task Id');
    expect(report[0]![23]).toBe('Tags');

    expect(report[1]![0]).toBe(1);
    expect(report[2]![0]).toBe(2);
    expect(report[1]![1]).toBe('REF1');
    expect(report[2]![1]).toBe('');
    expect(report[1]![2]).toBe('Export Project');
    expect(report[2]![2]).toBe('Export Project');
    expect(report[1]![3]).toBe('Open');
    expect(report[2]![3]).toBe('Open');
    expect(report[1]![4]).toBe('Category #1');
    expect(report[2]![4]).toBeNull();
    expect(report[1]![5]).toBe('Default swimlane');
    expect(report[2]![5]).toBe('S1');
    expect(report[1]![6]).toBe('Ready');
    expect(report[2]![6]).toBe('Backlog');
    expect(report[1]![8]).toBe('Yellow');
    expect(report[2]![8]).toBe('Yellow');
    expect(report[1]![9]).toBe('');
    expect(report[2]![9]).toBe(phpDate('m/d/Y H:i'));
    expect(report[1]![10]).toBe('admin');
    expect(report[1]![21]).toBe(3);
    expect(report[2]![21]).toBe(0);
    expect(report[1]![20]).toBe(2.5);
    expect(report[2]![20]).toBe(0);
    expect(report[1]![23]).toBe('');
    expect(report[2]![23]).toBe('tag 1, tag 2');
  });

  it('accepts numeric bounds and excludes tasks outside of the range', async () => {
    const db = container.get('db');
    await db.table('tasks').insert({ id: 1, project_id: 1, column_id: 1, swimlane_id: 1, title: 'Old', color_id: 'red', is_active: 0, date_creation: 1000, position: 1 });

    expect(await new TaskExport(container).export(1, 2000, 3000)).toHaveLength(1);
    const report = await new TaskExport(container).export(1, 0, 2000);
    expect(report).toHaveLength(2);
    expect(report[1]![3]).toBe('Closed');
    expect(report[1]![8]).toBe('Red');
  });
});
