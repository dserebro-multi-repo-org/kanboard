import type { Container } from '../core/container/container.js';
import type { UserProviderLike } from '../foundation/formatter-collaborators.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** User AutoComplete Formatter (port of `Kanboard\Formatter\UserAutoCompleteFormatter`). */
export class UserAutoCompleteFormatter extends BaseFormatter {
  protected users: UserProviderLike[] = [];

  constructor(container: Container) {
    super(container);
  }

  withUsers(users: UserProviderLike[]): this {
    this.users = users;
    return this;
  }

  async format(): Promise<Row[]> {
    return this.users.map((user) => ({
      id: user.getInternalId(),
      username: user.getUsername(),
      external_id: user.getExternalId(),
      external_id_column: user.getExternalIdColumn(),
      value: user.getName() === '' ? user.getUsername() : user.getName(),
      label: user.getName() === '' ? user.getUsername() : `${user.getName()} (${user.getUsername()})`,
    }));
  }
}
