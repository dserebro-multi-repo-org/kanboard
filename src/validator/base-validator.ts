import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { Rule, ValidationResult, Values } from './simple-validator.js';

/** Result of the multi-step validators, whose errors may be plain strings (PHP `$errors['login']`). */
export type LooseErrors = Record<string, string | string[]>;

/** PHP `empty()`: null, false, 0, '0', '' and empty arrays are empty. */
export function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    value === 0 ||
    value === '' ||
    value === '0' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Compare a captcha phrase the way `Gregwar\Captcha\PhraseBuilder::niceize` does. */
export function captchaPhraseMatches(expected: unknown, given: unknown): boolean {
  const niceize = (value: unknown): string => String(value).toLowerCase().replace(/[01]/g, (c) => (c === '0' ? 'o' : 'l'));
  return niceize(given) === niceize(expected);
}

/**
 * Base Validator (port of `Kanboard\Validator\BaseValidator`). Collaborators are injected through
 * the concrete validators' constructors instead of the PHP service container.
 */
export abstract class BaseValidator {
  /**
   * Execute multiple validators in sequence, stopping at the first failure.
   *
   * @param validators names of the validator methods to run
   * @param values form values
   * @returns `[success, errors]`
   */
  async executeValidators(validators: readonly string[], values: Values): Promise<ValidationResult<LooseErrors>> {
    let result = false;
    let errors: LooseErrors = {};

    for (const method of validators) {
      const handler = (this as unknown as Record<string, (v: Values) => Promise<ValidationResult<LooseErrors>>>)[method];
      [result, errors] = await handler.call(this, values);

      if (!result) {
        break;
      }
    }

    return [result, errors];
  }

  /** Run a list of rules: `[$v->execute(), $v->getErrors()]` in the PHP validators. */
  protected async runRules(values: Values, rules: readonly Rule[]): Promise<ValidationResult> {
    const v = new Validator(values, rules);
    return [await v.execute(), v.getErrors()];
  }

  /** Common password validation rules. */
  protected commonPasswordValidationRules(): Rule[] {
    return [
      new Validators.Required('password', t('The password is required')),
      new Validators.MinLength('password', t('The minimum length is %d characters', 6), 6),
      new Validators.Required('confirmation', t('The confirmation is required')),
      new Validators.Equals('password', 'confirmation', t("Passwords don't match")),
    ];
  }
}
