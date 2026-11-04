import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class PredefinedTaskDescriptionValidator extends BaseValidator {
  async validate(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('title', t('This value is required')),
      new Validators.Required('description', t('This value is required')),
    ]);
  }
}
