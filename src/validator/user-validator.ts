import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { Rule, ValidationResult, ValidatorDatabase, Values } from './simple-validator.js';
import type {
  AuthenticationManagerLike,
  LanguageModelLike,
  RoleLike,
  ThemeModelLike,
  ValidatorUserSession,
} from '../foundation/validator-collaborators.js';

/** Table of the users (PHP `UserModel::TABLE`). */
export const USER_TABLE = 'users';

export interface UserValidatorDeps {
  db: ValidatorDatabase;
  themeModel: ThemeModelLike;
  languageModel: LanguageModelLike;
  role: RoleLike;
  userSession: ValidatorUserSession;
  authenticationManager: AuthenticationManagerLike;
}

export class UserValidator extends BaseValidator {
  constructor(private readonly deps: UserValidatorDeps) {
    super();
  }

  protected async commonValidationRules(): Promise<Rule[]> {
    const { db, themeModel, languageModel, role } = this.deps;
    return [
      new Validators.MaxLength('username', t('The maximum length is %d characters', 191), 191),
      new Validators.Unique('username', t('This username is already taken'), db, USER_TABLE, 'id'),
      new Validators.Email('email', t('Email address invalid')),
      new Validators.Integer('is_ldap_user', t('This value must be an integer')),
      new Validators.InArray('theme', Object.keys(await themeModel.getThemes()), t('This theme is invalid')),
      new Validators.InArray('role', Object.keys(role.getApplicationRoles()), t('This role is invalid')),
      new Validators.Timezone('timezone', t('This timezone is invalid')),
      new Validators.InArray('language', Object.keys(await languageModel.getLanguages()), t('This language is invalid')),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    const rules: Rule[] = [new Validators.Required('username', t('The username is required')), ...(await this.commonValidationRules())];

    // PHP loose comparison: `$values['is_ldap_user'] == 1`
    const isLdapUser = values['is_ldap_user'] !== undefined && values['is_ldap_user'] !== null && Number(values['is_ldap_user']) === 1;

    return this.runRules(values, isLdapUser ? rules : [...rules, ...this.commonPasswordValidationRules()]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('The user id is required')),
      new Validators.Required('username', t('The username is required')),
      ...(await this.commonValidationRules()),
    ]);
  }

  async validateApiModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [new Validators.Required('id', t('The user id is required')), ...(await this.commonValidationRules())]);
  }

  async validatePasswordModification(values: Values): Promise<ValidationResult> {
    const v = new Validator(values, [
      new Validators.Required('id', t('The user id is required')),
      new Validators.Required('current_password', t('The current password is required')),
      ...this.commonPasswordValidationRules(),
    ]);

    if (await v.execute()) {
      const { userSession, authenticationManager } = this.deps;

      if (!userSession.isAdmin() && Number(values['id']) !== userSession.getId()) {
        return [false, { current_password: ['Invalid User ID'] }];
      }

      if (await authenticationManager.passwordAuthentication(userSession.getUsername(), String(values['current_password']), false)) {
        return [true, {}];
      }

      return [false, { current_password: [t('Wrong password')] }];
    }

    return [false, v.getErrors()];
  }
}
