import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';
import type {
  ColorModelLike,
  DateParserLike,
  EmailClientLike,
  LanguageModelLike,
} from '../foundation/validator-collaborators.js';

export interface ConfigValidatorDeps {
  languageModel: LanguageModelLike;
  dateParser: DateParserLike;
  emailClient: EmailClientLike;
  colorModel: ColorModelLike;
}

export class ConfigValidator extends BaseValidator {
  constructor(private readonly deps: ConfigValidatorDeps) {
    super();
  }

  /** Validate settings modification. */
  async validate(values: Values): Promise<ValidationResult> {
    const { languageModel, dateParser, emailClient, colorModel } = this.deps;

    return this.runRules(values, [
      new Validators.URL('application_url', t('This URL is invalid')),
      new Validators.InArray('application_language', Object.keys(await languageModel.getLanguages()), t('This language is invalid')),
      new Validators.Timezone('application_timezone', t('This timezone is invalid')),
      new Validators.InArray('application_date_format', dateParser.getDateFormats(true), t('Date format invalid')),
      new Validators.InArray('application_time_format', dateParser.getTimeFormats(), t('Time format invalid')),
      new Validators.Email('mail_sender_address', t('Email address invalid')),
      new Validators.InArray('mail_transport', Object.keys(emailClient.getAvailableTransports()), t('Invalid Mail transport')),
      new Validators.InArray('default_color', Object.keys(await colorModel.getList()), t('Color invalid')),
      new Validators.Integer('board_highlight_period', t('This value must be an integer')),
      new Validators.Integer('board_public_refresh_interval', t('This value must be an integer')),
      new Validators.Integer('board_private_refresh_interval', t('This value must be an integer')),
      new Validators.GreaterThanOrEqual('board_highlight_period', t('This value must be greater or equal to %d', 0), 0),
      new Validators.GreaterThanOrEqual('board_public_refresh_interval', t('This value must be greater or equal to %d', 0), 0),
      new Validators.GreaterThanOrEqual('board_private_refresh_interval', t('This value must be greater or equal to %d', 0), 0),
    ]);
  }
}
