import type { Container } from '../core/container/container.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** User Mention Formatter (port of `Kanboard\Formatter\UserMentionFormatter`). */
export class UserMentionFormatter extends BaseFormatter {
  protected users: Row[] = [];

  constructor(container: Container) {
    super(container);
  }

  withUsers(users: Row[]): this {
    this.users = users;
    return this;
  }

  async format(): Promise<Row[]> {
    const result: Row[] = [];

    for (const user of this.users) {
      let html = this.avatarHelper.small(
        user['id'] as number,
        user['username'] as string,
        user['name'] as string,
        user['email'] as string,
        user['avatar_path'] as string,
        'avatar-inline',
      );

      html += ` ${this.textHelper.e(user['username'])}`;

      if (user['name']) {
        html += ` <small aria-hidden="true">${this.textHelper.e(user['name'])}</small>`;
      }

      result.push({ value: user['username'], html });
    }

    return result;
  }
}
