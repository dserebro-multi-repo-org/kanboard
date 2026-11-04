import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

export class CurrencyValidator extends BaseValidator {
  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('currency', t('Field required')),
      new Validators.Required('rate', t('Field required')),
      new Validators.Numeric('rate', t('This value must be numeric')),
    ]);
  }
}
