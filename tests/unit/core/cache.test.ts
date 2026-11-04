import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../../../src/core/cache/index.js';

class Counter {
  calls = 0;
  double(n: number): number {
    this.calls++;
    return n * 2;
  }
  nothing(): null {
    this.calls++;
    return null;
  }
}

describe('MemoryCache', () => {
  it('sets, gets, removes and flushes', () => {
    const cache = new MemoryCache();
    expect(cache.get('a')).toBeNull();
    cache.set('a', 1);
    cache.set('b', 'two');
    expect(cache.get('a')).toBe(1);
    expect(cache.get<string>('b')).toBe('two');
    cache.remove('a');
    expect(cache.get('a')).toBeNull();
    cache.flush();
    expect(cache.get('b')).toBeNull();
  });

  it('proxy memoizes by method and arguments', () => {
    const cache = new MemoryCache();
    const counter = new Counter();
    expect(cache.proxy<Counter, number>(counter, 'double', 4)).toBe(8);
    expect(cache.proxy<Counter, number>(counter, 'double', 4)).toBe(8);
    expect(counter.calls).toBe(1);
    expect(cache.proxy<Counter, number>(counter, 'double', 5)).toBe(10);
    expect(counter.calls).toBe(2);
    expect(cache.get('proxy:Counter:double:4')).toBe(8);
  });

  it('proxy does not cache null results', () => {
    const cache = new MemoryCache();
    const counter = new Counter();
    cache.proxy<Counter, null>(counter, 'nothing');
    cache.proxy<Counter, null>(counter, 'nothing');
    expect(counter.calls).toBe(2);
  });
});
