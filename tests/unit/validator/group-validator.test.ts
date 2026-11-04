import { describe, expect, it } from 'vitest';
import { FakeDb, expectAll } from './helpers.js';
import { GroupValidator } from '../../../src/validator/group-validator.js';

describe('GroupValidator', () => {
  it('validates the creation', async () => {
    const validator = new GroupValidator({ db: new FakeDb({ groups: [] }) });
    await expectAll((v) => validator.validateCreation(v), [
      [{ name: 'Test' }, true],
      [{ name: '' }, false],
    ]);
  });

  it('validates the modification', async () => {
    const validator = new GroupValidator({ db: new FakeDb({ groups: [{ id: 1, name: 'Test' }] }) });
    await expectAll((v) => validator.validateModification(v), [
      [{ name: 'Test', id: 1 }, true],
      [{ name: 'Test' }, false],
    ]);
  });

  it('requires a unique name', async () => {
    const validator = new GroupValidator({ db: new FakeDb({ groups: [{ id: 1, name: 'Test' }] }) });
    expect(await validator.validateCreation({ name: 'Test' })).toEqual([false, { name: ['The name must be unique'] }]);
  });
});
