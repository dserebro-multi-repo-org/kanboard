import { describe, it } from 'vitest';
import { expectAll } from './helpers.js';
import { CustomFilterValidator } from '../../../src/validator/custom-filter-validator.js';

const validator = new CustomFilterValidator();
const base = { filter: 'test', name: 'test', user_id: 1, project_id: 1, is_shared: 0 };

describe('CustomFilterValidator', () => {
  it('validates the creation', async () => {
    const { filter: _f, ...noFilter } = base;
    await expectAll((v) => validator.validateCreation(v), [
      [base, true],
      [{ ...base, filter: 'a'.repeat(65536) }, false],
      [noFilter, false],
    ]);
  });

  it('validates the modification', async () => {
    const { filter: _f, ...noFilter } = base;
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, ...base }, true],
      [base, false],
      [{ id: 1, ...base, filter: 'a'.repeat(65536) }, false],
      [{ id: 1, ...noFilter }, false],
    ]);
  });
});
