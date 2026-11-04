import { describe, expect, it } from 'vitest';
import { ActionValidator } from '../../../src/validator/action-validator.js';
import type { ActionValidatorDeps } from '../../../src/validator/action-validator.js';

/**
 * Same fixture as the PHP test: projects 1-3, columns 1-4 in project 1 and 5-8 in project 2,
 * swimlane/category/user lists per project, the user is member of projects 1 and 2 only.
 */
function setup(options: { logged?: boolean; admin?: boolean } = {}) {
  const { logged = true, admin = false } = options;
  const columns: Record<number, Record<number, string>> = { 1: { 1: 'Backlog', 2: 'Ready', 3: 'WIP', 4: 'Done' }, 2: { 5: 'Backlog', 6: 'Ready' }, 3: {} };
  const swimlanes: Record<number, Record<number, string>> = { 1: { 1: 'Default' }, 2: { 2: 'Default' }, 3: { 3: 'Default' } };
  const categories: Record<number, Record<number, string>> = { 1: { 0: 'No category', 1: 'Category A' }, 2: { 0: 'No category', 2: 'Category B' }, 3: { 0: 'No category' } };
  const users: Record<number, Record<number, string>> = { 1: { 0: 'Unassigned', 1: 'admin' }, 2: { 0: 'Unassigned', 1: 'admin', 2: 'user1' }, 3: { 0: 'Unassigned', 3: 'user2' } };
  const memberOf = [1, 2];
  const deps: ActionValidatorDeps = {
    columnModel: { getList: (id) => columns[id] ?? {} },
    swimlaneModel: { getList: (id) => swimlanes[id] ?? {} },
    categoryModel: { getList: (id) => categories[id] ?? {} },
    projectUserRoleModel: { getAssignableUsersList: (id) => users[id] ?? {} },
    projectPermissionModel: { isUserAllowed: (projectId) => admin || memberOf.includes(projectId), isAssignable: () => true },
    userSession: { isLogged: () => logged, isAdmin: () => admin, getId: () => 1, getUsername: () => 'user1' },
  };
  return new ActionValidator(deps);
}

describe('ActionValidator', () => {
  it('validates the creation', async () => {
    const validator = setup();
    const values: Record<string, unknown> = {
      project_id: 1,
      event_name: 'task.create',
      action_name: '\\Kanboard\\Action\\TaskCloseColumn',
      params: { column_id: 1 },
    };
    expect((await validator.validateCreation(values))[0]).toBe(true);
    delete values['params'];
    expect(await validator.validateCreation(values)).toEqual([false, { params: ['This value is required'] }]);
  });

  it('validates parameters against the resources of the project', async () => {
    const v = setup();
    expect(await v.validateParameters(1, 1, { column_id: 1 })).toBe(true);
    expect(await v.validateParameters(1, 1, { src_column_id: 1, dest_column_id: 2 })).toBe(true);
    expect(await v.validateParameters(1, 1, { swimlane_id: 1 })).toBe(true);
    expect(await v.validateParameters(1, 1, { category_id: 1 })).toBe(true);
    expect(await v.validateParameters(1, 1, { user_id: 1 })).toBe(true);

    // Resources of another project
    expect(await v.validateParameters(1, 1, { column_id: 5 })).toBe(false);
    expect(await v.validateParameters(1, 1, { src_column_id: 1, dest_column_id: 6 })).toBe(false);
    expect(await v.validateParameters(1, 1, { dest_swimlane_id: 2 })).toBe(false);
    expect(await v.validateParameters(1, 1, { category_id: 2 })).toBe(false);
    expect(await v.validateParameters(1, 1, { user_id: 2 })).toBe(false);

    // Values that do not exist at all
    expect(await v.validateParameters(1, 1, { column_id: 0 })).toBe(false);
    expect(await v.validateParameters(1, 1, { swimlane_id: 'foobar' })).toBe(false);

    // "No category" and "Unassigned" are valid choices
    expect(await v.validateParameters(1, 1, { category_id: 0 })).toBe(true);
    expect(await v.validateParameters(1, 1, { user_id: 0 })).toBe(true);

    // Parameters that are not project resources
    expect(await v.validateParameters(1, 1, { color_id: 'red', duration: 2, subject: 'test' })).toBe(true);
  });

  it('rejects malformed values', async () => {
    const v = setup();
    expect(await v.validateParameters(1, 1, { column_id: [] })).toBe(false);
    expect(await v.validateParameters(1, 1, { column_id: [1] })).toBe(false);
    expect(await v.validateParameters(1, 1, { project_id: [1] })).toBe(false);
    expect(await v.validateParameters(1, 1, { subject: ['test'] })).toBe(false);
    expect(await v.validateParameters(1, 1, { column_id: {} })).toBe(false);

    expect(await v.validateParameters(1, 1, { column_id: '1' })).toBe(true);
    expect(await v.validateParameters(1, 1, { column_id: 1.9 })).toBe(false);
    expect(await v.validateParameters(1, 1, { column_id: true })).toBe(false);
    expect(await v.validateParameters(1, 1, { column_id: null })).toBe(false);
    expect(await v.validateParameters(1, 1, { column_id: '01' })).toBe(false);
    expect(await v.validateParameters(1, 1, { column_id: '' })).toBe(false);
  });

  it('checks the access to the destination project', async () => {
    const v = setup();
    expect(await v.validateParameters(1, 1, { column_id: 1, project_id: 2 })).toBe(true);
    expect(await v.validateParameters(1, 1, { column_id: 1, project_id: 3 })).toBe(false);
    expect(await v.validateParameters(1, 1, { dst_project_id: 3 })).toBe(false);
    expect(await v.validateParameters(1, 1, { project_id: 42 })).toBe(false);

    // Application administrators can use any project
    expect(await setup({ admin: true }).validateParameters(1, 1, { project_id: 3 })).toBe(true);
  });

  it('does not check project access without user session but still checks the resources', async () => {
    const v = setup({ logged: false });
    expect(await v.validateParameters(1, 0, { project_id: 3 })).toBe(true);
    expect(await v.validateParameters(1, 0, { column_id: 5 })).toBe(false);
  });
});
