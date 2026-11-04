import { describe, expect, it } from 'vitest';
import { Event, EventDispatcher, EventManager } from '../../../src/core/event/index.js';
import type { EventSubscriber, SubscribedEvents } from '../../../src/core/event/index.js';
import { AuthFailureEvent, GenericEvent, TaskEvents, TaskListEvent } from '../../../src/event/index.js';
import { AuthSubscriber, NotificationSubscriber } from '../../../src/subscriber/index.js';
import { Container } from '../../../src/core/container/index.js';

describe('EventDispatcher', () => {
  it('calls listeners ordered by priority then registration', () => {
    const d = new EventDispatcher();
    const calls: string[] = [];
    d.addListener('e', () => void calls.push('low'), -5);
    d.addListener('e', () => void calls.push('first'), 0);
    d.addListener('e', () => void calls.push('second'), 0);
    d.addListener('e', () => void calls.push('high'), 10);
    d.dispatch(new Event(), 'e');
    expect(calls).toEqual(['high', 'first', 'second', 'low']);
  });

  it('passes the event and event name', () => {
    const d = new EventDispatcher();
    const seen: string[] = [];
    const event = new GenericEvent({ a: 1 });
    d.addListener<GenericEvent>('x', (e, name) => void seen.push(`${name}:${String(e.get('a'))}`));
    expect(d.dispatch(event, 'x')).toBe(event);
    expect(seen).toEqual(['x:1']);
  });

  it('honours stopPropagation', () => {
    const d = new EventDispatcher();
    const calls: number[] = [];
    d.addListener('e', (e) => {
      calls.push(1);
      e.stopPropagation();
    }, 5);
    d.addListener('e', () => void calls.push(2));
    d.dispatch(new Event(), 'e');
    expect(calls).toEqual([1]);
  });

  it('dispatchAsync awaits listeners sequentially', async () => {
    const d = new EventDispatcher();
    const calls: string[] = [];
    d.addListener('e', async () => {
      await new Promise((r) => setTimeout(r, 5));
      calls.push('a');
    }, 1);
    d.addListener('e', () => void calls.push('b'));
    await d.dispatchAsync(new Event(), 'e');
    expect(calls).toEqual(['a', 'b']);
  });

  it('removes listeners and reports state', () => {
    const d = new EventDispatcher();
    const l = (): void => undefined;
    expect(d.hasListeners()).toBe(false);
    d.addListener('e', l, 3);
    expect(d.hasListeners('e')).toBe(true);
    expect(d.getListenerPriority('e', l)).toBe(3);
    expect(d.getEventNames()).toEqual(['e']);
    d.removeListener('e', l);
    expect(d.hasListeners('e')).toBe(false);
    expect(d.getListeners('e')).toEqual([]);
  });

  it('allows listeners to remove themselves during dispatch', () => {
    const d = new EventDispatcher();
    let count = 0;
    const once = (): void => {
      count++;
      d.removeListener('e', once);
    };
    d.addListener('e', once);
    d.addListener('e', () => void count++);
    d.dispatch(new Event(), 'e');
    d.dispatch(new Event(), 'e');
    expect(count).toBe(3);
  });

  it('supports subscribers with all parameter shapes', () => {
    const calls: string[] = [];
    const events: SubscribedEvents = {
      a: 'plain',
      b: ['withPriority', 10],
      c: [['m1', 5], ['m2']],
    };
    const subscriber: EventSubscriber & Record<string, unknown> = {
      getSubscribedEvents: () => events,
      plain: () => calls.push('plain'),
      withPriority: () => calls.push('withPriority'),
      m1: () => calls.push('m1'),
      m2: () => calls.push('m2'),
    };
    const d = new EventDispatcher();
    d.addSubscriber(subscriber);
    d.dispatch(new Event(), 'a');
    d.dispatch(new Event(), 'b');
    d.dispatch(new Event(), 'c');
    expect(calls).toEqual(['plain', 'withPriority', 'm1', 'm2']);
    expect(d.getListenerPriority('b', d.getListeners('b')[0]!)).toBe(10);
  });

  it('throws when a subscriber method is missing', () => {
    const d = new EventDispatcher();
    expect(() => d.addSubscriber({ getSubscribedEvents: () => ({ a: 'nope' }) })).toThrow(/does not exist/);
  });

  it('wires the subscriber stubs', () => {
    const container = new Container();
    const d = new EventDispatcher();
    d.addSubscriber(new AuthSubscriber(container));
    d.addSubscriber(new NotificationSubscriber(container));
    expect(d.hasListeners('auth.success')).toBe(true);
    expect(d.hasListeners(TaskEvents.CREATE)).toBe(true);
    d.dispatch(new AuthFailureEvent('bob'), 'auth.failure');
  });
});

describe('GenericEvent', () => {
  it('extracts ids', () => {
    expect(new GenericEvent({ task: { id: 4, project_id: 2 } }).getTaskId()).toBe(4);
    expect(new GenericEvent({ task: { id: 4, project_id: 2 } }).getProjectId()).toBe(2);
    expect(new GenericEvent({ task_id: 9 }).getTaskId()).toBe(9);
    expect(new GenericEvent().getTaskId()).toBeNull();
    expect(new GenericEvent().getProjectId()).toBeNull();
  });

  it('behaves like an array', () => {
    const e = new GenericEvent();
    e.set('k', 'v');
    expect(e.has('k')).toBe(true);
    expect(e.get('k')).toBe('v');
    expect(e.getAll()).toEqual({ k: 'v' });
    e.delete('k');
    expect(e.get('k')).toBeNull();
  });

  it('TaskListEvent stores tasks', () => {
    const e = new TaskListEvent();
    e.setTasks([{ id: 1 }]);
    expect(e.get('tasks')).toEqual([{ id: 1 }]);
  });
});

describe('EventManager', () => {
  it('lists built-in events plus custom ones sorted by description', () => {
    const m = new EventManager();
    m.register('plugin.event', 'A plugin event');
    const all = m.getAll();
    expect(all[TaskEvents.CREATE]).toBe('Task creation');
    expect(all['plugin.event']).toBe('A plugin event');
    const descriptions = Object.values(all);
    expect(descriptions).toEqual([...descriptions].sort((a, b) => a.localeCompare(b)));
  });
});
