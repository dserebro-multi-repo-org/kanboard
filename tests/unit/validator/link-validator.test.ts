import { describe, expect, it } from 'vitest';
import { FakeDb, expectAll } from './helpers.js';
import { LinkValidator } from '../../../src/validator/link-validator.js';

// Default links of a fresh Kanboard installation.
const db = new FakeDb({ links: [{ id: 1, label: 'relates to' }, { id: 2, label: 'blocks' }] });
const validator = new LinkValidator({ db });

describe('LinkValidator', () => {
  it('validates the creation', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [{ label: 'a' }, true],
      [{ label: 'a', opposite_label: 'b' }, true],
      [{ label: 'relates to' }, false],
      [{ label: 'a', opposite_label: 'a' }, false],
      [{ label: '' }, false],
    ]);
  });

  it('validates the modification', async () => {
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 20, label: 'a', opposite_id: 0 }, true],
      [{ id: 20, label: 'a', opposite_id: '1' }, true],
      [{ id: 20, label: 'relates to', opposite_id: '1' }, false],
      [{ id: 20, label: '', opposite_id: '1' }, false],
      [{ label: '', opposite_id: '1' }, false],
      [{ id: 20, opposite_id: '1' }, false],
      [{ label: 'test' }, false],
    ]);
  });

  it('reports the PHP messages', async () => {
    expect(await validator.validateCreation({ label: 'a', opposite_label: 'a' })).toEqual([false, { label: ['The labels must be different'] }]);
    expect(await validator.validateCreation({ label: 'relates to' })).toEqual([false, { label: ['This label must be unique'] }]);
  });
});
