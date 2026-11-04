import type { Container } from '../core/container/container.js';
import { ROLE } from '../foundation/formatter-collaborators.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Activity Stream Formatter (port of `Kanboard\Formatter\ProjectActivityEventFormatter`). */
export class ProjectActivityEventFormatter extends BaseFormatter {
  constructor(container: Container) {
    super(container);
  }

  /** Apply the formatter: decode the event payload, hide restricted comments and render the content. */
  async format(): Promise<Row[]> {
    const events = await this.findRows();
    const session = this.collaborator('userSession');
    const result: Row[] = [];

    for (const event of events) {
      const eventData = this.unserializeEvent(String(event['data'] ?? ''));

      if (Object.keys(eventData).length === 0) {
        continue;
      }

      // PHP array union (`+=`): keys of the row win over the keys of the payload.
      for (const [key, value] of Object.entries(eventData)) {
        if (!(key in event)) {
          event[key] = value;
        }
      }
      delete event['data'];

      const comment = event['comment'] as Row | undefined | null;
      if (comment !== undefined && comment !== null) {
        if (session.getRole() === ROLE.APP_USER && comment['visibility'] !== ROLE.APP_USER) {
          continue;
        }

        if (session.getRole() === ROLE.APP_MANAGER && comment['visibility'] === ROLE.APP_ADMIN) {
          continue;
        }
      }

      event['author'] = event['author_name'] || event['author_username'];
      event['event_title'] = this.collaborator('notificationModel').getTitleWithAuthor(
        event['author'] as string,
        event['event_name'] as string,
        event,
      );
      event['event_content'] = this.renderEvent(event);
      result.push(event);
    }

    return result;
  }

  /** Decode the JSON payload; legacy events serialized with PHP are ignored (potential security issues). */
  protected unserializeEvent(data: string): Row {
    if (data.startsWith('a')) {
      return {};
    }

    try {
      const decoded: unknown = JSON.parse(data);
      return typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded) ? (decoded as Row) : {};
    } catch {
      return {};
    }
  }

  protected renderEvent(params: Row): string {
    return this.collaborator('template').render(`event/${String(params['event_name']).replaceAll('.', '_')}`, params);
  }
}
