import { describe, expect, it } from 'vitest';
import { colorModel, dateParser, expectAll } from './helpers.js';
import { ConfigValidator } from '../../../src/validator/config-validator.js';

const validator = new ConfigValidator({
  languageModel: { getLanguages: () => ({ en_US: 'English', fr_FR: 'Français' }) },
  dateParser,
  emailClient: { getAvailableTransports: () => ({ smtp: 'SMTP', sendmail: 'Sendmail', mail: 'Mail' }) },
  colorModel,
});

describe('ConfigValidator', () => {
  it('validates the settings', async () => {
    await expectAll((v) => validator.validate(v), [
      [{ application_url: '' }, true],
      [{ application_url: 'http://localhost' }, true],
      [{ application_url: 'invalid' }, false],
      [{ application_timezone: 'Europe/Paris' }, true],
      [{ application_timezone: 'UTC' }, true],
      [{ application_timezone: '' }, true],
      [{ application_timezone: 'unknown' }, false],
      [{ application_date_format: '' }, true],
      [{ application_date_format: 'd/m/Y' }, true],
      [{ application_date_format: 'invalid' }, false],
      [{ application_time_format: '' }, true],
      [{ application_time_format: 'H:i' }, true],
      [{ application_time_format: 'invalid' }, false],
      [{ mail_sender_address: '' }, true],
      [{ mail_sender_address: 'test@localhost' }, true],
      [{ mail_sender_address: 'invalid' }, false],
      [{ mail_transport: '' }, true],
      [{ mail_transport: 'invalid' }, false],
      [{ default_color: '' }, true],
      [{ default_color: 'blue' }, true],
      [{ default_color: 'invalid' }, false],
      [{ application_language: 'fr_FR' }, true],
      [{ application_language: 'xx_XX' }, false],
      [{ board_highlight_period: '' }, true],
      [{ board_highlight_period: '10' }, true],
      [{ board_highlight_period: -1 }, false],
      [{ board_public_refresh_interval: '' }, true],
      [{ board_public_refresh_interval: '0' }, true],
      [{ board_public_refresh_interval: -1 }, false],
      [{ board_private_refresh_interval: '' }, true],
      [{ board_private_refresh_interval: '0' }, true],
      [{ board_private_refresh_interval: -1 }, false],
    ]);
  });

  it('reports the PHP messages', async () => {
    const [valid, errors] = await validator.validate({ application_url: 'invalid', board_highlight_period: -1, mail_transport: 'x' });
    expect(valid).toBe(false);
    expect(errors).toEqual({
      application_url: ['This URL is invalid'],
      mail_transport: ['Invalid Mail transport'],
      board_highlight_period: ['This value must be greater or equal to 0'],
    });
  });
});
