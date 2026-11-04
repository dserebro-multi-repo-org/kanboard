import { BaseValidator } from './base-validator.js';
import type { LooseErrors } from './base-validator.js';
import { captchaPhraseMatches } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';
import type {
  AuthenticationManagerLike,
  CaptchaModelLike,
  LoggerLike,
  RequestLike,
  UserLockingModelLike,
  ValidatorSession,
} from '../foundation/validator-collaborators.js';

export interface AuthValidatorDeps {
  userLockingModel: UserLockingModelLike;
  captchaModel: CaptchaModelLike;
  authenticationManager: AuthenticationManagerLike;
  request: RequestLike;
  logger: LoggerLike;
  session: ValidatorSession;
  /** `BRUTEFORCE_LOCKDOWN_DURATION` constant (minutes), 15 by default. */
  bruteforceLockdownDuration?: number;
}

export class AuthValidator extends BaseValidator {
  constructor(private readonly deps: AuthValidatorDeps) {
    super();
  }

  /** Validate the login form: fields, locking, captcha and credentials, in this order. */
  validateForm(values: Values): Promise<ValidationResult<LooseErrors>> {
    return this.executeValidators(['validateFields', 'validateLocking', 'validateCaptcha', 'validateCredentials'], values);
  }

  protected async validateFields(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('username', t('The username is required')),
      new Validators.MaxLength('username', t('The maximum length is %d characters', 191), 191),
      new Validators.Required('password', t('The password is required')),
    ]);
  }

  protected async validateLocking(values: Values): Promise<ValidationResult<LooseErrors>> {
    let result = true;
    const errors: LooseErrors = {};

    if (await this.deps.userLockingModel.isLocked(String(values['username']))) {
      result = false;
      errors['login'] = t('Your account is locked for %d minutes', this.deps.bruteforceLockdownDuration ?? 15);
      this.deps.logger.error('Account locked: ' + String(values['username']));
    }

    return [result, errors];
  }

  protected async validateCredentials(values: Values): Promise<ValidationResult<LooseErrors>> {
    let result = true;
    const errors: LooseErrors = {};

    if (!(await this.deps.authenticationManager.passwordAuthentication(String(values['username']), String(values['password'])))) {
      result = false;
      errors['login'] = t('Bad username or password');
    }

    return [result, errors];
  }

  protected async validateCaptcha(values: Values): Promise<ValidationResult<LooseErrors>> {
    let result = true;
    const errors: LooseErrors = {};

    if (
      (await this.deps.userLockingModel.hasCaptcha(String(values['username']))) ||
      (await this.deps.captchaModel.isLocked(this.deps.request.getIpAddress()))
    ) {
      if (!this.deps.session.exists('captcha')) {
        result = false;
      } else {
        result = captchaPhraseMatches(this.deps.session.get('captcha'), values['captcha'] ?? '');

        if (!result) {
          errors['login'] = t('Bad username or password');
        }
      }
    }

    return [result, errors];
  }
}
