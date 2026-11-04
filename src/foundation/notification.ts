import type { Container } from '../core/container/container.js';
import type { Row } from './model.js';

/** Channel delivering notifications (`app/Core/Notification/NotificationInterface.php`). */
export interface NotificationInterface {
  notifyUser(user: Row, eventName: string, eventData: Row): void | Promise<void>;
  notifyProject(project: Row, eventName: string, eventData: Row): void | Promise<void>;
}

export type NotificationConstructor = new (container: Container) => NotificationInterface;

/**
 * Registry of notification channels (port of `NotificationTypeModel`): web, email and plugin provided
 * types (slack, ...). Types are instantiated lazily on first `getType()`.
 */
export class NotificationTypeRegistry {
  private readonly classes = new Map<string, () => NotificationInterface>();
  private readonly instances = new Map<string, NotificationInterface>();
  private readonly labels = new Map<string, string>();
  private readonly hiddens: string[] = [];

  constructor(private readonly container: Container) {}

  /** Register a notification type; hidden types are not offered to users but can still be used. */
  setType(type: string, label: string, notification: NotificationConstructor, hidden = false): this {
    if (hidden) {
      if (!this.hiddens.includes(type)) this.hiddens.push(type);
      this.labels.delete(type);
    } else {
      this.labels.set(type, label);
    }

    this.instances.delete(type);
    this.classes.set(type, () => new notification(this.container));
    return this;
  }

  getType(type: string): NotificationInterface {
    const cached = this.instances.get(type);
    if (cached !== undefined) return cached;

    const factory = this.classes.get(type);
    if (factory === undefined) {
      throw new Error(`Identifier "${type}" is not defined.`);
    }

    const instance = factory();
    this.instances.set(type, instance);
    return instance;
  }

  /** Visible types as `type -> label`. */
  getTypes(): Record<string, string> {
    return Object.fromEntries(this.labels);
  }

  getHiddenTypes(): string[] {
    return [...this.hiddens];
  }

  /** Keep only registered types. */
  filterTypes(types: readonly string[]): string[] {
    return types.filter((type) => this.classes.has(type));
  }
}

/** Built-in notification type identifiers. */
export const NotificationTypes = {
  WEB: 'web',
  EMAIL: 'email',
} as const;
