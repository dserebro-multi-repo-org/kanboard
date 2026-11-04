import { describe, expect, it } from 'vitest';
import { colorModel, dateParser, expectAll } from './helpers.js';
import { TaskValidator } from '../../../src/validator/task-validator.js';

const validator = new TaskValidator({ colorModel, dateParser });
const task = (extra: Record<string, unknown> = {}) => ({ project_id: 1, title: 'test', ...extra });

describe('TaskValidator', () => {
  it('validates the email creation', async () => {
    await expectAll((v) => validator.validateEmailCreation(v), [
      [{ emails: 'test@localhost', subject: 'test' }, true],
      [{ subject: 'test' }, false],
      [{ emails: 'test@localhost, test@localhost' }, false],
    ]);
  });

  it('checks the required fields', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [{ project_id: 1, title: 'test' }, true],
      [{ project_id: 1 }, false],
      [{ title: 'test' }, false],
    ]);
  });

  it('checks the range of the score', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [task({ score: 2147483647 }), true],
      [task({ score: -2147483647 }), true],
      [task({ score: 0 }), true],
      [task({ score: 2147483648 }), false],
      [task({ score: -2147483648 }), false],
    ]);
  });

  it('checks the swimlane id', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [task({ swimlane_id: 1 }), true],
      [task({ swimlane_id: 0 }), false],
    ]);
  });

  it('checks the start and due dates', async () => {
    const cases: Array<[Record<string, unknown>, boolean]> = [
      [task({ date_due: '09/11/2017 10:50', date_started: '09/11/2017 9:50' }), true],
      [task({ date_due: '09/11/2017 10:50', date_started: '09/11/2017 10:50' }), true],
      [task({ date_due: '09/11/2017 10:50', date_started: '09/11/2017 11:50' }), false],
    ];
    for (const field of ['date_due', 'date_started']) {
      cases.push(
        [task({ [field]: '2017-02-01' }), true],
        [task({ [field]: '2017-02-01 13:15' }), true],
        [task({ [field]: '2017-02-01 1:15 pm' }), false],
        [task({ [field]: '2017_02_01' }), true],
        [task({ [field]: '2017_02_01 13:15' }), true],
        [task({ [field]: '2017_02_01 1:15 am' }), false],
        [task({ [field]: '02/01/2017' }), true],
        [task({ [field]: '02/01/2017 13:15' }), true],
        [task({ [field]: '02/01/2017 1:15 pm' }), false],
      );
    }
    await expectAll((v) => validator.validateCreation(v), cases);
  });

  it('reports the date order error under date_started', async () => {
    expect(await validator.validateCreation(task({ date_due: '09/11/2017 10:50', date_started: '09/11/2017 11:50' }))).toEqual([
      false,
      { date_started: ['The start date is greater than the end date'] },
    ]);
  });

  it('validates the other operations', async () => {
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, title: 'x' }, true],
      [{ id: 1 }, false],
      [{ title: 'x' }, false],
      [{ id: 1, title: 'x', date_started: '2017-02-02', date_due: '2017-02-01' }, false],
    ]);
    await expectAll((v) => validator.validateApiModification(v), [
      [{ id: 1 }, true],
      [{}, false],
      [{ id: 1, date_started: '2017-02-02', date_due: '2017-02-01' }, false],
    ]);
    await expectAll((v) => validator.validateEditRecurrence(v), [
      [{ id: 1, recurrence_status: 1 }, true],
      [{ id: 1, recurrence_status: 'x' }, false],
      [{ recurrence_status: 1 }, false],
    ]);
    await expectAll((v) => validator.validateProjectModification(v), [
      [{ id: 1, project_id: 2 }, true],
      [{ id: 1 }, false],
    ]);
    await expectAll((v) => validator.validateBulkCreation(v), [
      [{ tasks: 'a\nb', column_id: 1, swimlane_id: 1 }, true],
      [{ tasks: 'a\nb', column_id: 1 }, false],
      [{ column_id: 1, swimlane_id: 1 }, false],
      [{ tasks: 'a', column_id: 1, swimlane_id: 'x' }, false],
    ]);
  });

  it('returns the PHP messages for each invalid field', async () => {
    const [valid, errors] = await validator.validateCreation({ title: '', score: 'x', swimlane_id: 0, time_spent: 'abc', date_due: 'bad' });
    expect(valid).toBe(false);
    expect(errors).toEqual({
      project_id: ['The project is required'],
      title: ['The title is required'],
      score: ['This value must be an integer', 'This value must be in the range -2147483647 to 2147483647'],
      swimlane_id: ['This value must be greater than 0'],
      date_due: ['Invalid date'],
      time_spent: ['This value must be numeric'],
    });
  });
});
