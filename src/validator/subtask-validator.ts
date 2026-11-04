import { BaseValidator, isEmpty } from './base-validator.js';
import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { Rule, ValidationResult, Values } from './simple-validator.js';
import type { ProjectPermissionModelLike, TaskFinderModelLike } from '../foundation/validator-collaborators.js';

export interface SubtaskValidatorDeps {
  taskFinderModel: TaskFinderModelLike;
  projectPermissionModel: ProjectPermissionModelLike;
}

export class SubtaskValidator extends BaseValidator {
  constructor(private readonly deps: SubtaskValidatorDeps) {
    super();
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.executeRules(values, [
      new Validators.Required('task_id', t('The task id is required')),
      new Validators.Required('title', t('The title is required')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.executeRules(values, [
      new Validators.Required('id', t('The subtask id is required')),
      new Validators.Required('task_id', t('The task id is required')),
      new Validators.Required('title', t('The title is required')),
      ...this.commonValidationRules(),
    ]);
  }

  async validateApiModification(values: Values): Promise<ValidationResult> {
    return this.executeRules(values, [
      new Validators.Required('id', t('The subtask id is required')),
      new Validators.Required('task_id', t('The task id is required')),
      ...this.commonValidationRules(),
    ]);
  }

  private commonValidationRules(): Rule[] {
    return [
      new Validators.Integer('id', t('The subtask id must be an integer')),
      new Validators.Integer('task_id', t('The task id must be an integer')),
      new Validators.MaxLength('title', t('The maximum length is %d characters', 65535), 65535),
      new Validators.Integer('user_id', t('The user id must be an integer')),
      new Validators.Integer('status', t('The status must be an integer')),
      new Validators.Numeric('time_estimated', t('The time must be a numeric value')),
      new Validators.Numeric('time_spent', t('The time must be a numeric value')),
    ];
  }

  private async executeRules(values: Values, rules: Rule[]): Promise<ValidationResult> {
    const v = new Validator(values, rules);
    let result = await v.execute();

    // The values are checked only when they have the expected type
    if (result && !(await this.isValidAssignee(values))) {
      v.addError('user_id', t('This user is not allowed to be assigned to this task'));
      result = false;
    }

    return [result, v.getErrors()];
  }

  private async isValidAssignee(values: Values): Promise<boolean> {
    if (isEmpty(values['user_id'])) {
      return true;
    }

    if (isEmpty(values['task_id'])) {
      return false;
    }

    const projectId = await this.deps.taskFinderModel.getProjectId(Number(values['task_id']));

    return projectId > 0 && (await this.deps.projectPermissionModel.isAssignable(projectId, Number(values['user_id'])));
  }
}
