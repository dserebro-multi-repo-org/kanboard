import type { Container } from '../../../src/core/container/container.js';
import type { Rec } from '../../../src/helper/batch-b-support.js';
import { Role } from '../../../src/helper/batch-b-support.js';
import { makeContainer, setService } from './fixture.js';

export interface FakeState {
  user: { id: number; role: string; [key: string]: unknown } | null;
  /** project id -> role of the current user in the project */
  projectRoles: Record<number, string>;
  columnRestrictions: Rec[];
  projectRestrictions: Rec[];
  sortableColumns: Rec[];
  metadata: Map<string, unknown>;
  subtaskInProgress: boolean;
  calls: { getUserRole: number };
}

/** Application / project access map used instead of the (not yet migrated) M5 access maps. */
const APP_RULES: Record<string, (action: string) => boolean> = {
  UserCreationController: (_a) => false,
  ProjectCreationController: (a) => a === 'createPrivate' || a === 'create',
};

function appAllowed(controller: string, action: string, role: string): boolean {
  if (role === Role.APP_ADMIN) return true;
  if (role === Role.APP_MANAGER) return controller !== 'UserCreationController';
  const rule = APP_RULES[controller];
  if (controller === 'ProjectCreationController') return action === 'createPrivate';
  return rule === undefined ? true : rule(action);
}

function projectAllowed(controller: string, action: string, role: string): boolean {
  if (role === Role.PROJECT_VIEWER) return action === 'show' && controller !== 'TaskCreationController';
  if (role === Role.PROJECT_MEMBER) return controller !== 'ProjectEditController';
  return role === Role.PROJECT_MANAGER;
}

/** Container with fake collaborators for the batch B helpers. */
export async function makeBatchBContainer(): Promise<{ container: Container; state: FakeState }> {
  const container = await makeContainer(true);
  const state: FakeState = {
    user: null,
    projectRoles: {},
    columnRestrictions: [],
    projectRestrictions: [],
    sortableColumns: [],
    metadata: new Map(),
    subtaskInProgress: false,
    calls: { getUserRole: 0 },
  };

  setService(container, 'userSession', {
    getId: () => state.user?.id ?? 0,
    isLogged: () => state.user !== null,
    isAdmin: () => state.user?.role === Role.APP_ADMIN,
    getRole: () => state.user?.role ?? '',
    getAll: () => state.user ?? {},
    getTheme: () => 'dark',
    hasSubtaskListActivated: () => true,
  });
  setService(container, 'applicationAuthorization', { isAllowed: appAllowed });
  setService(container, 'projectAuthorization', { isAllowed: projectAllowed });
  setService(container, 'projectUserRoleModel', {
    getUserRole: (projectId: number) => {
      state.calls.getUserRole++;
      return state.projectRoles[projectId] ?? '';
    },
    getActiveProjectsByUser: () => ({ 1: 'P1', 3: 'P3' }),
    getAssignableUsersList: () => ({ 0: 'Unassigned', 2: 'user' }),
  });
  setService(container, 'columnRestrictionCacheDecorator', { getAllByRole: () => state.columnRestrictions });
  setService(container, 'projectRoleRestrictionCacheDecorator', { getAllByRole: () => state.projectRestrictions });
  setService(container, 'columnMoveRestrictionCacheDecorator', { getSortableColumns: () => state.sortableColumns });
  setService(container, 'userMetadataCacheDecorator', {
    get: (key: string, defaultValue: unknown) => (state.metadata.has(key) ? state.metadata.get(key) : defaultValue),
    set: (key: string, value: unknown) => void state.metadata.set(key, value),
  });
  setService(container, 'session', { isTrue: () => state.subtaskInProgress });
  setService(container, 'token', { getReusableCSRFToken: () => 'csrf', getCSRFToken: () => 'csrf' });

  return { container, state };
}
