import { describe, expect, it } from 'vitest';
import { getFileExtension, htmlspecialchars, httpBuildQuery, inArray, jsonEncode, looseEquals, phpEmpty, phpRound, toInt } from '../../../src/helper/php.js';

describe('php helpers', () => {
  it('htmlspecialchars double encode', () => {
    expect(htmlspecialchars('&amp;', true)).toBe('&amp;amp;');
    expect(htmlspecialchars('&amp; &apos; &#0; &#x110000; &#xZZ;', false)).toBe('&amp; &amp;apos; &#0; &amp;#x110000; &amp;#xZZ;');
  });

  it('http_build_query', () => {
    expect(httpBuildQuery({ a: 1, b: null, c: true, d: false, e: 'x y' }, '&amp;')).toBe('a=1&amp;c=1&amp;d=0&amp;e=x+y');
    expect(httpBuildQuery({ a: [1, 2], b: { c: 'd' } })).toBe('a%5B0%5D=1&a%5B1%5D=2&b%5Bc%5D=d');
  });

  it('json_encode', () => {
    expect(jsonEncode({ a: [], b: {}, c: [1, 'x'], d: null, e: "'", f: '\n€😀' }, true)).toBe('{"a":[],"b":[],"c":[1,"x"],"d":null,"e":"\\u0027","f":"\\n\\u20ac\\ud83d\\ude00"}');
    expect(jsonEncode("'")).toBe(`"'"`);
  });

  it('loose comparison, empty, int, round, extension', () => {
    expect(looseEquals('1', 1)).toBe(true);
    expect(looseEquals('abc', 0)).toBe(false);
    expect(looseEquals('', 0)).toBe(false);
    expect(looseEquals('1.0', '1')).toBe(true);
    expect(looseEquals(null, '')).toBe(true);
    expect(inArray('2', [1, 2])).toBe(true);
    expect(phpEmpty('0')).toBe(true);
    expect(phpEmpty([])).toBe(true);
    expect(phpEmpty('a')).toBe(false);
    expect(toInt('12abc')).toBe(12);
    expect(phpRound(2.675, 2)).toBe(2.68);
    expect(phpRound(-1.5)).toBe(-2);
    expect(getFileExtension('a/b.TXT')).toBe('txt');
    expect(getFileExtension('.htaccess')).toBe('htaccess');
    expect(getFileExtension('noext')).toBe('');
  });
});
