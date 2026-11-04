import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class SwimlaneValidator extends BaseValidator {
  private commonValidationRules() {
    return [
      new Validators.Integer('id', t('The id must be an integer')),
      new Validators.Integer('project_id', t('The project id must be an integer')),
      new Validators.MaxLength('name', t('The maximum length is %d characters', 191), 191),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('project_id', t('The project id is required')),
      new Validators.Required('name', t('The name is required')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('The id is required')),
      new Validators.Required('name', t('The name is required')),
      ...this.commonValidationRules(),
    ]);
  }
}
