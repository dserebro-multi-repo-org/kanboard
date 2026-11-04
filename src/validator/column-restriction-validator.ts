import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class ColumnRestrictionValidator extends BaseValidator {
  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('project_id', t('This field is required')),
      new Validators.Integer('project_id', t('This value must be an integer')),
      new Validators.Required('role_id', t('This field is required')),
      new Validators.Integer('role_id', t('This value must be an integer')),
      new Validators.Required('rule', t('This field is required')),
      new Validators.Required('column_id', t('This field is required')),
      new Validators.Integer('column_id', t('This value must be an integer')),
    ]);
  }
}
