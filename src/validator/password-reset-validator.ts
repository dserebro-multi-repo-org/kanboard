import { BaseValidator, captchaPhraseMatches } from './base-validator.js';
import type { LooseErrors } from './base-validator.js';
import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';
import type { ValidatorSession } from '../foundation/validator-collaborators.js';

export interface PasswordResetValidatorDeps {
  session: ValidatorSession;
}

export class PasswordResetValidator extends BaseValidator {
  constructor(private readonly deps: PasswordResetValidatorDeps) {
    super();
  }

  /** Validate the creation of a password reset request (fields, then captcha). */
  validateCreation(values: Values): Promise<ValidationResult<LooseErrors>> {
    return this.executeValidators(['validateFields', 'validateCaptcha'], values);
  }

  /** Validate the new password. */
  async validateModification(values: Values): Promise<ValidationResult> {
    const v = new Validator(values, this.commonPasswordValidationRules());
    return [await v.execute(), v.getErrors()];
  }

  protected async validateFields(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('captcha', t('This value is required')),
      new Validators.Required('username', t('The username is required')),
      new Validators.MaxLength('username', t('The maximum length is %d characters', 191), 191),
    ]);
  }

  protected async validateCaptcha(values: Values): Promise<ValidationResult> {
    const errors: Record<string, string[]> = {};
    let result: boolean;

    if (!this.deps.session.exists('captcha')) {
      result = false;
    } else {
      result = captchaPhraseMatches(this.deps.session.get('captcha'), values['captcha'] ?? '');

      if (!result) {
        errors['captcha'] = [t('Invalid captcha')];
      }

      // Invalidate captcha to avoid reuse.
      this.deps.session.remove('captcha');
    }

    return [result, errors];
  }
}
