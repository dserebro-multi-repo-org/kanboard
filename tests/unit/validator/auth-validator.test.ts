import { describe, expect, it } from 'vitest';
import { AuthValidator } from '../../../src/validator/auth-validator.js';
import type { AuthValidatorDeps } from '../../../src/validator/auth-validator.js';

function setup(overrides: Partial<AuthValidatorDeps> = {}, session: Record<string, unknown> = {}) {
  const logs: string[] = [];
  const deps: AuthValidatorDeps = {
    userLockingModel: { isLocked: () => false, hasCaptcha: () => false },
    captchaModel: { isLocked: () => false },
    authenticationManager: { passwordAuthentication: (username, password) => username === 'admin' && password === 'admin' },
    request: { getIpAddress: () => '127.0.0.1' },
    logger: { error: (message) => void logs.push(message) },
    session: { exists: (key) => key in session, get: (key) => session[key], remove: (key) => void delete session[key] },
    ...overrides,
  };
  return { validator: new AuthValidator(deps), logs };
}

describe('AuthValidator', () => {
  it('accepts valid credentials', async () => {
    expect(await setup().validator.validateForm({ username: 'admin', password: 'admin' })).toEqual([true, {}]);
  });

  it('reports missing and too long fields before anything else', async () => {
    const { validator } = setup({ authenticationManager: { passwordAuthentication: () => { throw new Error('must not be called'); } } });
    expect(await validator.validateForm({})).toEqual([false, { username: ['The username is required'], password: ['The password is required'] }]);
    expect(await validator.validateForm({ username: 'a'.repeat(192), password: 'x' })).toEqual([
      false,
      { username: ['The maximum length is 191 characters'] },
    ]);
  });

  it('reports bad credentials as a plain string under login', async () => {
    expect(await setup().validator.validateForm({ username: 'admin', password: 'nope' })).toEqual([false, { login: 'Bad username or password' }]);
  });

  it('reports a locked account and logs it', async () => {
    const { validator, logs } = setup({ userLockingModel: { isLocked: () => true, hasCaptcha: () => false } });
    expect(await validator.validateForm({ username: 'admin', password: 'admin' })).toEqual([false, { login: 'Your account is locked for 15 minutes' }]);
    expect(logs).toEqual(['Account locked: admin']);
  });

  it('requires the captcha when the user or the IP address has one', async () => {
    const locking = { isLocked: () => false, hasCaptcha: () => true };
    const values = { username: 'admin', password: 'admin', captcha: 'AbCd' };

    expect((await setup({ userLockingModel: locking }).validator.validateForm(values))[0]).toBe(false);
    expect((await setup({ userLockingModel: locking }, { captcha: 'abcd' }).validator.validateForm(values))[0]).toBe(true);
    expect(await setup({ userLockingModel: locking }, { captcha: 'zzzz' }).validator.validateForm(values)).toEqual([false, { login: 'Bad username or password' }]);

    const byIp = { captchaModel: { isLocked: (ip: string) => ip === '127.0.0.1' } };
    expect((await setup(byIp, { captcha: 'zzzz' }).validator.validateForm(values))[0]).toBe(false);
  });
});
