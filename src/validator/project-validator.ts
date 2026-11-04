import { BaseValidator, isEmpty } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { Rule, ValidationResult, ValidatorDatabase, Values } from './simple-validator.js';

/** Table of the projects (PHP `ProjectModel::TABLE`). */
export const PROJECT_TABLE = 'projects';

export interface ProjectValidatorDeps {
  db: ValidatorDatabase;
}

export class ProjectValidator extends BaseValidator {
  constructor(private readonly deps: ProjectValidatorDeps) {
    super();
  }

  private commonValidationRules(): Rule[] {
    const { db } = this.deps;
    return [
      new Validators.Integer('id', t('This value must be an integer')),
      new Validators.Integer('priority_default', t('This value must be an integer')),
      new Validators.Integer('priority_start', t('This value must be an integer')),
      new Validators.Integer('priority_end', t('This value must be an integer')),
      new Validators.Integer('is_active', t('This value must be an integer')),
      new Validators.MaxLength('name', t('The maximum length is %d characters', 65535), 65535),
      new Validators.MaxLength('identifier', t('The maximum length is %d characters', 50), 50),
      new Validators.MaxLength('start_date', t('The maximum length is %d characters', 10), 10),
      new Validators.MaxLength('end_date', t('The maximum length is %d characters', 10), 10),
      new Validators.AlphaNumeric('identifier', t('This value must be alphanumeric')),
      new Validators.Unique('identifier', t('The identifier must be unique'), db, PROJECT_TABLE),
      new Validators.Email('email', t('Email address invalid')),
      new Validators.Unique('email', t('The project email must be unique across all projects'), db, PROJECT_TABLE),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(upperCaseIdentifier(values), [
      new Validators.Required('name', t('The project name is required')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(upperCaseIdentifier(values), [
      new Validators.NotEmpty('name', t('This field cannot be empty')),
      new Validators.Required('id', t('This value is required')),
      ...this.commonValidationRules(),
    ]);
  }
}

/** PHP: `if (! empty($values['identifier'])) $values['identifier'] = strtoupper(...)`. */
function upperCaseIdentifier(values: Values): Values {
  const identifier = values['identifier'];
  return isEmpty(identifier) ? values : { ...values, identifier: String(identifier).toUpperCase() };
}
