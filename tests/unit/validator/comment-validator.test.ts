import { describe, expect, it } from 'vitest';
import { expectAll } from './helpers.js';
import { Role } from '../../../src/foundation/validator-collaborators.js';
import { CommentValidator } from '../../../src/validator/comment-validator.js';

const validator = new CommentValidator();

describe('CommentValidator', () => {
  it('validates the email creation', async () => {
    const base = { user_id: 1, task_id: 1, comment: 'blah', visibility: Role.APP_USER, emails: 'test@localhost, another@localhost', subject: 'something' };
    const { emails: _e, ...noEmails } = base;
    const { visibility: _v, ...noVisibility } = base;
    await expectAll((v) => validator.validateEmailCreation(v), [
      [base, true],
      [noEmails, false],
      [noVisibility, false],
      [{ ...base, visibility: 'admin' }, false],
    ]);
  });

  it('validates the creation', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [{ user_id: 1, task_id: 1, comment: 'bla', visibility: Role.APP_USER }, true],
      [{ user_id: 1, task_id: 1, comment: '', visibility: 'admin' }, false],
      [{ user_id: 1, task_id: 1, comment: '', visibility: Role.APP_USER }, false],
      [{ user_id: 1, task_id: 'a', comment: 'bla', visibility: Role.APP_USER }, false],
      [{ user_id: 'b', task_id: 1, comment: 'bla', visibility: Role.APP_USER }, false],
      [{ user_id: 1, comment: 'bla', visibility: Role.APP_USER }, false],
      [{ task_id: 1, comment: 'bla', visibility: Role.APP_USER }, true],
      [{ user_id: 1, task_id: 1, comment: 'bla' }, false],
      [{ task_id: 1, comment: 'bla' }, false],
      [{ comment: 'bla' }, false],
      [{}, false],
    ]);
  });

  it('validates the modification', async () => {
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, comment: 'bla' }, true],
      [{ id: 1, comment: '' }, false],
      [{ comment: 'bla' }, false],
      [{ id: 'b', comment: 'bla' }, false],
      [{}, false],
    ]);
  });

  it('returns the translated messages keyed by field', async () => {
    const [valid, errors] = await validator.validateCreation({ visibility: 'admin' });
    expect(valid).toBe(false);
    expect(errors).toEqual({
      task_id: ['This value is required'],
      visibility: ['The visibility should be an app role'],
      comment: ['Comment is required'],
    });
  });
});
