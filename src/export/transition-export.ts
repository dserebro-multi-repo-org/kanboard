import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { getDateParser, type DateParser } from '../core/date-parser.js';
import { phpDate } from '../core/php-date.js';
import type { DbRow } from '../db/types.js';
import { e, type TransitionModelLike } from '../foundation/export-import-collaborators.js';
import type { ExportRow } from './subtask-export.js';

/** Transition export (port of `app/Export/TransitionExport.php`). */
export class TransitionExport extends Base {
  protected readonly dateParser: DateParser;

  constructor(container: Container) {
    super(container);
    this.dateParser = getDateParser(container);
  }

  /** Get project transitions as a CSV compatible array (first row: the columns). */
  async export(projectId: number, from: number | string, to: number | string): Promise<ExportRow[]> {
    const results: ExportRow[] = [this.getColumns()];
    const model = (this.container as unknown as Container<Record<string, unknown>>).get('transitionModel') as TransitionModelLike;
    const transitions = await model.getAllByProjectAndDate(projectId, from, to);

    for (const transition of transitions) {
      results.push(await this.format(transition));
    }

    return results;
  }

  /** Get column titles. */
  protected getColumns(): string[] {
    return [e('Id'), e('Task Title'), e('Source column'), e('Destination column'), e('Executer'), e('Date'), e('Time spent')];
  }

  /** Format the output of a transition. */
  protected async format(transition: DbRow): Promise<ExportRow> {
    return [
      Math.trunc(Number(transition.id)),
      transition.title as string,
      transition.src_column as string,
      transition.dst_column as string,
      (transition.name || transition.username) as string | null,
      phpDate(await this.dateParser.getUserDateTimeFormat(), Number(transition.date)),
      Math.round((Number(transition.time_spent) / 3600) * 100) / 100,
    ];
  }
}
