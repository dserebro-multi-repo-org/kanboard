import { describe, expect, it } from 'vitest';
import { FakeDb } from './helpers.js';
import { Validator, Validators, parseDateFormat } from '../../../src/validator/simple-validator.js';
import type { Rule, Values } from '../../../src/validator/simple-validator.js';
import { sprintf, t } from '../../../src/validator/translate.js';

async function run(rules: Rule[], data: Values): Promise<[boolean, Record<string, string[]>]> {
  const v = new Validator(data, rules);
  return [await v.execute(), v.getErrors()];
}

describe('Validator', () => {
  it('collects the messages by field, in rule order, without short-circuit', async () => {
    const [ok, errors] = await run(
      [new Validators.Required('a', 'req'), new Validators.Integer('b', 'int'), new Validators.MinLength('b', 'min', 5)],
      { b: 'x1' },
    );
    expect(ok).toBe(false);
    expect(errors).toEqual({ a: ['req'], b: ['int', 'min'] });
  });

  it('returns an empty error map when everything is valid', async () => {
    expect(await run([new Validators.Required('a', 'req')], { a: 'x' })).toEqual([true, {}]);
  });
});

describe('rules', () => {
  const ok = async (rule: Rule, data: Values) => (await run([rule], data))[0];

  it('Required: null, undefined and empty string are missing, 0 is present', async () => {
    const r = new Validators.Required('a', 'm');
    expect(await ok(r, {})).toBe(false);
    expect(await ok(r, { a: null })).toBe(false);
    expect(await ok(r, { a: '' })).toBe(false);
    expect(await ok(r, { a: 0 })).toBe(true);
    expect(await ok(r, { a: '0' })).toBe(true);
  });

  it('NotEmpty only checks present keys', async () => {
    const r = new Validators.NotEmpty('a', 'm');
    expect(await ok(r, {})).toBe(true);
    expect(await ok(r, { a: null })).toBe(false);
    expect(await ok(r, { a: '' })).toBe(false);
    expect(await ok(r, { a: 'x' })).toBe(true);
  });

  it('Integer accepts ints and digit strings (optionally negative) only', async () => {
    const r = new Validators.Integer('a', 'm');
    for (const v of [1, -1, '12', '-12', 0, '']) expect(await ok(r, { a: v })).toBe(true);
    for (const v of ['a', '1.5', 1.5, '-', '1a', true]) expect(await ok(r, { a: v })).toBe(false);
  });

  it('Numeric', async () => {
    const r = new Validators.Numeric('a', 'm');
    for (const v of [1, 1.25, '1.25', '-3', '1e3', ' 5']) expect(await ok(r, { a: v })).toBe(true);
    for (const v of ['foobar', '1a', 'abc']) expect(await ok(r, { a: v })).toBe(false);
  });

  it('MinLength / MaxLength / Length count characters, not bytes', async () => {
    expect(await ok(new Validators.MaxLength('a', 'm', 3), { a: 'ééé' })).toBe(true);
    expect(await ok(new Validators.MaxLength('a', 'm', 3), { a: 'éééé' })).toBe(false);
    expect(await ok(new Validators.MinLength('a', 'm', 6), { a: '12345' })).toBe(false);
    expect(await ok(new Validators.MinLength('a', 'm', 6), { a: '123456' })).toBe(true);
    expect(await ok(new Validators.Length('a', 'm', 2, 3), { a: 'a' })).toBe(false);
    expect(await ok(new Validators.Length('a', 'm', 2, 3), { a: 'abc' })).toBe(true);
    expect(await ok(new Validators.MinLength('a', 'm', 6), {})).toBe(true);
  });

  it('GreaterThan / GreaterThanOrEqual / Range', async () => {
    expect(await ok(new Validators.GreaterThan('a', 'm', 0), { a: 0 })).toBe(false);
    expect(await ok(new Validators.GreaterThan('a', 'm', 0), { a: '1' })).toBe(true);
    expect(await ok(new Validators.GreaterThanOrEqual('a', 'm', 0), { a: '0' })).toBe(true);
    expect(await ok(new Validators.GreaterThanOrEqual('a', 'm', 0), { a: -1 })).toBe(false);
    expect(await ok(new Validators.Range('a', 'm', 1, 3), { a: 3 })).toBe(true);
    expect(await ok(new Validators.Range('a', 'm', 1, 3), { a: 4 })).toBe(false);
    expect(await ok(new Validators.Range('a', 'm', 1, 3), { a: 'x' })).toBe(false);
  });

  it('InArray / NotInArray use loose comparison like in_array()', async () => {
    expect(await ok(new Validators.InArray('a', [1, 2], 'm'), { a: '1' })).toBe(true);
    expect(await ok(new Validators.InArray('a', ['blue'], 'm'), { a: 'blue"><style>' })).toBe(false);
    expect(await ok(new Validators.InArray('a', [''], 'm'), { a: '' })).toBe(true);
    expect(await ok(new Validators.NotInArray('a', [1, 2], 'm'), { a: 3 })).toBe(true);
    expect(await ok(new Validators.NotInArray('a', [1, 2], 'm'), { a: '2' })).toBe(false);
  });

  it('Equals / NotEquals are strict and skip empty fields', async () => {
    expect(await ok(new Validators.Equals('a', 'b', 'm'), { a: 'x', b: 'x' })).toBe(true);
    expect(await ok(new Validators.Equals('a', 'b', 'm'), { a: 'x', b: 'y' })).toBe(false);
    expect(await ok(new Validators.Equals('a', 'b', 'm'), { a: 'x' })).toBe(false);
    expect(await ok(new Validators.Equals('a', 'b', 'm'), { a: 1, b: '1' })).toBe(false);
    expect(await ok(new Validators.Equals('a', 'b', 'm'), { b: 'y' })).toBe(true);
    expect(await ok(new Validators.NotEquals('a', 'b', 'm'), { a: 'x', b: 'x' })).toBe(false);
    expect(await ok(new Validators.NotEquals('a', 'b', 'm'), { a: 'x', b: 'y' })).toBe(true);
    expect(await ok(new Validators.NotEquals('a', 'b', 'm'), { a: 'x' })).toBe(true);
  });

  it('Email follows the Firefox algorithm', async () => {
    const r = new Validators.Email('a', 'm');
    for (const v of ['test@localhost', 'a.b+c@example.com', "o'neil@a-b.org", '']) expect(await ok(r, { a: v })).toBe(true);
    for (const v of ['invalid', '@example.com', 'a@b', 'a@', 'a@.com', 'a@b..c', 'a@b.', 'a b@c.de', 'é@example.com', 'a@exa_mple.com']) {
      expect(await ok(r, { a: v })).toBe(false);
    }
  });

  it('URL, AlphaNumeric, Alpha, Ip', async () => {
    const url = new Validators.URL('a', 'm');
    for (const v of ['http://localhost', 'https://example.com/path?q=1', 'http://somewhere']) expect(await ok(url, { a: v })).toBe(true);
    for (const v of ['invalid', 'http://', 'javascript alert', 'example.com']) expect(await ok(url, { a: v })).toBe(false);
    expect(await ok(new Validators.AlphaNumeric('a', 'm'), { a: 'TEST1' })).toBe(true);
    expect(await ok(new Validators.AlphaNumeric('a', 'm'), { a: 'a-b-c' })).toBe(false);
    expect(await ok(new Validators.AlphaNumeric('a', 'm'), { a: 'test 123' })).toBe(false);
    expect(await ok(new Validators.Alpha('a', 'm'), { a: 'abc' })).toBe(true);
    expect(await ok(new Validators.Alpha('a', 'm'), { a: 'ab1' })).toBe(false);
    expect(await ok(new Validators.Ip('a', 'm'), { a: '127.0.0.1' })).toBe(true);
    expect(await ok(new Validators.Ip('a', 'm'), { a: '::1' })).toBe(true);
    expect(await ok(new Validators.Ip('a', 'm'), { a: '999.0.0.1' })).toBe(false);
  });

  it('Timezone accepts canonical identifiers only', async () => {
    const r = new Validators.Timezone('a', 'm');
    expect(await ok(r, { a: 'Europe/Paris' })).toBe(true);
    expect(await ok(r, { a: 'UTC' })).toBe(true);
    expect(await ok(r, { a: '' })).toBe(true);
    expect(await ok(r, { a: 'unknown' })).toBe(false);
  });

  it('Date validates against PHP formats, strictly', async () => {
    const r = new Validators.Date('a', 'm', ['Y-m-d', 'm/d/Y H:i']);
    expect(await ok(r, { a: '2017-02-01' })).toBe(true);
    expect(await ok(r, { a: '02/01/2017 13:15' })).toBe(true);
    expect(await ok(r, { a: '02/01/2017 1:15' })).toBe(true);
    expect(await ok(r, { a: '2017-02-30' })).toBe(false);
    expect(await ok(r, { a: '2017-13-01' })).toBe(false);
    expect(await ok(r, { a: '2017-02-01 ' })).toBe(false);
    expect(await ok(r, { a: 'garbage' })).toBe(false);
    expect(await ok(r, { a: '' })).toBe(true);
  });

  it('Unique ignores the row owning the primary key', async () => {
    const db = new FakeDb({ items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] });
    const r = new Validators.Unique('name', 'm', db, 'items');
    expect(await ok(r, { name: 'c' })).toBe(true);
    expect(await ok(r, { name: 'a' })).toBe(false);
    expect(await ok(r, { name: 'a', id: 1 })).toBe(true);
    expect(await ok(r, { name: 'a', id: 2 })).toBe(false);
    expect(await ok(r, { name: '' })).toBe(true);
  });

  it('Exists looks the value up in the given key', async () => {
    const db = new FakeDb({ tasks: [{ id: 1 }, { id: 2 }] });
    const r = new Validators.Exists('opposite_task_id', 'm', db, 'tasks', 'id');
    expect(await ok(r, { opposite_task_id: 2 })).toBe(true);
    expect(await ok(r, { opposite_task_id: 3 })).toBe(false);
    expect(await ok(r, {})).toBe(true);
  });

  it('Callback rules may be asynchronous', async () => {
    const r = new Validators.Callback('a', 'm', async (value) => value === 'ok');
    expect(await ok(r, { a: 'ok' })).toBe(true);
    expect(await ok(r, { a: 'ko' })).toBe(false);
  });
});

