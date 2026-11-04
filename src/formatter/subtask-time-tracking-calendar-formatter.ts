import type { Container } from '../core/container/container.js';
import { phpDate } from '../core/php-date.js';
import type { Row } from '../foundation/model.js';
import { t } from '../foundation/translator.js';
import { BaseFormatter } from './base-formatter.js';

/** Calendar event formatter for subtask time tracking (port of `Kanboard\Formatter\SubtaskTimeTrackingCalendarFormatter`). */
export class SubtaskTimeTrackingCalendarFormatter extends BaseFormatter {
  constructor(container: Container) {
    super(container);
  }

  async format(): Promise<Row[]> {
    const events: Row[] = [];
    const colorModel = this.collaborator('colorModel');

    for (const row of await this.findRows()) {
      const user = row['username'] !== undefined && row['username'] !== null
        ? ` (${String(row['user_fullname'] || row['username'])})`
        : '';

      events.push({
        id: row['id'],
        subtask_id: row['subtask_id'],
        title: `${t('#%d', row['task_id'])} ${String(row['subtask_title'])}${user}`,
        start: phpDate('Y-m-d\\TH:i:s', Number(row['start'])),
        end: phpDate('Y-m-d\\TH:i:s', Number(row['end']) || Math.floor(Date.now() / 1000)),
        backgroundColor: colorModel.getBackgroundColor(row['color_id'] as string),
        borderColor: colorModel.getBorderColor(row['color_id'] as string),
        textColor: 'black',
        url: this.urlHelper.to('TaskViewController', 'show', { task_id: row['task_id'] }),
        editable: false,
      });
    }

    return events;
  }
}
