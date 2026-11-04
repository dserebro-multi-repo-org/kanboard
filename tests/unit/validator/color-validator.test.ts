import { describe, expect, it } from 'vitest';
import { colorModel, valid } from './helpers.js';
import { CategoryValidator } from '../../../src/validator/category-validator.js';
import { TagValidator } from '../../../src/validator/tag-validator.js';
import { TaskValidator } from '../../../src/validator/task-validator.js';
import { dateParser } from './helpers.js';

const BAD = 'blue"><style>';

describe('ColorValidator (color_id must be registered)', () => {
  it('task color must be registered', async () => {
    const validator = new TaskValidator({ colorModel, dateParser });
    expect(valid(await validator.validateCreation({ project_id: 1, title: 'Task', color_id: 'blue' }))).toBe(true);
    expect(valid(await validator.validateCreation({ project_id: 1, title: 'Task', color_id: BAD }))).toBe(false);
    expect(valid(await validator.validateModification({ id: 1, title: 'Task', color_id: BAD }))).toBe(false);
    expect(valid(await validator.validateApiModification({ id: 1, color_id: BAD }))).toBe(false);
  });

  it('tag color must be registered', async () => {
    const validator = new TagValidator({ colorModel, tagModel: { exists: () => false } });
    expect(valid(await validator.validateCreation({ project_id: 1, name: 'Tag', color_id: '' }))).toBe(true);
    expect(valid(await validator.validateCreation({ project_id: 1, name: 'Tag', color_id: 'blue' }))).toBe(true);
    expect(valid(await validator.validateCreation({ project_id: 1, name: 'Tag', color_id: BAD }))).toBe(false);
    expect(valid(await validator.validateModification({ id: 1, project_id: 1, name: 'Tag', color_id: BAD }))).toBe(false);
  });

  it('category color must be registered', async () => {
    const validator = new CategoryValidator({ colorModel });
    expect(valid(await validator.validateCreation({ project_id: 1, name: 'Category', color_id: '' }))).toBe(true);
    expect(valid(await validator.validateCreation({ project_id: 1, name: 'Category', color_id: 'blue' }))).toBe(true);
    expect(valid(await validator.validateCreation({ project_id: 1, name: 'Category', color_id: BAD }))).toBe(false);
    expect(valid(await validator.validateModification({ id: 1, project_id: 1, name: 'Category', color_id: BAD }))).toBe(false);
  });
});
