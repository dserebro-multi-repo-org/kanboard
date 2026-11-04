import { describe, it } from 'vitest';
import { expectAll } from './helpers.js';
import { ExternalLinkValidator } from '../../../src/validator/external-link-validator.js';

const validator = new ExternalLinkValidator();
const base = { url: 'http://somewhere', task_id: 1, title: 'Title', link_type: 'weblink', dependency: 'related' };
const without = (key: keyof typeof base, extra: Record<string, unknown> = {}) => {
  const copy: Record<string, unknown> = { ...extra, ...base };
  delete copy[key];
  return copy;
};

describe('ExternalLinkValidator', () => {
  it('validates the creation', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [base, true],
      [{ ...base, task_id: 'abc' }, false],
      [without('dependency'), false],
      [without('link_type'), false],
      [without('title'), false],
      [without('task_id'), false],
      [without('url'), false],
    ]);
  });

  it('validates the modification', async () => {
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, ...base }, true],
      [{ id: 1, ...base, task_id: 'abc' }, false],
      [without('dependency', { id: 1 }), false],
      [without('link_type', { id: 1 }), false],
      [without('title', { id: 1 }), false],
      [without('task_id', { id: 1 }), false],
      [without('url', { id: 1 }), false],
      [base, false],
    ]);
  });
});
