import { describe, expect, it } from 'vitest';
import { PasswordResetValidator } from '../../../src/validator/password-reset-validator.js';
import type { ValidatorSession } from '../../../src/foundation/validator-collaborators.js';

function makeSession(initial: Record<string, unknown> = {}): ValidatorSession & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    exists: (key) => key in data,
    get: (key) => data[key],
    remove: (key) => {
      delete data[key];
    },
  };
}

describe('PasswordResetValidator', () => {
  const validator = new PasswordResetValidator({ session: makeSession() });

  it('validates the modification', async () => {
    expect((await validator.validateModification({ password: 'test123', confirmation: 'test123' }))[0]).toBe(true);
  });

  it('rejects different passwords', async () => {
    const [valid, errors] = await validator.validateModification({ password: 'test123', confirmation: 'test456' });
    expect(valid).toBe(false);
    expect(errors).toEqual({ password: ["Passwords don't match"] });
  });

  it('rejects a password that is too short', async () => {
    const [valid, errors] = await validator.validateModification({ password: 'test', confirmation: 'test' });
    expect(valid).toBe(false);
    expect(errors['password']).toContain('The minimum length is 6 characters');
  });

  it('validates the creation', async () => {
    const session = makeSession({ captcha: 'test' });
    const v = new PasswordResetValidator({ session });
    expect((await v.validateCreation({ username: 'foobar', captcha: 'test' }))[0]).toBe(true);
    // The captcha is invalidated to avoid reuse.
    expect(session.exists('captcha')).toBe(false);
  });

  it('rejects a missing username', async () => {
    const v = new PasswordResetValidator({ session: makeSession({ captcha: 'test' }) });
    expect((await v.validateCreation({ captcha: 'test' }))[0]).toBe(false);
  });

  it('rejects a wrong captcha and invalidates it', async () => {
    const session = makeSession({ captcha: 'test123' });
    const v = new PasswordResetValidator({ session });
    expect(await v.validateCreation({ username: 'foobar', captcha: 'test' })).toEqual([false, { captcha: ['Invalid captcha'] }]);
    expect(session.exists('captcha')).toBe(false);
  });

  it('rejects a missing captcha in session', async () => {
    const v = new PasswordResetValidator({ session: makeSession() });
    expect((await v.validateCreation({ username: 'foobar', captcha: 'test' }))[0]).toBe(false);
  });

  it('compares captcha phrases like Gregwar niceize (case insensitive, 0/1 mapped)', async () => {
    const v = new PasswordResetValidator({ session: makeSession({ captcha: 'Ab0l' }) });
    expect((await v.validateCreation({ username: 'foobar', captcha: 'aB01' }))[0]).toBe(true);
  });
});
