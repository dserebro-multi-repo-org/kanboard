import { describe, expect, it } from 'vitest';
import { colorModel, expectAll } from './helpers.js';
import { CategoryValidator } from '../../../src/validator/category-validator.js';
import { ColumnMoveRestrictionValidator } from '../../../src/validator/column-move-restriction-validator.js';
import { ColumnRestrictionValidator } from '../../../src/validator/column-restriction-validator.js';
import { ColumnValidator } from '../../../src/validator/column-validator.js';
import { PredefinedTaskDescriptionValidator } from '../../../src/validator/predefined-task-description-validator.js';
import { ProjectRoleValidator } from '../../../src/validator/project-role-validator.js';
import { SwimlaneValidator } from '../../../src/validator/swimlane-validator.js';

// Validators of the PHP code base without a dedicated PHP unit test.
describe('ColumnValidator', () => {
  const validator = new ColumnValidator();

  it('validates creation and modification', async () => {
    await expectAll((v) => validator.validateCreation(v), [
      [{ project_id: 1, title: 'A' }, true],
      [{ project_id: 1, title: 'A', task_limit: 0 }, true],
      [{ project_id: 1, title: 'A', task_limit: -1 }, false],
      [{ project_id: 1, title: 'A', task_limit: 'x' }, false],
      [{ project_id: 1 }, false],
      [{ title: 'A' }, false],
      [{ project_id: 1, title: 'a'.repeat(192) }, false],
    ]);
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, title: 'A' }, true],
      [{ title: 'A' }, false],
      [{ id: 'x', title: 'A' }, false],
    ]);
  });

  it('uses the PHP messages', async () => {
    expect(await validator.validateCreation({ project_id: 1, title: 'A', task_limit: -1 })).toEqual([
      false,
      { task_limit: ['This value must be greater than -1'] },
    ]);
  });
});

describe('ColumnRestrictionValidator / ColumnMoveRestrictionValidator', () => {
  it('requires integer ids', async () => {
    const restriction = new ColumnRestrictionValidator();
    await expectAll((v) => restriction.validateCreation(v), [
      [{ project_id: 1, role_id: 1, rule: 'block_task_creation', column_id: 1 }, true],
      [{ project_id: 1, role_id: 1, column_id: 1 }, false],
      [{ project_id: 1, role_id: 'x', rule: 'r', column_id: 1 }, false],
    ]);
    const move = new ColumnMoveRestrictionValidator();
    await expectAll((v) => move.validateCreation(v), [
      [{ project_id: 1, role_id: 1, src_column_id: 1, dst_column_id: 2 }, true],
      [{ project_id: 1, role_id: 1, src_column_id: 1 }, false],
      [{ project_id: 1, role_id: 1, src_column_id: 'a', dst_column_id: 2 }, false],
    ]);
    expect(await move.validateCreation({})).toEqual([
      false,
      {
        project_id: ['This field is required'],
        role_id: ['This field is required'],
        src_column_id: ['This field is required'],
        dst_column_id: ['This field is required'],
      },
    ]);
  });
});

describe('PredefinedTaskDescriptionValidator', () => {
  it('requires a title and a description', async () => {
    const validator = new PredefinedTaskDescriptionValidator();
    await expectAll((v) => validator.validate(v), [
      [{ title: 'a', description: 'b' }, true],
      [{ title: 'a' }, false],
      [{ description: 'b' }, false],
    ]);
  });
});

describe('ProjectRoleValidator', () => {
  it('validates creation and modification', async () => {
    const validator = new ProjectRoleValidator();
    await expectAll((v) => validator.validateCreation(v), [
      [{ role: 'r', project_id: 1 }, true],
      [{ role: 'r' }, false],
      [{ role: 'r'.repeat(101), project_id: 1 }, false],
      [{ role: 'r', project_id: 'x' }, false],
    ]);
    await expectAll((v) => validator.validateModification(v), [
      [{ role_id: 1, role: 'r', project_id: 1 }, true],
      [{ role: 'r', project_id: 1 }, false],
    ]);
  });
});

describe('SwimlaneValidator', () => {
  it('validates creation and modification', async () => {
    const validator = new SwimlaneValidator();
    await expectAll((v) => validator.validateCreation(v), [
      [{ project_id: 1, name: 'n' }, true],
      [{ name: 'n' }, false],
      [{ project_id: 1 }, false],
      [{ project_id: 1, name: 'n'.repeat(192) }, false],
    ]);
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, name: 'n' }, true],
      [{ name: 'n' }, false],
      [{ id: 'x', name: 'n' }, false],
    ]);
    expect(await validator.validateModification({ id: 'x', name: 'n' })).toEqual([false, { id: ['The id must be an integer'] }]);
  });
});

describe('CategoryValidator', () => {
  it('requires ids and names', async () => {
    const validator = new CategoryValidator({ colorModel });
    await expectAll((v) => validator.validateCreation(v), [
      [{ project_id: 1, name: 'n' }, true],
      [{ name: 'n' }, false],
      [{ project_id: 1 }, false],
      [{ project_id: 'x', name: 'n' }, false],
    ]);
    await expectAll((v) => validator.validateModification(v), [
      [{ id: 1, name: 'n' }, true],
      [{ name: 'n' }, false],
    ]);
  });
});
