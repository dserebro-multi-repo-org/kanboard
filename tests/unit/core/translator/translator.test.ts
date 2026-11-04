import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Translator, sprintf, dt, t, e, n, c } from '../../../../src/core/translator/index.js';

const phpLocaleDir = path.resolve('app/Locale');

beforeEach(() => Translator.unload());
afterEach(() => Translator.unload());

describe('Translator', () => {
  it('loads and unloads languages', () => {
    const tr = new Translator();
    expect(tr.translate('Yes')).toBe('Yes');
    expect(Translator.load('fr_FR')).toBe(true);
    expect(tr.translate('Yes')).toBe('Oui');
    Translator.unload();
    expect(tr.translate('Yes')).toBe('Yes');
    expect(Translator.load('de_DE', Translator.getDefaultFolder())).toBe(true);
    expect(tr.translate('Yes')).toBe('Ja');
  });

  it('formats numbers and currency', () => {
    const tr = new Translator();
    expect(tr.number(1024.42)).toBe('1,024.42');
    expect(tr.currency(1234.5)).toBe('$1,234.50');
    Translator.load('fr_FR');
    expect(tr.number(1024.42)).toBe('1 024,42');
    Translator.locales['currency.position'] = 'after';
    Translator.locales['currency.symbol'] = 'EUR';
    expect(tr.currency(5)).toBe('5,00 EUR');
  });

  it('escapes the arguments and the translated string like PHP htmlspecialchars', () => {
    const tr = new Translator();
    expect(tr.translate('%s', '<b>')).toBe('&lt;b&gt;');
    expect(tr.translateNoEscaping('%s', '<b>')).toBe('<b>');
    expect(tr.translate('%s', "a&amp;b & 'q' \"d\"")).toBe('a&amp;b &amp; &#039;q&#039; &quot;d&quot;');
    expect(tr.translate('I have %d kids', 5)).toBe('I have 5 kids');
    expect(tr.translate('<15m')).toBe('&lt;15m');
  });

  it('rejects invalid codes and path traversal', () => {
    expect(Translator.load('../fr_FR')).toBe(false);
    expect(Translator.load('fr_FR/../../x')).toBe(false);
    expect(Translator.load('xx')).toBe(false);
    expect(Translator.load('fr_FR', '/nonexistent-dir')).toBe(false);
    expect(Translator.load('FR')).toBe(false);
  });

  it('refuses symlinks escaping the locale dir', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-'));
    const dir = path.join(base, 'locales');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(base, 'outside.json'), '{"Yes":"Evil"}');
    fs.symlinkSync(path.join(base, 'outside.json'), path.join(dir, 'fr_FR.json'));
    expect(Translator.load('fr_FR', dir)).toBe(false);
    fs.rmSync(base, { recursive: true });
  });

  it('exposes template functions', () => {
    Translator.load('fr_FR');
    expect(t('Yes')).toBe('Oui');
    expect(e('<%s>', '<')).toBe('<<>');
    expect(n(1024.42)).toBe('1 024,42');
    expect(c(1)).toBe('$1,00');
  });

  it('loads every language with the same key count as the PHP files', () => {
    const codes = fs.readdirSync(phpLocaleDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(codes.length).toBe(39);
    for (const code of codes) {
      expect(Translator.load(code), code).toBe(true);
      const phpKeys = fs.readFileSync(path.join(phpLocaleDir, code, 'translations.php'), 'utf8').match(/^\s*'(?:[^'\\]|\\.)*'\s*=>/gm)?.length ?? 0;
      expect(Object.keys(Translator.locales).length, code).toBe(phpKeys);
      Translator.unload();
    }
  });
});

describe('sprintf', () => {
  it('supports PHP formats', () => {
    expect(sprintf('%s-%d', 'a', '12abc')).toBe('a-12');
    expect(sprintf('%.2f', 1.005)).toBe('1.01');
    expect(sprintf('%f', 1.5)).toBe('1.500000');
    expect(sprintf('%2$s %1$s', 'a', 'b')).toBe('b a');
    expect(sprintf('100%%')).toBe('100%');
    expect(sprintf('[%5s][%-5s][%05d][%+d]', 'a', 'b', 42, 3)).toBe('[    a][b    ][00042][+3]');
    expect(sprintf("[%'*6s]", 'x')).toBe('[*****x]');
    expect(sprintf('%x %X %o %b %c %e', 255, 255, 8, 5, 65, 1234.5)).toBe('ff FF 10 101 A 1.234500e+3');
    expect(sprintf('%.3s', 'abcdef')).toBe('abc');
  });

  it('throws on too few arguments', () => {
    expect(() => sprintf('%s %s', 'a')).toThrow();
  });
});

describe('dt', () => {
  it('formats like PHP date()', () => {
    expect(dt('m/d/Y H:i', 1700000000)).toBe('11/14/2023 22:13');
    expect(dt('D, d M Y jS \\o\\f F', 1700000000)).toBe('Tue, 14 Nov 2023 14th of November');
    expect(dt('Y-m-d H:i T P', 1700000000, 'America/New_York')).toBe('2023-11-14 17:13 -0500 -05:00');
  });
});
