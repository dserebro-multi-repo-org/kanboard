import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/db/database.js';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import { BoardFormatter } from '../../../src/formatter/index.js';
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

async function extendedQuery(): Promise<FilterQuery> {
  return (container.get('taskFinderModel') as { getExtendedQuery(): FilterQuery }).getExtendedQuery();
}

async function addSwimlane(projectId: number, name: string): Promise<number> {
  return (await db.table('swimlanes').insertAndGetId({ name, position: 2, is_active: 1, project_id: projectId })) as number;
}

/** Same data set as the PHP test: 3 swimlanes, 8 tasks. */
async function seedBoard(perSwimlaneLimits = false): Promise<number> {
  const projectId = await seedProject(db, 'Test');
  if (perSwimlaneLimits) await db.table('projects').eq('id', projectId).update({ per_swimlane_task_limits: 1 });
  const swimlane1 = await addSwimlane(projectId, 'Swimlane 1');
  const swimlane2 = await addSwimlane(projectId, 'Swimlane 2');
  const first = ((await db.table('swimlanes').eq('project_id', projectId).asc('id').findOne()) as { id: number }).id;
  const task = (title: string, swimlane: number, column: number, score?: number) =>
    seedTask(db, { title, project_id: projectId, swimlane_id: swimlane, column_id: column, ...(score !== undefined ? { score } : {}) });

  await task('Task 1', first, 1);
  await task('Task 2', first, 1);
  await task('Task 3', first, 1, 4);
  await task('Task 4', first, 1, 5);
  await task('Task 5', first, 2);
  await task('Task 6', first, 3, 1);
  await task('Task 7', swimlane1, 3, 2);
  await task('Task 8', swimlane2, 3, 3);
  return projectId;
}

type Board = Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function format(projectId: number): Promise<Board> {
  return (await BoardFormatter.getInstance(container).withQuery(await extendedQuery()).withProjectId(projectId).format()) as Board;
}

