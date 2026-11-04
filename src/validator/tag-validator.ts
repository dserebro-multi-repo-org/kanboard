import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { Rule, ValidationResult, Values } from './simple-validator.js';
import type { ColorModelLike, TagModelLike } from '../foundation/validator-collaborators.js';

export interface TagValidatorDeps {
  tagModel: TagModelLike;
  colorModel: ColorModelLike;
}

export class TagValidator extends BaseValidator {
  constructor(private readonly deps: TagValidatorDeps) {
    super();
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    const v = new Validator(values, await this.commonValidationRules());
    let result = await v.execute();
    let errors = v.getErrors();

    if (result && (await this.deps.tagModel.exists(Number(values['project_id']), String(values['name'])))) {
      result = false;
      errors = { name: [t('The name must be unique')] };
    }

    return [result, errors];
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    const v = new Validator(values, [new Validators.Required('id', t('Field required')), ...(await this.commonValidationRules())]);
    let result = await v.execute();
    let errors = v.getErrors();

    if (result && (await this.deps.tagModel.exists(Number(values['project_id']), String(values['name']), Number(values['id'])))) {
      result = false;
      errors = { name: [t('The name must be unique')] };
    }

    return [result, errors];
  }

  protected async commonValidationRules(): Promise<Rule[]> {
    return [
      new Validators.Required('project_id', t('Field required')),
      new Validators.Required('name', t('Field required')),
      new Validators.MaxLength('name', t('The maximum length is %d characters', 191), 191),
      new Validators.InArray('color_id', ['', ...Object.keys(await this.deps.colorModel.getList())], t('Color invalid')),
    ];
  }
}
