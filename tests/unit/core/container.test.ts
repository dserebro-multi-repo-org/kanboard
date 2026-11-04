import { describe, expect, it } from 'vitest';
import { Base, Container, ContainerError, registerProviders } from '../../../src/core/container/index.js';

interface Registry {
  counter: { n: number };
  greeting: string;
  derived: string;
}

describe('Container', () => {
  it('lazily builds singletons', () => {
    let built = 0;
    const c = new Container<Registry>();
    c.register('counter', () => {
      built++;
      return { n: built };
    });
    expect(built).toBe(0);
    const a = c.get('counter');
    const b = c.get('counter');
    expect(a).toBe(b);
    expect(built).toBe(1);
  });

  it('has() reports registrations', () => {
    const c = new Container<Registry>();
    expect(c.has('greeting')).toBe(false);
    c.set('greeting', 'hi');
    expect(c.has('greeting')).toBe(true);
    expect(c.get('greeting')).toBe('hi');
    expect(c.keys()).toEqual(['greeting']);
  });

  it('factory() builds a new instance every time', () => {
    let built = 0;
    const c = new Container<Registry>();
    c.factory('counter', () => ({ n: ++built }));
    expect(c.get('counter')).not.toBe(c.get('counter'));
    expect(built).toBe(2);
  });

  it('resolves dependencies through the container', () => {
    const c = new Container<Registry>();
    c.register('greeting', () => 'hello');
    c.register('derived', (ct) => `${ct.get('greeting')} world`);
    expect(c.get('derived')).toBe('hello world');
  });

  it('extend() decorates the original service', () => {
    const c = new Container<Registry>();
    c.register('greeting', () => 'hello');
    c.extend('greeting', (previous) => `${previous}!`);
    expect(c.get('greeting')).toBe('hello!');
  });

  it('extend() keeps the shared nature of a factory service', () => {
    let built = 0;
    const c = new Container<Registry>();
    c.factory('counter', () => ({ n: ++built }));
    c.extend('counter', (s) => ({ n: s.n * 10 }));
    expect(c.get('counter').n).toBe(10);
    expect(c.get('counter').n).toBe(20);
  });

  it('re-registering replaces cached instances', () => {
    const c = new Container<Registry>();
    c.register('greeting', () => 'a');
    expect(c.get('greeting')).toBe('a');
    c.register('greeting', () => 'b');
    expect(c.get('greeting')).toBe('b');
  });

  it('throws on unknown keys and extending unknown keys', () => {
    const c = new Container<Registry>();
    expect(() => c.get('greeting')).toThrow(ContainerError);
    expect(() => c.extend('greeting', (s) => s)).toThrow(ContainerError);
  });

  it('detects circular dependencies', () => {
    const c = new Container<Registry>();
    c.register('greeting', (ct) => ct.get('derived'));
    c.register('derived', (ct) => ct.get('greeting'));
    expect(() => c.get('greeting')).toThrow(/Circular/);
    // The container stays usable afterwards.
    c.set('derived', 'ok');
    expect(c.get('greeting')).toBe('ok');
  });

  it('unregister removes a service', () => {
    const c = new Container<Registry>();
    c.set('greeting', 'x');
    expect(c.unregister('greeting')).toBe(true);
    expect(c.has('greeting')).toBe(false);
  });

  it('registerProviders applies providers', () => {
    const c = new Container<Registry>();
    registerProviders(c, [{ register: (ct) => void ct.set('greeting', 'from provider') }]);
    expect(c.get('greeting')).toBe('from provider');
  });
});

describe('Base', () => {
  class Consumer extends Base<Registry> {
    shout(): string {
      return this.service('greeting').toUpperCase();
    }
  }

  it('gives access to services', () => {
    const c = new Container<Registry>();
    c.set('greeting', 'hey');
    const consumer = new Consumer(c);
    expect(consumer.shout()).toBe('HEY');
    expect(consumer.getContainer()).toBe(c);
  });
});
