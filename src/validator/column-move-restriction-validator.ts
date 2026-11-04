import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class ColumnMoveRestrictionValidator extends BaseValidator {
  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('project_id', t('This field is required')),
      new Validators.Integer('project_id', t('This value must be an integer')),
      new Validators.Required('role_id', t('This field is required')),
      new Validators.Integer('role_id', t('This value must be an integer')),
      new Validators.Required('src_column_id', t('This field is required')),
      new Validators.Integer('src_column_id', t('This value must be an integer')),
      new Validators.Required('dst_column_id', t('This field is required')),
      new Validators.Integer('dst_column_id', t('This value must be an integer')),
    ]);
  }
}
