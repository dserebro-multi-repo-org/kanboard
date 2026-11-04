import { TaskLinkEvents, TaskEvents, SubtaskEvents } from '../../event/events.js';

/**
 * Registry of the events that can trigger automatic actions (port of
 * `app/Core/Event/EventManager.php`). Descriptions are plain English; translation is done at
 * display time by the i18n layer.
 */
export class EventManager {
  private readonly events = new Map<string, string>();

  /** Register a custom event (plugins). */
  register(event: string, description: string): this {
    this.events.set(event, description);
    return this;
  }

  /** All built-in and custom events as `event name -> description`, sorted by description. */
  getAll(): Record<string, string> {
    const events: Array<[string, string]> = [
      [TaskLinkEvents.CREATE_UPDATE, 'Task link creation or modification'],
      [TaskEvents.MOVE_COLUMN, 'Move a task to another column'],
      [TaskEvents.UPDATE, 'Task modification'],
      [TaskEvents.CREATE, 'Task creation'],
      [TaskEvents.OPEN, 'Reopen a task'],
      [TaskEvents.CLOSE, 'Closing a task'],
      [TaskEvents.CREATE_UPDATE, 'Task creation or modification'],
      [TaskEvents.ASSIGNEE_CHANGE, 'Task assignee change'],
      [TaskEvents.DAILY_CRONJOB, 'Daily background job for tasks'],
      [TaskEvents.MOVE_SWIMLANE, 'Move a task to another swimlane'],
      [SubtaskEvents.CREATE_UPDATE, 'Subtask creation or modification'],
      ...this.events.entries(),
    ];

    const merged = new Map<string, string>(events);
    return Object.fromEntries([...merged.entries()].sort((a, b) => a[1].localeCompare(b[1])));
  }
}
