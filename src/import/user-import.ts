import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { Csv } from '../core/csv.js';
import {
  MAIL_NOTIFICATION_TYPE,
  WEB_NOTIFICATION_TYPE,
  type ModelHelperLike,
  type UserImportModelLike,
  type UserNotificationTypeModelLike,
} from '../foundation/export-import-collaborators.js';
import { TABLES } from '../foundation/model-constants.js';
import { t } from '../foundation/translator.js';
import { Role } from '../foundation/validator-collaborators.js';
import { Validator, Validators } from '../validator/simple-validator.js';
import { removeEmptyFields } from './php-cast.js';

type Row = Record<string, unknown>;

/** User CSV import (port of `app/Import/UserImport.php`). */
export class UserImport extends Base {
  /** Number of successfully imported users. */
  counter = 0;

  /** Get mapping between CSV and SQL columns. */
  getColumnMapping(): Record<string, string> {
    return {
      username: 'Username',
      password: 'Password',
      email: 'Email',
      name: 'Full Name',
      is_admin: 'Administrator',
      is_manager: 'Manager',
      is_ldap_user: 'Remote User',
    };
  }

  /** Import a single row. */
  async import(row: Row, lineNumber: number): Promise<void> {
    const logger = this.service('logger');
    const prepared = this.prepare(row);

    if (await this.validateCreation(prepared)) {
      const userId = await this.dep<UserImportModelLike>('userModel').create(prepared);

      if (userId !== false) {
        logger.debug(`UserImport: imported successfully line ${lineNumber}`);
        this.counter++;

        if (Number(await this.service('configModel').get('notifications_enabled', 0)) === 1) {
          await this.dep<UserNotificationTypeModelLike>('userNotificationTypeModel').saveSelectedTypes(userId, [
            MAIL_NOTIFICATION_TYPE,
            WEB_NOTIFICATION_TYPE,
          ]);
        }
      } else {
        logger.error(`UserImport: creation error at line ${lineNumber}`);
      }
    } else {
      logger.error(`UserImport: validation error at line ${lineNumber}`);
    }
  }

  /** Read a CSV file and import its users. */
  async importFile(filename: string, delimiter = ',', enclosure = '"'): Promise<this> {
    const csv = new Csv(delimiter, enclosure);
    csv.setColumnMapping(this.getColumnMapping());
    await csv.read(filename, (row, line) => this.import(row, line));
    return this;
  }

  /** Format row before validation. */
  prepare(input: Row): Row {
    const row: Row = { ...input };
    row.username = String(row.username ?? '').toLowerCase();

    for (const field of ['is_admin', 'is_manager', 'is_ldap_user']) {
      row[field] = Csv.getBooleanValue(row[field]);
    }

    if (row.is_admin === 1) {
      row.role = Role.APP_ADMIN;
    } else if (row.is_manager === 1) {
      row.role = Role.APP_MANAGER;
    } else {
      row.role = Role.APP_USER;
    }

    delete row.is_admin;
    delete row.is_manager;

    const helper = this.dep<{ has(name: string): boolean; get<H>(name: string): H }>('helper');
    if (helper.has('model')) {
      helper.get<ModelHelperLike>('model').removeEmptyFields(row, ['password', 'email', 'name']);
    } else {
      removeEmptyFields(row, ['password', 'email', 'name']);
    }

    return row;
  }

  /** Validate user creation. */
  async validateCreation(values: Row): Promise<boolean> {
    const validator = new Validator(values, [
      new Validators.MaxLength('username', t('The maximum length is %d characters', 255), 255),
      new Validators.Unique('username', t('The username must be unique'), this.service('db'), TABLES.USER, 'id'),
      new Validators.MinLength('password', t('The minimum length is %d characters', 6), 6),
      new Validators.Email('email', t('Email address invalid')),
      new Validators.Integer('is_ldap_user', t('This value must be an integer')),
    ]);

    return validator.execute();
  }

  protected dep<T>(name: string): T {
    return (this.container as unknown as Container<Record<string, unknown>>).get(name) as T;
  }
}
