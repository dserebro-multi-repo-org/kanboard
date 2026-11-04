import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { Rule, ValidationResult, Values } from './simple-validator.js';
import { Role } from '../foundation/validator-collaborators.js';

export class CommentValidator extends BaseValidator {
  async validateEmailCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('task_id', t('This value is required')),
      new Validators.Required('user_id', t('This value is required')),
      new Validators.Required('subject', t('This field is required')),
      new Validators.Required('emails', t('This field is required')),
      new Validators.Required('visibility', t('Visibility is required')),
      new Validators.InArray('visibility', [Role.APP_USER, Role.APP_MANAGER, Role.APP_ADMIN], t('The visibility should be an app role')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('task_id', t('This value is required')),
      new Validators.Required('visibility', t('Visibility is required')),
      new Validators.InArray('visibility', [Role.APP_USER, Role.APP_MANAGER, Role.APP_ADMIN], t('The visibility should be an app role')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [new Validators.Required('id', t('This value is required')), ...this.commonValidationRules()]);
  }

  private commonValidationRules(): Rule[] {
    return [
      new Validators.Integer('id', t('This value must be an integer')),
      new Validators.Integer('task_id', t('This value must be an integer')),
      new Validators.Integer('user_id', t('This value must be an integer')),
      new Validators.MaxLength('reference', t('The maximum length is %d characters', 191), 191),
      new Validators.Required('comment', t('Comment is required')),
    ];
  }
}
