import { Event } from './event.js';

/** A listener receives the event and the event name, and may be async. */
export type EventListener<E extends Event = Event> = (event: E, eventName: string) => void | Promise<void>;

/**
 * Value returned by {@link EventSubscriber.getSubscribedEvents} for one event, same shapes as Symfony:
 * - `'method'`
 * - `['method', priority]`
 * - `[['method1', priority], ['method2']]`
 */
export type SubscribedEventParams = string | readonly [string, number?] | ReadonlyArray<readonly [string, number?]>;

export type SubscribedEvents = Readonly<Record<string, SubscribedEventParams>>;

/** Class declaring the events it listens to (`Symfony EventSubscriberInterface`). */
export interface EventSubscriber {
  getSubscribedEvents(): SubscribedEvents;
}

interface Registered {
  listener: EventListener;
  priority: number;
  order: number;
}

/**
 * Priority based event dispatcher (port of the Symfony `EventDispatcher` used in
 * `app/ServiceProvider/EventDispatcherProvider.php`). Higher priority runs first; listeners with
 * the same priority run in registration order.
 */
export class EventDispatcher {
  private readonly listeners = new Map<string, Registered[]>();
  private counter = 0;

  addListener<E extends Event>(eventName: string, listener: EventListener<E>, priority = 0): void {
    const list = this.listeners.get(eventName) ?? [];
    list.push({ listener: listener as EventListener, priority, order: this.counter++ });
    list.sort((a, b) => b.priority - a.priority || a.order - b.order);
    this.listeners.set(eventName, list);
  }

  removeListener<E extends Event>(eventName: string, listener: EventListener<E>): void {
    const list = this.listeners.get(eventName);
    if (list === undefined) return;
    const remaining = list.filter((r) => r.listener !== (listener as EventListener));
    if (remaining.length === 0) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.set(eventName, remaining);
    }
  }

  /** Listeners of an event ordered by priority. */
  getListeners(eventName: string): EventListener[] {
    return (this.listeners.get(eventName) ?? []).map((r) => r.listener);
  }

  hasListeners(eventName?: string): boolean {
    if (eventName !== undefined) {
      return (this.listeners.get(eventName)?.length ?? 0) > 0;
    }
    return this.listeners.size > 0;
  }

  getListenerPriority(eventName: string, listener: EventListener): number | undefined {
    return this.listeners.get(eventName)?.find((r) => r.listener === listener)?.priority;
  }

  /** Registered event names. */
  getEventNames(): string[] {
    return [...this.listeners.keys()];
  }

  /**
   * Dispatch synchronously. Listeners returning a promise are NOT awaited: use
   * {@link dispatchAsync} when listeners are asynchronous.
   */
  dispatch<E extends Event>(event: E, eventName: string): E {
    for (const { listener } of [...(this.listeners.get(eventName) ?? [])]) {
      if (event.isPropagationStopped()) break;
      void listener(event, eventName);
    }
    return event;
  }

  /** Dispatch awaiting each listener sequentially, honouring `stopPropagation()`. */
  async dispatchAsync<E extends Event>(event: E, eventName: string): Promise<E> {
    for (const { listener } of [...(this.listeners.get(eventName) ?? [])]) {
      if (event.isPropagationStopped()) break;
      await listener(event, eventName);
    }
    return event;
  }

  addSubscriber(subscriber: EventSubscriber): void {
    for (const [eventName, params] of Object.entries(subscriber.getSubscribedEvents())) {
      for (const [method, priority] of normalizeParams(params)) {
        const target = (subscriber as unknown as Record<string, unknown>)[method];
        if (typeof target !== 'function') {
          throw new Error(`Subscriber method "${method}" for event "${eventName}" does not exist.`);
        }
        this.addListener(eventName, (event, name) => (target as EventListener).call(subscriber, event, name), priority);
      }
    }
  }
}

function normalizeParams(params: SubscribedEventParams): Array<[string, number]> {
  if (typeof params === 'string') {
    return [[params, 0]];
  }
  const first = params[0];
  if (typeof first === 'string') {
    const priority = params[1];
    return [[first, typeof priority === 'number' ? priority : 0]];
  }
  return (params as ReadonlyArray<readonly [string, number?]>).map(([method, priority]): [string, number] => [method, priority ?? 0]);
}
