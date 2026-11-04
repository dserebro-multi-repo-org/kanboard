import { describe, expect, it } from 'vitest';
import { FakeDb, expectAll } from './helpers.js';
import { ProjectValidator } from '../../../src/validator/project-validator.js';

describe('ProjectValidator', () => {
  it('validates the creation', async () => {
    const db = new FakeDb({
      projects: [
        { id: 1, name: 'UnitTest1', identifier: 'TEST1' },
        { id: 2, name: 'UnitTest2', identifier: '' },
      ],
    });
    const validator = new ProjectValidator({ db });
    await expectAll((v) => validator.validateCreation(v), [
      [{ name: 'test', identifier: 'TEST1' }, false],
      [{ name: 'test', identifier: 'test1' }, false],
      [{ name: 'test', identifier: 'a-b-c' }, false],
      [{ name: 'test', identifier: 'test 123' }, false],
      [{ name: 'test', identifier: 'test9' }, true],
      [{ name: 'test' }, true],
      [{ identifier: 'test9' }, false],
    ]);
  });

  it('validates the modification', async () => {
    const db = new FakeDb({
      projects: [
        { id: 1, name: 'UnitTest1', identifier: 'TEST1' },
        { id: 2, name: 'UnitTest2', identifier: 'TEST2' },
      ],
    });
    const validator = new ProjectValidator({ db });
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, name: 'test', identifier: 'TEST1' }, true],
      [{ id: 1, identifier: 'test3' }, true],
      [{ id: 1, identifier: '' }, true],
      [{ id: 1, identifier: 'TEST2' }, false],
      [{ id: 1, name: '' }, false],
      [{ id: 1, name: null }, false],
    ]);
  });

  it('checks the email uniqueness and format', async () => {
    const db = new FakeDb({ projects: [{ id: 1, name: 'A', email: 'a@example.com' }] });
    const validator = new ProjectValidator({ db });
    expect(await validator.validateCreation({ name: 'B', email: 'a@example.com' })).toEqual([
      false,
      { email: ['The project email must be unique across all projects'] },
    ]);
    expect(await validator.validateCreation({ name: 'B', email: 'nope' })).toEqual([false, { email: ['Email address invalid'] }]);
  });
});
