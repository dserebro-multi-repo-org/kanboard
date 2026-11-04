import { describe, expect, it } from 'vitest';
import { Role } from '../../../src/helper/batch-b-support.js';
import type { UserHelper } from '../../../src/helper/user-helper.js';
import { makeBatchBContainer } from './batch-b-fixture.js';
import { helpers } from './fixture.js';

async function setup(): Promise<{ h: UserHelper; state: Awaited<ReturnType<typeof makeBatchBContainer>>['state']; container: Awaited<ReturnType<typeof makeBatchBContainer>>['container'] }> {
  const { container, state } = await makeBatchBContainer();
  return { h: helpers(container).get<UserHelper>('user'), state, container };
}

describe('UserHelper', () => {
  it('getFullname', async () => {
    const { h } = await setup();
    expect(h.getFullname({ username: 'user1', name: '' })).toBe('user1');
    expect(h.getFullname({ username: 'user2', name: 'User #2' })).toBe('User #2');
  });

  it('getFullname falls back on the session user', async () => {
    const { h, state } = await setup();
    state.user = { id: 2, role: Role.APP_USER, username: 'jdoe', name: '' };
    expect(h.getFullname()).toBe('jdoe');
  });

  it('initials', async () => {
    const { h } = await setup();
    expect(h.getInitials('chuck norris')).toBe('CN');
    expect(h.getInitials('chuck norris #2')).toBe('CN');
    expect(h.getInitials('admin')).toBe('A');
    expect(h.getInitials('Ü 君が代')).toBe('Ü君');
  });

  it('getRoleName', async () => {
    const { h, state } = await setup();
    expect(h.getRoleName(Role.APP_ADMIN)).toBe('Administrator');
    expect(h.getRoleName(Role.APP_MANAGER)).toBe('Manager');
    expect(h.getRoleName(Role.PROJECT_VIEWER)).toBe('Project Viewer');
    expect(h.getRoleName('whatever')).toBe('Unknown');
    state.user = { id: 1, role: Role.APP_USER };
    expect(h.getRoleName()).toBe('User');
  });

  it('simple session accessors', async () => {
    const { h, state } = await setup();
    state.user = { id: 7, role: Role.APP_MANAGER };
    expect(h.getId()).toBe(7);
    expect(h.getRole()).toBe(Role.APP_MANAGER);
    expect(h.isAdmin()).toBe(false);
    expect(h.isCurrentUser(7)).toBe(true);
    expect(h.isCurrentUser('7')).toBe(true);
    expect(h.isCurrentUser(8)).toBe(false);
    expect(h.getTheme()).toBe('dark');
    expect(h.hasSubtaskListActivated()).toBe(true);
  });

  it('hasAccess without session', async () => {
    const { h } = await setup();
    expect(h.hasAccess('UserCreationController', 'create')).toBe(false);
  });

  it('hasAccess for admins, managers and users', async () => {
    const { h, state } = await setup();
    state.user = { id: 2, role: Role.APP_ADMIN };
    expect(h.hasAccess('UserCreationController', 'create')).toBe(true);
    expect(h.hasAccess('ProjectCreationController', 'create')).toBe(true);
    expect(h.hasAccess('ProjectCreationController', 'createPrivate')).toBe(true);

    const manager = await setup();
    manager.state.user = { id: 2, role: Role.APP_MANAGER };
    expect(manager.h.hasAccess('UserCreationController', 'show')).toBe(false);
    expect(manager.h.hasAccess('ProjectCreationController', 'create')).toBe(true);

    const user = await setup();
    user.state.user = { id: 2, role: Role.APP_USER };
    expect(user.h.hasAccess('UserCreationController', 'show')).toBe(false);
    expect(user.h.hasAccess('ProjectCreationController', 'create')).toBe(false);
    expect(user.h.hasAccess('ProjectCreationController', 'createPrivate')).toBe(true);
  });

  it('caches the application access result in the memory cache', async () => {
    const { h, state, container } = await setup();
    state.user = { id: 2, role: Role.APP_ADMIN };
    expect(h.hasAccess('A', 'b')).toBe(true);
    expect(container.get('memoryCache').get('app_access:Ab')).toBe(true);
    state.user = { id: 2, role: Role.APP_USER };
    expect(h.hasAccess('A', 'b')).toBe(true);
  });

  it('hasProjectAccess without session', async () => {
    const { h } = await setup();
    expect(await h.hasProjectAccess('ProjectEditController', 'edit', 1)).toBe(false);
  });

  it('hasProjectAccess for admins', async () => {
    const { h, state } = await setup();
    state.user = { id: 2, role: Role.APP_ADMIN };
    expect(await h.hasProjectAccess('ProjectEditController', 'edit', 1)).toBe(true);
    expect(await h.hasProjectAccess('BoardViewController', 'show', 1)).toBe(true);
  });

  it('hasProjectAccess for users without project role', async () => {
    const { h, state } = await setup();
    state.user = { id: 2, role: Role.APP_USER };
    expect(await h.hasProjectAccess('ProjectEditController', 'edit', 1)).toBe(false);
    expect(await h.hasProjectAccess('BoardViewController', 'show', 1)).toBe(false);
  });

  it('hasProjectAccess for project manager, member, viewer', async () => {
    const { h, state } = await setup();
    state.user = { id: 2, role: Role.APP_USER };
    state.projectRoles = { 1: Role.PROJECT_MANAGER, 2: Role.PROJECT_MEMBER, 3: Role.PROJECT_VIEWER };
    expect(await h.hasProjectAccess('ProjectEditController', 'edit', 1)).toBe(true);
    expect(await h.hasProjectAccess('ProjectEditController', 'edit', 2)).toBe(false);
    expect(await h.hasProjectAccess('BoardViewController', 'show', 2)).toBe(true);
    expect(await h.hasProjectAccess('BoardViewController', 'show', 3)).toBe(true);
    expect(await h.hasProjectAccess('TaskCreationController', 'save', 3)).toBe(false);
  });

  it('hasProjectAccess for a custom project role acts like a project member', async () => {
    const { h, state } = await setup();
    state.user = { id: 2, role: Role.APP_USER };
    state.projectRoles = { 1: 'Custom Role' };
    expect(await h.hasProjectAccess('ProjectEditController', 'edit', 1)).toBe(false);
    expect(await h.hasProjectAccess('BoardViewController', 'show', 1)).toBe(true);
    expect(await h.hasProjectAccess('TaskCreationController', 'save', 1)).toBe(true);
    expect(await h.hasProjectAccess('BoardViewController', 'show', 2)).toBe(false);
  });

  it('hasNotifications uses the logged user id', async () => {
    const { h, container, state } = await setup();
    const seen: number[] = [];
    (container as unknown as { set(k: string, v: unknown): void }).set('userUnreadNotificationModel', {
      hasNotifications: (id: number) => {
        seen.push(id);
        return Promise.resolve(id === 2);
      },
    });
    state.user = { id: 2, role: Role.APP_USER };
    expect(await h.hasNotifications()).toBe(true);
    expect(seen).toEqual([2]);
  });

  it('getUsersGroupNames limits the list', async () => {
    const { h, container } = await setup();
    const groups = Array.from({ length: 9 }, (_v, i) => ({ name: `G${i}` }));
    (container as unknown as { set(k: string, v: unknown): void }).set('groupMemberModel', { getGroups: () => Promise.resolve(groups) });
    const result = await h.getUsersGroupNames(2);
    expect(result.total).toBe(9);
    expect(result.shown).toBe(7);
    expect(result.has_groups).toBe(true);
    expect(result.limited_list).toEqual(groups.slice(0, 7).map((g) => g.name));
    expect(result.full_list).toHaveLength(9);

    const none = await setup();
    expect(await none.h.getUsersGroupNames(2)).toEqual({ full_list: [], limited_list: [], has_groups: false, total: 0, shown: 0 });
  });
});
