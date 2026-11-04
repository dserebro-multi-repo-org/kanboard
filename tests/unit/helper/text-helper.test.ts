import { describe, expect, it } from 'vitest';
import { MarkdownStub } from '../../../src/foundation/helper-collaborators.js';
import type { TextHelper } from '../../../src/helper/text-helper.js';
import { helpers, makeContainer, setService } from './fixture.js';

async function text(): Promise<{ h: TextHelper; container: Awaited<ReturnType<typeof makeContainer>> }> {
  const container = await makeContainer();
  return { h: helpers(container).get<TextHelper>('text'), container };
}

describe('TextHelper', () => {
  it('escapes like htmlspecialchars(ENT_QUOTES, UTF-8, double_encode=false)', async () => {
    const { h } = await text();
    expect(h.e(`<a href='x' title="y">`)).toBe('&lt;a href=&#039;x&#039; title=&quot;y&quot;&gt;');
    expect(h.e('&amp; &#39; &#x27; &nbsp; &foo; & &')).toBe('&amp; &#39; &#x27; &nbsp; &amp;foo; &amp; &amp;');
    expect(h.e(null)).toBe('');
    expect(h.e(false)).toBe('');
    expect(h.e(true)).toBe('1');
    expect(h.e(12)).toBe('12');
  });

  it('implode', async () => {
    const { h } = await text();
    expect(h.implode(', ', ['<img src=x onerror=alert(0)>'])).toBe('&lt;img src=x onerror=alert(0)&gt;');
    expect(h.implode('-', ['a&b', 'c'])).toBe('a&amp;b-c');
  });

  it('markdown uses the markdown service, empty text gives an empty string', async () => {
    const { h, container } = await text();
    expect(h.markdown('Test')).toBe('<p>Test</p>');
    expect(h.markdown(null)).toBe('');
    setService(container, 'markdown', { render: (value: string, isPublic: boolean) => `${value}|${isPublic}` });
    expect(h.markdown('x', true)).toBe('x|true');
    expect(h.markdown('0')).toBe('|false');
    expect(new MarkdownStub().render('a<b')).toBe('<p>a&lt;b</p>');
  });

  it('formats bytes', async () => {
    const { h } = await text();
    expect(h.bytes(0)).toBe(0);
    expect(h.bytes(1024)).toBe('1k');
    expect(h.bytes(34520)).toBe('33.71k');
    expect(h.bytes(500)).toBe('500');
    expect(h.bytes(5 * 1024 * 1024)).toBe('5M');
  });

  it('contains', async () => {
    const { h } = await text();
    expect(h.contains('abc', 'b')).toBe(true);
    expect(h.contains('abc', 'd')).toBe(false);
  });

  it('in', async () => {
    const { h } = await text();
    expect(h.in('a', { b: 'c' })).toBe('?');
    expect(h.in('b', { b: 'c' })).toBe('c');
    expect(h.in('b', { b: '<' })).toBe('&lt;');
    expect(h.in('b', { b: null }, 'none')).toBe('none');
    expect(h.in(1, ['x', 'y'])).toBe('y');
  });

  it('formats a reply', async () => {
    const { h } = await text();
    expect(h.reply('User', 'a comment\nto test this\r\nfeature')).toBe('User wrote: \n> a comment\n> to test this\n> feature');
  });
});
