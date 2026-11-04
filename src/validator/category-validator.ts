import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { Rule, ValidationResult, Values } from './simple-validator.js';
import type { ColorModelLike } from '../foundation/validator-collaborators.js';

export interface CategoryValidatorDeps {
  colorModel: ColorModelLike;
}

export class CategoryValidator extends BaseValidator {
  constructor(private readonly deps: CategoryValidatorDeps) {
    super();
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('project_id', t('The project id is required')),
      new Validators.Required('name', t('The name is required')),
      ...(await this.commonValidationRules()),
    ]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('The id is required')),
      new Validators.Required('name', t('The name is required')),
      ...(await this.commonValidationRules()),
    ]);
  }

  private async commonValidationRules(): Promise<Rule[]> {
    return [
      new Validators.Integer('id', t('The id must be an integer')),
      new Validators.Integer('project_id', t('The project id must be an integer')),
      new Validators.MaxLength('name', t('The maximum length is %d characters', 191), 191),
      new Validators.InArray('color_id', ['', ...Object.keys(await this.deps.colorModel.getList())], t('Color invalid')),
    ];
  }
}
