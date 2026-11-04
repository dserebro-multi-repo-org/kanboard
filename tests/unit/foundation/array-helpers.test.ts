import { describe, expect, it } from 'vitest';
import {
  arrayColumn,
  arrayColumnIndex,
  arrayColumnIndexUnique,
  arrayColumnSum,
  arrayMergeRelation,
} from '../../../src/foundation/array-helpers.js';
import { htmlspecialchars, setTranslator, sprintf, t } from '../../../src/foundation/translator.js';

describe('array helpers', () => {
  it('arrayColumnSum sums a column and ignores missing values', () => {
    expect(arrayColumnSum([{ c: 2 }, { c: 3 }, { x: 1 }, { c: null }], 'c')).toBe(5);
    expect(arrayColumnSum([], 'c')).toBe(0);
    expect(arrayColumnSum([{ c: '2.5' }], 'c')).toBe(2.5);
  });

  it('arrayColumnIndex groups rows', () => {
    const input = [{ k1: 1, k2: 2 }, { k1: 3, k2: 4 }, { k1: 1, k2: 5 }, { k2: 6 }];
    expect(arrayColumnIndex(input, 'k1')).toEqual({
      1: [{ k1: 1, k2: 2 }, { k1: 1, k2: 5 }],
      3: [{ k1: 3, k2: 4 }],
    });
  });

  it('arrayColumnIndexUnique keeps the first row', () => {
    const input = [{ k1: 1, k2: 2 }, { k1: 3, k2: 4 }, { k1: 1, k2: 5 }];
    expect(arrayColumnIndexUnique(input, 'k1')).toEqual({ 1: { k1: 1, k2: 2 }, 3: { k1: 3, k2: 4 } });
  });

  it('arrayMergeRelation attaches related rows or an empty list', () => {
    const rows: Array<Record<string, unknown>> = [{ id: 1 }, { id: 2 }, { name: 'no id' }];
    arrayMergeRelation(rows, { 1: [{ tag: 'a' }] }, 'tags', 'id');
    expect(rows).toEqual([{ id: 1, tags: [{ tag: 'a' }] }, { id: 2, tags: [] }, { name: 'no id', tags: [] }]);
  });

  it('arrayColumn extracts values', () => {
    expect(arrayColumn([{ id: 1 }, { id: 2 }, { x: 1 }], 'id')).toEqual([1, 2]);
  });
});

describe('translator facade', () => {
  it('substitutes placeholders and escapes string arguments', () => {
    expect(t('Showing %d-%d of %d', 1, 15, 40)).toBe('Showing 1-15 of 40');
    expect(t('Hello %s', '<b>')).toBe('Hello &lt;b&gt;');
    expect(t('100%%')).toBe('100%');
    expect(t('#%d', '12')).toBe('#12');
  });

  it('sprintf supports positional arguments and htmlspecialchars escapes quotes', () => {
    expect(sprintf('%2$s %1$s', ['a', 'b'])).toBe('b a');
    expect(htmlspecialchars(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
  });

  it('allows installing another translator', () => {
    setTranslator({ translate: (message) => `fr:${message}` });
    expect(t('Next')).toBe('fr:Next');
    setTranslator({ translate: (message, ...args) => sprintf(message, args) });
  });
});
