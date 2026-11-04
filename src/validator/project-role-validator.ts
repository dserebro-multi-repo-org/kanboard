import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class ProjectRoleValidator extends BaseValidator {
  private commonValidationRules() {
    return [
      new Validators.Required('role', t('This field is required')),
      new Validators.MaxLength('role', t('The maximum length is %d characters', 100), 100),
      new Validators.Required('project_id', t('This field is required')),
      new Validators.Integer('project_id', t('This value must be an integer')),
      new Validators.Integer('role_id', t('This value must be an integer')),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, this.commonValidationRules());
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('role_id', t('The id is required')),
      ...this.commonValidationRules(),
    ]);
  }
}
