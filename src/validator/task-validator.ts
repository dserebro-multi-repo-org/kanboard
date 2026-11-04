import { BaseValidator, isEmpty } from './base-validator.js';
import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { Rule, ValidationResult, Values } from './simple-validator.js';
import type { ColorModelLike, DateParserLike } from '../foundation/validator-collaborators.js';

export interface TaskValidatorDeps {
  colorModel: ColorModelLike;
  dateParser: DateParserLike;
}

export class TaskValidator extends BaseValidator {
  constructor(private readonly deps: TaskValidatorDeps) {
    super();
  }

  private async commonValidationRules(): Promise<Rule[]> {
    const integer = (field: string): Rule => new Validators.Integer(field, t('This value must be an integer'));
    const formats = this.deps.dateParser.getParserFormats();

    return [
      integer('id'),
      integer('project_id'),
      integer('column_id'),
      integer('owner_id'),
      integer('creator_id'),
      integer('score'),
      new Validators.Range('score', t('This value must be in the range %d to %d', -2147483647, 2147483647), -2147483647, 2147483647),
      integer('category_id'),
      integer('swimlane_id'),
      new Validators.GreaterThan('swimlane_id', t('This value must be greater than %d', 0), 0),
      integer('recurrence_child'),
      integer('recurrence_parent'),
      integer('recurrence_factor'),
      integer('recurrence_timeframe'),
      integer('recurrence_basedate'),
      integer('recurrence_trigger'),
      integer('recurrence_status'),
      integer('priority'),
      new Validators.InArray('color_id', ['', ...Object.keys(await this.deps.colorModel.getList())], t('Color invalid')),
      new Validators.MaxLength('title', t('The maximum length is %d characters', 65535), 65535),
      new Validators.MaxLength('reference', t('The maximum length is %d characters', 191), 191),
      new Validators.Date('date_due', t('Invalid date'), formats),
      new Validators.Date('date_started', t('Invalid date'), formats),
      new Validators.Numeric('time_spent', t('This value must be numeric')),
      new Validators.Numeric('time_estimated', t('This value must be numeric')),
    ];
  }

  /** Validate that the start date is not after the due date. */
  async validateStartAndDueDate(values: Values): Promise<ValidationResult> {
    if (!isEmpty(values['date_started']) && !isEmpty(values['date_due'])) {
      const startDate = this.deps.dateParser.getTimestamp(values['date_started']);
      const endDate = this.deps.dateParser.getTimestamp(values['date_due']);

      if (startDate > endDate) {
        return [false, { date_started: [t('The start date is greater than the end date')] }];
      }
    }

    return [true, {}];
  }

  /** Run the rules, then the start/due date check when they all pass. */
  private async runWithDates(values: Values, rules: Rule[]): Promise<ValidationResult> {
    const v = new Validator(values, [...rules, ...(await this.commonValidationRules())]);
    let result = await v.execute();
    let errors = v.getErrors();

    if (result) {
      [result, errors] = await this.validateStartAndDueDate(values);
    }

    return [result, errors];
  }

  async validateCreation(values: Values): Promise<ValidationResult> {
    return this.runWithDates(values, [
      new Validators.Required('project_id', t('The project is required')),
      new Validators.Required('title', t('The title is required')),
    ]);
  }

  async validateBulkCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('tasks', t('Field required')),
      new Validators.Required('column_id', t('Field required')),
      new Validators.Required('swimlane_id', t('Field required')),
      new Validators.Integer('category_id', t('This value must be an integer')),
      new Validators.Integer('swimlane_id', t('This value must be an integer')),
      ...(await this.commonValidationRules()),
    ]);
  }

  async validateEditRecurrence(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [new Validators.Required('id', t('The id is required')), ...(await this.commonValidationRules())]);
  }

  async validateModification(values: Values): Promise<ValidationResult> {
    return this.runWithDates(values, [
      new Validators.Required('id', t('The id is required')),
      new Validators.Required('title', t('The title is required')),
    ]);
  }

  async validateApiModification(values: Values): Promise<ValidationResult> {
    return this.runWithDates(values, [new Validators.Required('id', t('The id is required'))]);
  }

  async validateProjectModification(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('id', t('The id is required')),
      new Validators.Required('project_id', t('The project is required')),
      ...(await this.commonValidationRules()),
    ]);
  }

  async validateEmailCreation(values: Values): Promise<ValidationResult> {
    return this.runRules(values, [
      new Validators.Required('subject', t('This field is required')),
      new Validators.Required('emails', t('This field is required')),
    ]);
  }
}
