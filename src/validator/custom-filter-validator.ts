import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class CustomFilterValidator extends BaseValidator {
  private commonValidationRules() {
    return [
      new Validators.Required('project_id', t('Field required')),
      new Validators.Required('user_id', t('Field required')),
      new Validators.Required('name', t('Field required')),
      new Validators.Required('filter', t('Field required')),
      new Validators.Integer('user_id', t('This value must be an integer')),
      new Validators.Integer('project_id', t('This value must be an integer')),
      new Validators.MaxLength('name', t('The maximum length is %d characters', 65535), 65535),
      new Validators.MaxLength('filter', t('The maximum length is %d characters', 65535), 65535),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, this.commonValidationRules());
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('Field required')),
      new Validators.Integer('id', t('This value must be an integer')),
      ...this.commonValidationRules(),
    ]);
  }
}
