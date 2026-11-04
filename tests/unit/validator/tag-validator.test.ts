import { describe, expect, it } from 'vitest';
import { colorModel } from './helpers.js';
import { TagValidator } from '../../../src/validator/tag-validator.js';

describe('TagValidator (uniqueness through TagModel::exists)', () => {
  it('reports a duplicate name as the only error on creation and modification', async () => {
    const calls: unknown[][] = [];
    const tagModel = {
      exists: (...args: unknown[]) => {
        calls.push(args);
        return args[1] === 'dup';
      },
    };
    const validator = new TagValidator({ colorModel, tagModel });

    expect(await validator.validateCreation({ project_id: 1, name: 'dup' })).toEqual([false, { name: ['The name must be unique'] }]);
    expect(await validator.validateCreation({ project_id: 1, name: 'new' })).toEqual([true, {}]);
    expect(await validator.validateModification({ id: 3, project_id: 1, name: 'dup' })).toEqual([false, { name: ['The name must be unique'] }]);
    expect(calls).toContainEqual([1, 'dup', 3]);
  });

  it('does not query the model when the rules already fail', async () => {
    const exists = { count: 0 };
    const validator = new TagValidator({ colorModel, tagModel: { exists: () => (exists.count++, false) } });
    const [valid, errors] = await validator.validateCreation({ project_id: 1 });
    expect(valid).toBe(false);
    expect(errors).toEqual({ name: ['Field required'] });
    expect(exists.count).toBe(0);
  });
});
