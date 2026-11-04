import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from '../../../src/core/container/container.js';
import { UserImport } from '../../../src/import/user-import.js';
import { createTestContainer, spyLogger } from './helpers.js';

let container: Container;
let users: Array<Record<string, unknown>>;
let selected: unknown[][];
const notifications = '0';
const log = spyLogger();
let dir: string;

beforeEach(async () => {
  users = [];
  selected = [];
  log.debug.length = 0;
  log.error.length = 0;
  dir = mkdtempSync(path.join(tmpdir(), 'kb-uimport-'));
  container = await createTestContainer({
    userModel: {
      create: async (values: Record<string, unknown>) => {
        users.push(values);
        await container.get('db').table('users').insert({ username: values.username as string });
        return users.length + 1;
      },
    },
    userNotificationTypeModel: { saveSelectedTypes: (...args: unknown[]) => void selected.push(args) },
  });
  const loose = container as unknown as Container<Record<string, unknown>>;
  loose.set('logger', log.instance);
  await container.get('configModel').save({ notifications_enabled: notifications });
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
  await container.get('db').close();
});

describe('UserImport', () => {
  it('maps the columns', () => {
    expect(Object.keys(new UserImport(container).getColumnMapping())).toEqual(['username', 'password', 'email', 'name', 'is_admin', 'is_manager', 'is_ldap_user']);
  });

  it('prepares the roles and removes empty fields', () => {
    const importer = new UserImport(container);
    const base = { username: 'JOHN', password: '', email: '', name: '', is_admin: '', is_manager: '', is_ldap_user: 'yes' };

    expect(importer.prepare(base)).toEqual({ username: 'john', is_ldap_user: 1, role: 'app-user' });
    expect(importer.prepare({ ...base, is_manager: '1' }).role).toBe('app-manager');
    expect(importer.prepare({ ...base, is_manager: '1', is_admin: 'true' }).role).toBe('app-admin');
    expect(importer.prepare({ ...base, name: 'John' })).toHaveProperty('name', 'John');
  });

  it('validates the rows', async () => {
    const importer = new UserImport(container);
    expect(await importer.validateCreation({ username: 'new', password: 'secret1', email: 'a@b.c', is_ldap_user: 0 })).toBe(true);
    expect(await importer.validateCreation({ username: 'admin', is_ldap_user: 0 })).toBe(false);
    expect(await importer.validateCreation({ username: 'new', password: '123', is_ldap_user: 0 })).toBe(false);
    expect(await importer.validateCreation({ username: 'new', email: 'nope', is_ldap_user: 0 })).toBe(false);
  });

  it('imports users from a CSV file and saves the notification types when enabled', async () => {
    await container.get('configModel').save({ notifications_enabled: '1' });
    container.get('memoryCache').flush();
    const file = path.join(dir, 'users.csv');
    writeFileSync(file, 'Username,Password,Email,Full Name,Administrator,Manager,Remote User\nAlice,secret123,alice@example.com,Alice A,1,,\nadmin,secret123,x@y.z,Dup,,,\nbob,12,,,,,\n');
    const importer = new UserImport(container);
    await importer.importFile(file);

    expect(importer.counter).toBe(1);
    expect(users[0]).toMatchObject({ username: 'alice', role: 'app-admin', name: 'Alice A', email: 'alice@example.com' });
    expect(selected).toEqual([[2, ['email', 'web']]]);
    expect(log.error).toHaveLength(2);
    expect(log.error[0]).toContain('validation error at line 2');
  });
});
