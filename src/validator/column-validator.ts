import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class ColumnValidator extends BaseValidator {
  private commonValidationRules() {
    return [
      new Validators.Integer('task_limit', t('This value must be an integer')),
      new Validators.GreaterThan('task_limit', t('This value must be greater than %d', -1), -1),
      new Validators.Required('title', t('The title is required')),
      new Validators.MaxLength('title', t('The maximum length is %d characters', 191), 191),
    ];
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('This value is required')),
      new Validators.Integer('id', t('This value must be an integer')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('project_id', t('The project id is required')),
      new Validators.Integer('project_id', t('This value must be an integer')),
      ...this.commonValidationRules(),
    ]);
  }
}