describe('parseDateFormat', () => {
  it('parses to a UTC timestamp', () => {
    expect(parseDateFormat('2017-02-01 13:15', 'Y-m-d H:i')).toBe(Date.UTC(2017, 1, 1, 13, 15) / 1000);
    expect(parseDateFormat('02/01/2017 1:15 pm', 'm/d/Y g:i a')).toBe(Date.UTC(2017, 1, 1, 13, 15) / 1000);
    expect(parseDateFormat('1 Feb 2017', '!j M Y')).toBe(Date.UTC(2017, 1, 1) / 1000);
  });

  it('rejects trailing data and overflowing values', () => {
    expect(parseDateFormat('2017-02-01 1:15 pm', 'Y-m-d H:i')).toBeNull();
    expect(parseDateFormat('2017-02-29', 'Y-m-d')).toBeNull();
    expect(parseDateFormat('2016-02-29', 'Y-m-d')).not.toBeNull();
    expect(parseDateFormat('2017-01-01 24:00', 'Y-m-d H:i')).toBeNull();
  });
});

describe('translate', () => {
  it('substitutes the placeholders like PHP sprintf', () => {
    expect(t('The maximum length is %d characters', 191)).toBe('The maximum length is 191 characters');
    expect(t('This value must be in the range %d to %d', -2147483647, 2147483647)).toBe('This value must be in the range -2147483647 to 2147483647');
    expect(sprintf('%2$s-%1$s 100%%', 'a', 'b')).toBe('b-a 100%');
    expect(t("Passwords don't match")).toBe("Passwords don't match");
  });
});
