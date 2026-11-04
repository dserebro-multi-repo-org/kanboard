import { Event } from '../core/event/event.js';

/** Event payload values. */
export type EventValues = Record<string, unknown>;

/**
 * Port of `app/Event/GenericEvent.php`: an event carrying an associative array of values.
 * Supports array-like access through `get`/`set`/`has`/`delete`.
 */
export class GenericEvent<V extends EventValues = EventValues> extends Event {
  protected values: V;

  constructor(values: V = {} as V) {
    super();
    this.values = values;
  }

  /** Task id from `task.id` or `task_id`, null when absent. */
  getTaskId(): number | null {
    const task = this.values['task'];
    if (isRecord(task) && task['id'] !== undefined && task['id'] !== null) {
      return task['id'] as number;
    }
    const taskId = this.values['task_id'];
    return taskId !== undefined && taskId !== null ? (taskId as number) : null;
  }

  /** Project id from `task.project_id`, null when absent. */
  getProjectId(): number | null {
    const task = this.values['task'];
    if (isRecord(task) && task['project_id'] !== undefined && task['project_id'] !== null) {
      return task['project_id'] as number;
    }
    return null;
  }

  getAll(): V {
    return this.values;
  }

  get<T = unknown>(key: string): T | null {
    const value = this.values[key];
    return value === undefined ? null : (value as T);
  }

  set(key: string, value: unknown): void {
    (this.values as EventValues)[key] = value;
  }

  has(key: string): boolean {
    return this.values[key] !== undefined && this.values[key] !== null;
  }

  delete(key: string): void {
    delete (this.values as EventValues)[key];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
