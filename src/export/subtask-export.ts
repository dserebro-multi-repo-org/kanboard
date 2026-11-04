import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { getDateParser, type DateParser } from '../core/date-parser.js';
import { toEnd, toStart } from './date-range.js';
import type { DbRow } from '../db/types.js';
import { TABLES } from '../foundation/model-constants.js';
import { e, type SubtaskModelLike } from '../foundation/export-import-collaborators.js';
import { t } from '../foundation/translator.js';

export type ExportRow = Array<string | number | null>;

/** Subtask export (port of `app/Export/SubtaskExport.php`). */
export class SubtaskExport extends Base {
  private subtaskStatus: Record<string | number, string> = {};
  protected readonly dateParser: DateParser;

  constructor(container: Container) {
    super(container);
    this.dateParser = getDateParser(container);
  }

  /** Get the list of subtasks for a given project (first row: the columns). */
  async export(projectId: number, from: number | string, to: number | string): Promise<ExportRow[]> {
    this.subtaskStatus = await this.dep<SubtaskModelLike>('subtaskModel').getStatusList();
    const subtasks = await this.getSubtasks(projectId, from, to);
    const results: ExportRow[] = [this.getColumns()];

    for (const subtask of subtasks) {
      results.push(this.format(subtask));
    }

    return results;
  }

  /** Get column titles. */
  getColumns(): string[] {
    return [
      e('Subtask Id'),
      e('Title'),
      e('Status'),
      e('Assignee'),
      e('Time estimated'),
      e('Time spent'),
      e('Task Id'),
      e('Task Title'),
    ];
  }

  /** Format the output of a subtask. */
  format(subtask: DbRow): ExportRow {
    return [
      subtask.id as number,
      subtask.title as string,
      t(this.subtaskStatus[subtask.status as number] ?? ''),
      (subtask.assignee_name || subtask.assignee_username) as string | null,
      subtask.time_estimated as number,
      subtask.time_spent as number,
      subtask.task_id as number,
      subtask.task_title as string,
    ];
  }

  /** Get all subtasks for a given project. */
  async getSubtasks(projectId: number, from: number | string, to: number | string): Promise<DbRow[]> {
    const start = await toStart(this.dateParser, from);
    const end = await toEnd(this.dateParser, to);

    return this.service('db')
      .table(TABLES.SUBTASK)
      .eq('project_id', projectId)
      .columns(
        `${TABLES.SUBTASK}.*`,
        `${TABLES.USER}.username AS assignee_username`,
        `${TABLES.USER}.name AS assignee_name`,
        `${TABLES.TASK}.title AS task_title`,
      )
      .gte('date_creation', start)
      .lte('date_creation', end)
      .join(TABLES.TASK, 'id', 'task_id')
      .join(TABLES.USER, 'id', 'user_id')
      .asc(`${TABLES.SUBTASK}.id`)
      .findAll();
  }

  protected dep<T>(name: string): T {
    return (this.container as unknown as Container<Record<string, unknown>>).get(name) as T;
  }
}
