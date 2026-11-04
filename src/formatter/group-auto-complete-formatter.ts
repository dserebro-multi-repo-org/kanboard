import type { Container } from '../core/container/container.js';
import type { GroupProviderLike } from '../foundation/formatter-collaborators.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Group AutoComplete Formatter (port of `Kanboard\Formatter\GroupAutoCompleteFormatter`). */
export class GroupAutoCompleteFormatter extends BaseFormatter {
  protected groups: GroupProviderLike[] = [];

  constructor(container: Container) {
    super(container);
  }

  withGroups(groups: GroupProviderLike[]): this {
    this.groups = groups;
    return this;
  }

  async format(): Promise<Row[]> {
    return this.groups.map((group) => ({
      id: group.getInternalId(),
      external_id: group.getExternalId(),
      value: group.getName(),
      label: group.getName(),
    }));
  }
}
