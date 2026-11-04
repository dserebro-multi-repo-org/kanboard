import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, ValidatorDatabase, Values } from './simple-validator.js';

/** Table of the link types (PHP `LinkModel::TABLE`). */
export const LINK_TABLE = 'links';

export interface LinkValidatorDeps {
  db: ValidatorDatabase;
}

export class LinkValidator extends BaseValidator {
  constructor(private readonly deps: LinkValidatorDeps) {
    super();
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('label', t('Field required')),
      new Validators.Unique('label', t('This label must be unique'), this.deps.db, LINK_TABLE),
      new Validators.NotEquals('label', 'opposite_label', t('The labels must be different')),
    ]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('Field required')),
      new Validators.Required('opposite_id', t('Field required')),
      new Validators.Required('label', t('Field required')),
      new Validators.Unique('label', t('This label must be unique'), this.deps.db, LINK_TABLE),
    ]);
  }
}
