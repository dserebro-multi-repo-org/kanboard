import { describe, it } from 'vitest';
import { expectAll } from './helpers.js';
import { CurrencyValidator } from '../../../src/validator/currency-validator.js';

describe('CurrencyValidator', () => {
  it('validates the creation', async () => {
    const validator = new CurrencyValidator();
    await expectAll((v) => validator.validateCreation(v), [
      [{}, false],
      [{ currency: 'EUR' }, false],
      [{ rate: 1.9 }, false],
      [{ currency: 'EUR', rate: 'foobar' }, false],
      [{ currency: 'EUR', rate: 1.25 }, true],
    ]);
  });
});
