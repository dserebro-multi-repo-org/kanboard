import { describe, expect, it } from 'vitest';
import { FakeDb, expectAll } from './helpers.js';
import { Role } from '../../../src/foundation/validator-collaborators.js';
import { UserValidator } from '../../../src/validator/user-validator.js';
import type { UserValidatorDeps } from '../../../src/validator/user-validator.js';

function deps(overrides: Partial<UserValidatorDeps> = {}, admin = true): UserValidatorDeps {
  return {
    db: new FakeDb({ users: [{ id: 1, username: 'admin' }] }),
    themeModel: { getThemes: () => ({ light: 'Light', dark: 'Dark' }) },
    languageModel: { getLanguages: () => ({ en_US: 'English' }) },
    role: { getApplicationRoles: () => ({ [Role.APP_ADMIN]: 'Administrator', [Role.APP_MANAGER]: 'Manager', [Role.APP_USER]: 'User' }) },
    userSession: { isLogged: () => true, isAdmin: () => admin, getId: () => 1, getUsername: () => 'admin' },
    authenticationManager: { passwordAuthentication: (username, password) => username === 'admin' && password === 'admin' },
    ...overrides,
  };
}

describe('UserValidator', () => {
  it('validates the password modification', async () => {
    const validator = new UserValidator(deps());
    await expectAll((v) => validator.validatePasswordModification(v), [
      [{}, false],
      [{ id: 1 }, false],
      [{ id: 1, password: '123456' }, false],
      [{ id: 1, password: '123456', confirmation: 'wrong' }, false],
      [{ id: 1, password: '123456', confirmation: '123456' }, false],
      [{ id: 1, password: '123456', confirmation: '123456', current_password: 'wrong' }, false],
      [{ id: 1, password: '123456', confirmation: '123456', current_password: 'admin' }, true],
    ]);
  });

  it('reports a wrong current password and forbids changing another user as non admin', async () => {
    const validator = new UserValidator(deps());
    expect(await validator.validatePasswordModification({ id: 1, password: '123456', confirmation: '123456', current_password: 'bad' })).toEqual([
      false,
      { current_password: ['Wrong password'] },
    ]);

    const user = new UserValidator(deps({}, false));
    expect(await user.validatePasswordModification({ id: 2, password: '123456', confirmation: '123456', current_password: 'admin' })).toEqual([
      false,
      { current_password: ['Invalid User ID'] },
    ]);
  });

  it('validates the creation (password rules apply except for LDAP users)', async () => {
    const validator = new UserValidator(deps());
    await expectAll((v) => validator.validateCreation(v), [
      [{ username: 'bob', password: '123456', confirmation: '123456' }, true],
      [{ username: 'bob' }, false],
      [{ username: 'bob', is_ldap_user: 1 }, true],
      [{ username: 'bob', is_ldap_user: '1' }, true],
      [{ username: 'admin', password: '123456', confirmation: '123456' }, false],
      [{ password: '123456', confirmation: '123456' }, false],
      [{ username: 'bob', password: '123456', confirmation: '123456', role: 'bad' }, false],
      [{ username: 'bob', password: '123456', confirmation: '123456', role: Role.APP_USER, theme: 'dark', language: 'en_US', timezone: 'UTC' }, true],
      [{ username: 'bob', password: '123456', confirmation: '123456', theme: 'bad' }, false],
      [{ username: 'bob', password: '123456', confirmation: '123456', language: 'xx' }, false],
      [{ username: 'bob', password: '123456', confirmation: '123456', timezone: 'nowhere' }, false],
      [{ username: 'bob', password: '123456', confirmation: '123456', email: 'bad' }, false],
    ]);
  });

  it('validates the modification and the API modification', async () => {
    const validator = new UserValidator(deps());
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, username: 'admin' }, true],
      [{ id: 2, username: 'admin' }, false],
      [{ username: 'x' }, false],
      [{ id: 1 }, false],
    ]);
    await expectAll((v) => validator.validateApiModification(v), [
      [{ id: 1 }, true],
      [{ id: 1, username: 'new' }, true],
      [{ username: 'new' }, false],
    ]);
  });
});
