import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { Rule, ValidationResult, ValidatorDatabase, Values } from './simple-validator.js';

/** Table of the groups (PHP `GroupModel::TABLE`). */
export const GROUP_TABLE = 'groups';

export interface GroupValidatorDeps {
  db: ValidatorDatabase;
}

export class GroupValidator extends BaseValidator {
  constructor(private readonly deps: GroupValidatorDeps) {
    super();
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, this.commonValidationRules());
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [new Validators.Required('id', t('The id is required')), ...this.commonValidationRules()]);
  }

  private commonValidationRules(): Rule[] {
    return [
      new Validators.Required('name', t('The name is required')),
      new Validators.MaxLength('name', t('The maximum length is %d characters', 191), 191),
      new Validators.Unique('name', t('The name must be unique'), this.deps.db, GROUP_TABLE, 'id'),
      new Validators.MaxLength('external_id', t('The maximum length is %d characters', 255), 255),
      new Validators.Integer('id', t('This value must be an integer')),
    ];
  }
}
