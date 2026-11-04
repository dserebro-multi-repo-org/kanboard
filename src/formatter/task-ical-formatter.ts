import type { Container } from '../core/container/container.js';
import type { FilterQuery } from '../core/filter/filter-interface.js';
import { phpDate } from '../core/php-date.js';
import type { Row } from '../foundation/model.js';
import { t } from '../foundation/translator.js';
import { BaseFormatter } from './base-formatter.js';
import { Attendees, Calendar, Event, Organizer } from './ical.js';

/** iCal event formatter for tasks (port of `Kanboard\Formatter\TaskICalFormatter`). */
export class TaskICalFormatter extends BaseFormatter {
  protected vCalendar: Calendar | null = null;

  constructor(container: Container) {
    super(container);
  }

  /** Render the iCalendar document. */
  async format(): Promise<string> {
    return this.calendar.render();
  }

  /** Set the calendar to fill. */
  setCalendar(vCalendar: Calendar): this {
    this.vCalendar = vCalendar;
    return this;
  }

  protected get calendar(): Calendar {
    if (this.vCalendar === null) {
      throw new Error('TaskICalFormatter: no calendar defined, call setCalendar() first');
    }
    return this.vCalendar;
  }

  /** Events from tasks with a start and an end date (the end defaults to now). */
  async addTasksWithStartAndDueDate(query: FilterQuery, startColumn: string, endColumn: string): Promise<this> {
    for (const task of await this.findRows(query)) {
      const start = Number(task[startColumn]);
      const end = Number(task[endColumn]) || Math.floor(Date.now() / 1000);

      const vEvent = this.getTaskIcalEvent(task, `task-#${String(task['id'])}-${startColumn}-${endColumn}`);
      vEvent.setDtStart(start);
      vEvent.setDtEnd(end);

      this.calendar.addComponent(vEvent);
    }

    return this;
  }

  /** Events from tasks with only a due date (all day events when the time is midnight). */
  async addTasksWithDueDateOnly(query: FilterQuery): Promise<this> {
    for (const task of await this.findRows(query)) {
      const date = Number(task['date_due']);

      const vEvent = this.getTaskIcalEvent(task, `task-#${String(task['id'])}-date_due`);
      vEvent.setDtStart(date);
      vEvent.setDtEnd(date);

      if (phpDate('Hi', date) === '0000') {
        vEvent.setNoTime(true);
      }

      this.calendar.addComponent(vEvent);
    }

    return this;
  }

  /** Build the iCal event of a task. */
  protected getTaskIcalEvent(task: Row, uid: string): Event {
    const vEvent = new Event(uid);
    vEvent.setCreated(Number(task['date_creation']));
    vEvent.setModified(Number(task['date_modification']));
    vEvent.setUseTimezone(true);
    vEvent.setSummary(`${t('#%d', task['id'])} ${String(task['title'])}`);
    const description = String(task['description'] ?? '');
    vEvent.setDescription(description);
    vEvent.setDescriptionHTML(this.textHelper.markdown(description));
    vEvent.setUrl(
      this.urlHelper.base() + this.urlHelper.to('TaskViewController', 'show', { task_id: task['id'] }),
    );

    if (task['owner_id']) {
      const attendees = new Attendees();
      attendees.add(`MAILTO:${String(task['assignee_email'] || `${String(task['assignee_username'])}@kanboard.local`)}`, {
        CN: String(task['assignee_name'] || task['assignee_username']),
      });
      vEvent.setAttendees(attendees);
    }

    if (task['creator_id']) {
      // The PHP operator precedence (`'MAILTO:' . $email ?: ...`) makes the fallback unreachable: keep it.
      vEvent.setOrganizer(
        new Organizer(`MAILTO:${String(task['creator_email'] ?? '')}`, {
          CN: String(task['creator_name'] || task['creator_username']),
        }),
      );
    }

    return vEvent;
  }
}
