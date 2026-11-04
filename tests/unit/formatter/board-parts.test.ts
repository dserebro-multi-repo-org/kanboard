import { describe, expect, it } from 'vitest';
import { BoardColumnFormatter, BoardSwimlaneFormatter, BoardTaskFormatter } from '../../../src/formatter/index.js';
import { createTestContainer } from '../support/m6-container.js';

describe('BoardTaskFormatter', () => {
  it('keeps the tasks of the column and swimlane, adds tags and the draggable flag', async () => {
    const container = createTestContainer();
    const tasks = [
      { id: 1, column_id: 1, swimlane_id: 1 },
      { id: 2, column_id: '1', swimlane_id: '1' },
      { id: 3, column_id: 2, swimlane_id: 1 },
    ];
    const result = await new BoardTaskFormatter(container)
      .withTasks(tasks)
      .withTags({ 2: [{ name: 'tag' }] })
      .withColumnId(1)
      .withSwimlaneId(1)
      .format();

    expect(result).toEqual([
      { id: 1, column_id: 1, swimlane_id: 1, tags: [], is_draggable: true },
      { id: 2, column_id: '1', swimlane_id: '1', tags: [{ name: 'tag' }], is_draggable: true },
    ]);
    // the source rows are not altered
    expect(tasks[0]).toEqual({ id: 1, column_id: 1, swimlane_id: 1 });
  });
});

describe('BoardColumnFormatter', () => {
  it('computes counters and does not alter the given columns', async () => {
    const container = createTestContainer();
    const columns = [{ id: '1', nb_open_tasks: 3 }, { id: '2', nb_open_tasks: 0 }];
    const tasks = [
      { id: 1, column_id: 1, swimlane_id: 0, score: 2 },
      { id: 2, column_id: 1, swimlane_id: 0, score: '3' },
    ];

    const result = await new BoardColumnFormatter(container).withColumns(columns).withTasks(tasks).withSwimlaneId(0).format();
    expect(result[0]).toMatchObject({ id: 1, nb_tasks: 2, score: 5, column_nb_open_tasks: 3 });
    expect(result[1]).toMatchObject({ id: 2, nb_tasks: 0, score: 0, column_nb_open_tasks: 0 });
    expect(columns[0]).toEqual({ id: '1', nb_open_tasks: 3 });

    const limited = await new BoardColumnFormatter(container)
      .withColumns(columns)
      .withTasks(tasks)
      .withSwimlaneId(0)
      .withTaskCountBySwimlaneAndColumn({ 0: { 1: 7 } })
      .format();
    expect(limited[0]!['column_nb_open_tasks']).toBe(7);
    expect(limited[1]!['column_nb_open_tasks']).toBe(0);
  });
});

describe('BoardSwimlaneFormatter', () => {
  it('aggregates the statistics of every column across swimlanes', async () => {
    const container = createTestContainer();
    const swimlanes = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];
    const columns = [{ id: 1, nb_open_tasks: 3 }];
    const tasks = [
      { id: 1, column_id: 1, swimlane_id: 1, score: 1 },
      { id: 2, column_id: 1, swimlane_id: 2, score: 4 },
      { id: 3, column_id: 1, swimlane_id: 2, score: 4 },
    ];

    const result = await new BoardSwimlaneFormatter(container)
      .withSwimlanes(swimlanes)
      .withColumns(columns)
      .withTasks(tasks)
      .format();

    expect(result.map((s) => s['id'])).toEqual([1, 2]);
    expect(result.map((s) => s['nb_tasks'])).toEqual([1, 2]);
    expect(result.map((s) => s['score'])).toEqual([1, 8]);
    for (const swimlane of result) {
      const column = (swimlane['columns'] as Array<Record<string, unknown>>)[0]!;
      expect(column).toMatchObject({
        nb_visible_tasks_across_swimlane: 3,
        nb_unfiltered_tasks_across_swimlane: 3,
        cumulative_score_across_swimlane: 9,
      });
    }
    // the shared column definition has not been decorated
    expect(columns[0]).toEqual({ id: 1, nb_open_tasks: 3 });
  });
});