describe('BoardFormatter', () => {
  it('formats the board with swimlanes', async () => {
    const board = await format(await seedBoard());

    expect(board).toHaveLength(3);
    expect(board[0]!.id).toBe(1);
    expect(board[0]!.name).toBe('Default swimlane');
    expect(board[0]!.columns).toHaveLength(4);
    expect(board[0]!.nb_swimlanes).toBe(3);
    expect(board[0]!.nb_columns).toBe(4);
    expect(board[0]!.nb_tasks).toBe(6);
    expect(board[0]!.score).toBe(10);
    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.id)).toEqual([1, 2, 3, 4]);

    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.nb_visible_tasks_across_swimlane)).toEqual([4, 1, 3, 0]);
    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.cumulative_score_across_swimlane)).toEqual([9, 0, 6, 0]);
    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.score)).toEqual([9, 0, 1, 0]);
    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.nb_tasks)).toEqual([4, 1, 1, 0]);

    expect(board[0]!.columns[0].tasks.map((t: Record<string, unknown>) => t.title)).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
    expect(board[0]!.columns[1].tasks[0].title).toBe('Task 5');
    expect(board[0]!.columns[2].tasks[0].title).toBe('Task 6');

    expect(board[1]!.name).toBe('Swimlane 1');
    expect(board[1]!.nb_tasks).toBe(1);
    expect(board[1]!.score).toBe(2);
    expect(board[1]!.columns.map((c: Record<string, unknown>) => c.score)).toEqual([0, 0, 2, 0]);
    expect(board[1]!.columns.map((c: Record<string, unknown>) => c.nb_tasks)).toEqual([0, 0, 1, 0]);
    expect(board[1]!.columns[2].tasks[0].title).toBe('Task 7');

    expect(board[2]!.name).toBe('Swimlane 2');
    expect(board[2]!.nb_tasks).toBe(1);
    expect(board[2]!.score).toBe(3);
    expect(board[2]!.columns[2].tasks[0].title).toBe('Task 8');
    expect(board[2]!.columns[2].tasks[0]).toHaveProperty('is_draggable', true);
  });

  it('exposes the task limit across swimlanes', async () => {
    const board = await format(await seedBoard());

    for (const swimlane of board) {
      expect(swimlane.columns.map((c: Record<string, unknown>) => c.nb_visible_tasks_across_swimlane)).toEqual([4, 1, 3, 0]);
      expect(swimlane.columns.map((c: Record<string, unknown>) => c.cumulative_score_across_swimlane)).toEqual([9, 0, 6, 0]);
      expect(swimlane.columns.map((c: Record<string, unknown>) => c.nb_unfiltered_tasks_across_swimlane)).toEqual([4, 1, 3, 0]);
      expect(swimlane.columns.map((c: Record<string, unknown>) => c.column_nb_open_tasks)).toEqual([4, 1, 3, 0]);
    }
  });

  it('computes the open task count per swimlane when the project uses per swimlane limits', async () => {
    const board = await format(await seedBoard(true));

    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.column_nb_open_tasks)).toEqual([4, 1, 1, 0]);
    expect(board[1]!.columns.map((c: Record<string, unknown>) => c.column_nb_open_tasks)).toEqual([0, 0, 1, 0]);
    expect(board[2]!.columns.map((c: Record<string, unknown>) => c.column_nb_open_tasks)).toEqual([0, 0, 1, 0]);
    expect(board[0]!.columns.map((c: Record<string, unknown>) => c.nb_visible_tasks_across_swimlane)).toEqual([4, 1, 3, 0]);
  });

  it('formats a board without the default swimlane', async () => {
    const projectId = await seedProject(db, 'Test');
    await db.table('swimlanes').eq('project_id', projectId).update({ is_active: 0 });
    const swimlane = await addSwimlane(projectId, 'Swimlane 1');
    await seedTask(db, { title: 'Task 1', project_id: projectId, swimlane_id: swimlane, column_id: 1 });

    const board = await format(projectId);
    expect(board).toHaveLength(1);
    expect(board[0]!.name).toBe('Swimlane 1');
    expect(board[0]!.columns[0].tasks).toHaveLength(1);
  });

  it('returns an empty board without active swimlane', async () => {
    const projectId = await seedProject(db, 'Test');
    await db.table('swimlanes').eq('project_id', projectId).update({ is_active: 0 });
    expect(await format(projectId)).toEqual([]);
  });

  it('returns an empty board without column', async () => {
    const projectId = await seedProject(db, 'Test');
    await db.table('columns').eq('project_id', projectId).remove();
    expect(await format(projectId)).toEqual([]);
  });

  it('formats a board without task', async () => {
    const projectId = await seedProject(db, 'Test');
    const board = await format(projectId);

    expect(board).toHaveLength(1);
    expect(board[0]!.nb_tasks).toBe(0);
    expect(board[0]!.score).toBe(0);
    expect(board[0]!.columns).toHaveLength(4);
    for (const column of board[0]!.columns) {
      expect(column.tasks).toEqual([]);
      expect(column.nb_tasks).toBe(0);
    }
  });

  it('adds the tags of the tasks', async () => {
    const projectId = await seedProject(db, 'Test');
    const first = await seedTask(db, { title: 'Task 1', project_id: projectId, swimlane_id: 1, column_id: 1 });
    await seedTask(db, { title: 'Task 2', project_id: projectId, swimlane_id: 1, column_id: 1 });
    const tag = (await db.table('tags').insertAndGetId({ name: 'My tag 1', project_id: projectId })) as number;
    await db.table('task_has_tags').insert({ task_id: first, tag_id: tag });

    const board = await format(projectId);
    const tasks = board[0]!.columns[0].tasks;
    expect(tasks[0].tags).toEqual([{ id: tag, name: 'My tag 1', task_id: first, color_id: null }]);
    expect(tasks[1].tags).toEqual([]);
  });

  it('calls the formatter:board:query hook with the query', async () => {
    const projectId = await seedProject(db, 'Test');
    let received: unknown = null;
    (container.get('hook') as { on(h: string, l: (q: unknown) => void): void }).on('formatter:board:query', (query) => {
      received = query;
    });
    await format(projectId);
    expect(received).not.toBeNull();
  });
});
