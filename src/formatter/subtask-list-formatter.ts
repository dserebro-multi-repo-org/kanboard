import type { Container } from '../core/container/container.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Subtask List Formatter (port of `Kanboard\Formatter\SubtaskListFormatter`). */
export class SubtaskListFormatter extends BaseFormatter {
  constructor(container: Container) {
    super(container);
  }

  async format(): Promise<Row[]> {
    const status = this.collaborator('subtaskModel').getStatusList();
    const subtasks = await this.findRows();

    for (const subtask of subtasks) {
      subtask['status_name'] = status[subtask['status'] as number];
      subtask['timer_start_date'] = subtask['timer_start_date'] ?? 0;
      subtask['is_timer_started'] = Boolean(subtask['timer_start_date']);
    }

    return subtasks;
  }
}
