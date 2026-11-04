import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class ExternalLinkValidator extends BaseValidator {
  private commonValidationRules() {
    return [
      new Validators.Required('url', t('Field required')),
      new Validators.MaxLength('url', t('The maximum length is %d characters', 65535), 65535),
      new Validators.URL('url', t('This URL is invalid')),
      new Validators.Required('title', t('Field required')),
      new Validators.MaxLength('title', t('The maximum length is %d characters', 65535), 65535),
      new Validators.Required('link_type', t('Field required')),
      new Validators.MaxLength('link_type', t('The maximum length is %d characters', 100), 100),
      new Validators.Required('dependency', t('Field required')),
      new Validators.MaxLength('dependency', t('The maximum length is %d characters', 100), 100),
      new Validators.Integer('id', t('This value must be an integer')),
      new Validators.Required('task_id', t('Field required')),
      new Validators.Integer('task_id', t('This value must be an integer')),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, this.commonValidationRules());
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('The id is required')),
      ...this.commonValidationRules(),
    ]);
  }
}
