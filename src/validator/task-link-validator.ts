import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { Rule, ValidationResult, ValidatorDatabase, Values } from './simple-validator.js';

/** Table of the tasks (PHP `TaskModel::TABLE`). */
export const TASK_TABLE = 'tasks';

export interface TaskLinkValidatorDeps {
  db: ValidatorDatabase;
}

export class TaskLinkValidator extends BaseValidator {
  constructor(private readonly deps: TaskLinkValidatorDeps) {
    super();
  }

  private commonValidationRules(): Rule[] {
    return [
      new Validators.Required('task_id', t('Field required')),
      new Validators.Required('opposite_task_id', t('Field required')),
      new Validators.Required('link_id', t('Field required')),
      new Validators.NotEquals('opposite_task_id', 'task_id', t('A task cannot be linked to itself')),
      new Validators.Exists('opposite_task_id', t("This linked task id doesn't exists"), this.deps.db, TASK_TABLE, 'id'),
    ];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, this.commonValidationRules());
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [new Validators.Required('id', t('Field required')), ...this.commonValidationRules()]);
  }
}
