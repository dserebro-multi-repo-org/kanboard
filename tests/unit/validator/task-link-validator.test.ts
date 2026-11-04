import { describe, expect, it } from 'vitest';
import { FakeDb, expectAll } from './helpers.js';
import { TaskLinkValidator } from '../../../src/validator/task-link-validator.js';

const validator = new TaskLinkValidator({ db: new FakeDb({ tasks: [{ id: 1 }, { id: 2 }] }) });

describe('TaskLinkValidator', () => {
  it('validates the creation', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [{ task_id: 1, link_id: 1, opposite_task_id: 2 }, true],
      [{ task_id: 1, link_id: 1 }, false],
      [{ task_id: 1, opposite_task_id: 2 }, false],
      [{ task_id: 1, link_id: 1, opposite_task_id: 1 }, false],
      [{ task_id: 1, link_id: 1, opposite_task_id: 99 }, false],
    ]);
  });

  it('validates the modification', async () => {
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, task_id: 1, link_id: 1, opposite_task_id: 2 }, true],
      [{ id: 1, task_id: 1, link_id: 1 }, false],
      [{ id: 1, task_id: 1, opposite_task_id: 2 }, false],
      [{ id: 1, task_id: 1, link_id: 1, opposite_task_id: 1 }, false],
      [{ task_id: 1, link_id: 1, opposite_task_id: 2 }, false],
    ]);
  });

  it('reports the PHP messages', async () => {
    expect(await validator.validateCreation({ task_id: 1, link_id: 1, opposite_task_id: 1 })).toEqual([
      false,
      { opposite_task_id: ['A task cannot be linked to itself'] },
    ]);
    expect(await validator.validateCreation({ task_id: 1, link_id: 1, opposite_task_id: 99 })).toEqual([
      false,
      { opposite_task_id: ["This linked task id doesn't exists"] },
    ]);
  });
});
