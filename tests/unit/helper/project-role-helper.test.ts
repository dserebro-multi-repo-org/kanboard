import { describe, expect, it } from 'vitest';
import { Role } from '../../../src/helper/batch-b-support.js';
import type { ProjectRoleHelper } from '../../../src/helper/project-role-helper.js';
import { makeBatchBContainer } from './batch-b-fixture.js';
import { helpers } from './fixture.js';

async function setup(role: string, userRole: string = Role.APP_USER) {
  const { container, state } = await makeBatchBContainer();
  state.user = { id: 2, role: userRole };
  state.projectRoles = { 1: role };
  return { h: helpers(container).get<ProjectRoleHelper>('projectRole'), state };
}

describe('ProjectRoleHelper', () => {
  it('canCreateTaskInColumn with a project viewer', async () => {
    expect(await (await setup(Role.PROJECT_VIEWER)).h.canCreateTaskInColumn(1, 1)).toBe(false);
  });

  it('canCreateTaskInColumn with a project member', async () => {
    expect(await (await setup(Role.PROJECT_MEMBER)).h.canCreateTaskInColumn(1, 1)).toBe(true);
  });

  it('canCreateTaskInColumn with a custom project role', async () => {
    expect(await (await setup('Custom Role')).h.canCreateTaskInColumn(1, 1)).toBe(true);
  });

  it('canCreateTaskInColumn with custom project role and restrictions', async () => {
    const { h, state } = await setup('Custom Role');
    state.projectRestrictions = [{ rule: 'task_creation' }];
    expect(await h.canCreateTaskInColumn(1, 1)).toBe(false);

    state.columnRestrictions = [{ column_id: 1, rule: 'allow.task_creation' }];
    expect(await h.canCreateTaskInColumn(1, 1)).toBe(true);
    expect(await h.canCreateTaskInColumn(1, 2)).toBe(false);

    state.columnRestrictions = [{ column_id: 1, rule: 'block.task_creation' }];
    state.projectRestrictions = [];
    expect(await h.canCreateTaskInColumn(1, 1)).toBe(false);
    expect(await h.canCreateTaskInColumn(1, 2)).toBe(true);
  });

  it('canRemoveTask', async () => {
    const { h, state } = await setup('Custom Role');
    expect(await h.canRemoveTask({ project_id: 1, creator_id: 2 })).toBe(true);
    expect(await h.canRemoveTask({ project_id: 1, creator_id: 3 })).toBe(false);
    expect(await h.canRemoveTask({ project_id: 1 })).toBe(false);
    state.projectRestrictions = [{ rule: 'task_remove' }];
    expect(await h.canRemoveTask({ project_id: 1, creator_id: 2 })).toBe(false);

    const manager = await setup(Role.PROJECT_MANAGER);
    expect(await manager.h.canRemoveTask({ project_id: 1, creator_id: 3 })).toBe(true);
    const admin = await setup(Role.PROJECT_MEMBER, Role.APP_ADMIN);
    expect(await admin.h.canRemoveTask({ project_id: 1, creator_id: 3 })).toBe(true);
  });

  it('canChangeAssignee', async () => {
    const { h, state } = await setup('Custom Role');
    expect(await h.canChangeAssignee({ project_id: 1 })).toBe(true);
    state.projectRestrictions = [{ rule: 'task_change_assignee' }];
    expect(await h.canChangeAssignee({ project_id: 1 })).toBe(false);
    const member = await setup(Role.PROJECT_MEMBER);
    member.state.projectRestrictions = [{ rule: 'task_change_assignee' }];
    expect(await member.h.canChangeAssignee({ project_id: 1 })).toBe(true);
  });

  it('canUpdateTask', async () => {
    const { h, state } = await setup('Custom Role');
    expect(await h.canUpdateTask({ project_id: 1, owner_id: 3 })).toBe(true);
    state.projectRestrictions = [{ rule: 'task_update_assigned' }];
    expect(await h.canUpdateTask({ project_id: 1, owner_id: 3 })).toBe(false);
    expect(await h.canUpdateTask({ project_id: 1, owner_id: 2 })).toBe(true);
  });

  it('canChangeTaskStatusInColumn', async () => {
    expect(await (await setup(Role.PROJECT_VIEWER)).h.canChangeTaskStatusInColumn(1, 1)).toBe(false);
    expect(await (await setup(Role.PROJECT_MEMBER)).h.canChangeTaskStatusInColumn(1, 1)).toBe(true);

    const { h, state } = await setup('Custom Role');
    expect(await h.canChangeTaskStatusInColumn(1, 1)).toBe(true);
    state.projectRestrictions = [{ rule: 'task_open_close' }];
    expect(await h.canChangeTaskStatusInColumn(1, 1)).toBe(false);
    state.columnRestrictions = [{ column_id: 1, rule: 'allow.task_open_close' }];
    expect(await h.canChangeTaskStatusInColumn(1, 1)).toBe(true);
    state.columnRestrictions = [{ column_id: 1, rule: 'block.task_open_close' }];
    state.projectRestrictions = [];
    expect(await h.canChangeTaskStatusInColumn(1, 1)).toBe(false);
  });

  it('isDraggable with members, closed tasks and column restrictions', async () => {
    const member = await setup(Role.PROJECT_MEMBER);
    expect(await member.h.isDraggable({ is_active: 1, project_id: 1, column_id: 1, owner_id: 0 })).toBe(true);
    expect(await member.h.isDraggable({ is_active: 0, project_id: 1, column_id: 1, owner_id: 0 })).toBe(false);

    const { h, state } = await setup('Custom Role');
    const task = { is_active: 1, project_id: 1, column_id: 2, owner_id: 7 };
    expect(await h.isDraggable(task)).toBe(true);
    state.projectRestrictions = [{ rule: 'task_move' }];
    expect(await h.isDraggable(task)).toBe(false);
    state.sortableColumns = [{ src_column_id: 2, dst_column_id: 3, only_assigned: 0 }];
    expect(await h.isDraggable(task)).toBe(true);
    state.sortableColumns = [{ src_column_id: 2, dst_column_id: 3, only_assigned: 1 }];
    expect(await h.isDraggable(task)).toBe(false);
    expect(await h.isDraggable({ ...task, owner_id: 2 })).toBe(true);
  });

  it('canMoveTask', async () => {
    const member = await setup(Role.PROJECT_MEMBER);
    expect(await member.h.canMoveTask(1, 1, 2)).toBe(true);

    const { h, state } = await setup('Custom Role');
    expect(await h.canMoveTask(1, 1, 1)).toBe(true);
    state.projectRestrictions = [{ rule: 'task_move' }];
    expect(await h.canMoveTask(1, 1, 2)).toBe(false);
    state.sortableColumns = [{ src_column_id: 1, dst_column_id: 2 }];
    expect(await h.canMoveTask(1, 1, 2)).toBe(true);
    expect(await h.canMoveTask(1, 2, 1)).toBe(true);
    expect(await h.canMoveTask(1, 1, 3)).toBe(false);
  });

  it('getProjectUserRole is memoized', async () => {
    const { h, state } = await setup(Role.PROJECT_MEMBER);
    expect(await h.getProjectUserRole(1)).toBe(Role.PROJECT_MEMBER);
    expect(await h.getProjectUserRole(1)).toBe(Role.PROJECT_MEMBER);
    expect(state.calls.getUserRole).toBe(1);
  });
});
