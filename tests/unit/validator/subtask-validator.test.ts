import { describe, expect, it } from 'vitest';
import { SubtaskValidator } from '../../../src/validator/subtask-validator.js';

/** Project 1 holds task 1; user 2 is a member, 3 an outsider, 4 a viewer. */
function createValidator(): SubtaskValidator {
  return new SubtaskValidator({
    taskFinderModel: { getProjectId: (taskId) => (taskId === 1 ? 1 : 0) },
    projectPermissionModel: {
      isUserAllowed: () => true,
      isAssignable: (projectId, userId) => projectId === 1 && userId === 2,
    },
  });
}

describe('SubtaskValidator', () => {
  it('validates the creation', async () => {
    const validator = createValidator();
    const values: Record<string, unknown> = { task_id: 1, title: 'test' };
    expect((await validator.validateCreation(values))[0]).toBe(true);
    delete values['title'];
    expect((await validator.validateCreation(values))[0]).toBe(false);
  });

  it('validates the creation with an assignee', async () => {
    const validator = createValidator();
    expect((await validator.validateCreation({ task_id: 1, title: 'test', user_id: 2 }))[0]).toBe(true);
    expect((await validator.validateCreation({ task_id: 1, title: 'test', user_id: 0 }))[0]).toBe(true);

    const [valid, errors] = await validator.validateCreation({ task_id: 1, title: 'test', user_id: 3 });
    expect(valid).toBe(false);
    expect(errors).toEqual({ user_id: ['This user is not allowed to be assigned to this task'] });
    expect((await validator.validateCreation({ task_id: 1, title: 'test', user_id: 4 }))[0]).toBe(false);
    expect((await validator.validateCreation({ task_id: 1, title: 'test', user_id: 42 }))[0]).toBe(false);
    // The task must exist to know the list of allowed users
    expect((await validator.validateCreation({ task_id: 42, title: 'test', user_id: 2 }))[0]).toBe(false);
  });

  it('validates the modification with an assignee', async () => {
    const validator = createValidator();
    expect((await validator.validateModification({ id: 1, task_id: 1, title: 'test', user_id: 2 }))[0]).toBe(true);
    expect((await validator.validateModification({ id: 1, task_id: 1, title: 'test', user_id: 3 }))[0]).toBe(false);
  });

  it('validates the API modification with an assignee', async () => {
    const validator = createValidator();
    expect((await validator.validateApiModification({ id: 1, task_id: 1, user_id: 2 }))[0]).toBe(true);
    expect((await validator.validateApiModification({ id: 1, task_id: 1 }))[0]).toBe(true);
    expect((await validator.validateApiModification({ id: 1, task_id: 1, user_id: 3 }))[0]).toBe(false);
  });

  it('does not check the assignee when the field rules fail', async () => {
    const validator = createValidator();
    const [valid, errors] = await validator.validateCreation({ task_id: 1, title: 'x', user_id: 'abc' });
    expect(valid).toBe(false);
    expect(errors).toEqual({ user_id: ['The user id must be an integer'] });
  });
});
