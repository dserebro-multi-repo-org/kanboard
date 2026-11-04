import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config/index.js';
import type { Container } from '../../../src/core/container/container.js';
import { DateParser } from '../../../src/core/date-parser.js';
import { phpDate } from '../../../src/core/php-date.js';
import { createContainer, runMigrations } from '../../../src/service-provider/index.js';

let container: Container;
let dp: DateParser;

const ts = async (v: string) => dp.getTimestamp(v);

beforeEach(async () => {
  container = createContainer(loadConfig({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: 'true' }, { rootDir: path.resolve('/srv/kb-dp-test') }));
  await runMigrations(container);
  dp = new DateParser(container);
});

afterEach(async () => {
  await container.get('db').close();
});

describe('DateParser', () => {
  it('lists time formats', () => {
    expect(dp.getTimeFormats()).toEqual(['H:i', 'g:i a']);
  });

  it('lists date formats', async () => {
    expect(await dp.getDateFormats()).toHaveLength(4);
    expect(await dp.getDateFormats(true)).toHaveLength(6);
    expect(await dp.getDateFormats()).toContain('d/m/Y');
    expect(await dp.getDateFormats()).not.toContain('Y-m-d');
    expect(await dp.getDateFormats(true)).toContain('Y-m-d');
  });

  it('returns the user date format first', async () => {
    expect((await dp.getDateFormats())[0]).toBe('m/d/Y');
    expect((await dp.getDateFormats(true))[0]).toBe('m/d/Y');
    await container.get('configModel').save({ application_date_format: 'd/m/Y' });
    container.get('memoryCache').flush();
    expect((await dp.getDateFormats())[0]).toBe('d/m/Y');
    expect((await dp.getDateFormats(true))[0]).toBe('d/m/Y');
  });

  it('lists datetime formats', async () => {
    expect(await dp.getDateTimeFormats()).toHaveLength(8);
    expect(await dp.getDateTimeFormats(true)).toHaveLength(12);
    expect(await dp.getDateTimeFormats()).toContain('d/m/Y H:i');
    expect(await dp.getDateTimeFormats()).not.toContain('Y-m-d H:i');
    expect(await dp.getDateTimeFormats(true)).toContain('Y-m-d g:i a');
  });

  it('returns the user datetime format first', async () => {
    expect((await dp.getDateTimeFormats())[0]).toBe('m/d/Y H:i');
    await container.get('configModel').save({ application_date_format: 'd/m/Y', application_time_format: 'g:i a' });
    container.get('memoryCache').flush();
    expect((await dp.getDateTimeFormats())[0]).toBe('d/m/Y g:i a');
    expect((await dp.getDateTimeFormats(true))[0]).toBe('d/m/Y g:i a');
  });

  it('lists all formats', async () => {
    expect(await dp.getAllDateFormats()).toHaveLength(12);
    expect(await dp.getAllDateFormats(true)).toHaveLength(18);
    expect(await dp.getAllDateFormats()).toContain('d/m/Y H:i');
    expect(await dp.getAllDateFormats(true)).toContain('Y-m-d g:i a');
  });

  it('builds the available formats', async () => {
    const formats = dp.getAvailableFormats(await dp.getAllDateFormats());
    expect(formats['d/m/Y']).toBe(`${phpDate('d/m/Y')} (d/m/Y)`);
    expect(Object.keys(formats)).toContain('d/m/Y H:i');
  });

  it('parses default formats', async () => {
    expect(phpDate('Y-m-d', await ts('06/09/2016'))).toBe('2016-06-09');
    expect(phpDate('Y-m-d', await ts('2016-06-09'))).toBe('2016-06-09');
    expect(phpDate('Y-m-d', await ts('2016_06_09'))).toBe('2016-06-09');
    expect(phpDate('Y-m-d H:i', await ts('2016-06-09 21:15'))).toBe('2016-06-09 21:15');
    expect(phpDate('Y-m-d H:i', await ts('2016_06_09 21:15'))).toBe('2016-06-09 21:15');
    expect(phpDate('Y-m-d H:i', await ts('06/09/2016 21:15'))).toBe('2016-06-09 21:15');
  });

  it('parses user formats', async () => {
    await container.get('configModel').save({ application_date_format: 'd/m/Y', application_time_format: 'g:i a' });
    expect(phpDate('Y-m-d', await ts('09/06/2016'))).toBe('2016-06-09');
    expect(phpDate('Y-m-d H:i', await ts('2016-06-09 21:15'))).toBe('2016-06-09 21:15');
    expect(phpDate('Y-m-d H:i', await ts('09/06/2016 9:15 pm'))).toBe('2016-06-09 21:15');
  });

  it('parses another user format', async () => {
    await container.get('configModel').save({ application_date_format: 'd.m.Y', application_time_format: 'H:i' });
    expect(phpDate('Y-m-d', await ts('09.06.2016'))).toBe('2016-06-09');
    expect(phpDate('Y-m-d H:i', await ts('09.06.2016 21:15'))).toBe('2016-06-09 21:15');
  });

  it('returns 0 for invalid dates and numeric strings are timestamps', async () => {
    expect(await ts('31/02/2016')).toBe(0);
    expect(await ts('garbage')).toBe(0);
    expect(await ts('')).toBe(0);
    expect(await ts('1454786217')).toBe(1454786217);
  });

  it('checks date range', () => {
    expect(dp.withinDateRange(new Date('2015-03-14T15:30:00'), new Date('2015-03-14T15:00:00'), new Date('2015-03-14T16:00:00'))).toBe(true);
    expect(dp.withinDateRange(new Date('2015-03-14T15:30:00'), new Date('2015-03-14T16:00:00'), new Date('2015-03-14T17:00:00'))).toBe(false);
  });

  it('computes hours', () => {
    const d = (s: string) => new Date(`2015-03-14T${s}`);
    expect(dp.getHours(d('15:00:00'), d('16:00:00'))).toBe(1);
    expect(dp.getHours(d('15:00:00'), d('17:30:00'))).toBe(2.5);
    expect(dp.getHours(d('15:00:00'), d('17:45:00'))).toBe(2.75);
    expect(dp.getHours(d('14:57:00'), d('17:58:00'))).toBe(3.02);
    expect(dp.getHours(d('14:57:00'), d('11:58:00'))).toBe(2.98);
    expect(dp.getHours(d('14:57:00'), d('14:57:10'))).toBe(0);
  });

  it('gets ISO dates', async () => {
    expect(await dp.getIsoDate(1454786217)).toBe(phpDate('Y-m-d', 1454786217));
    expect(await dp.getIsoDate('2014-03-05')).toBe('2014-03-05');
    expect(await dp.getIsoDate('2014_03_05')).toBe('2014-03-05');
    expect(await dp.getIsoDate('03/05/2014')).toBe('2014-03-05');
    expect(await dp.getIsoDate('03/25/2014 23:14')).toBe('2014-03-25');
    expect(await dp.getIsoDate('2014_03_29 23:14')).toBe('2014-03-29');
    expect(await dp.getIsoDate('2014-03-29 23:14')).toBe('2014-03-29');
  });

  it('gets a timestamp from ISO format', () => {
    expect(phpDate('Y-m-d H:i', dp.getTimestampFromIsoFormat('2014-03-05'))).toBe('2014-03-05 00:00');
    const later = Math.floor(Date.now() / 1000) + 2 * 86400;
    expect(phpDate('Y-m-d H:i', dp.getTimestampFromIsoFormat(later))).toBe(`${phpDate('Y-m-d', later)} 00:00`);
  });

  it('removes the time from a timestamp', () => {
    expect(phpDate('H:i', dp.removeTimeFromTimestamp(1454786217))).toBe('00:00');
    expect(phpDate('Y-m-d', dp.removeTimeFromTimestamp(1454786217))).toBe(phpDate('Y-m-d', 1454786217));
  });

  it('formats values', () => {
    const values = { date: '1454787006' };
    expect(dp.format(values, ['date'], 'd/m/Y')).toEqual({ date: phpDate('d/m/Y', 1454787006) });
    expect(dp.format(values, ['date'], 'm/d/Y g:i a')).toEqual({ date: phpDate('m/d/Y g:i a', 1454787006) });
    expect(dp.format({ date: 0 }, ['date'], 'd/m/Y')).toEqual({ date: '' });
  });

  it('converts values', async () => {
    const values = { date_due: '2015-01-25', date_started: '2015-01-25 17:25' };
    const midnight = new Date(2015, 0, 25).getTime() / 1000;
    expect(await dp.convert(values, ['date_due', 'date_started'])).toEqual({ date_due: midnight, date_started: midnight });
    expect(await dp.convert({ date_started: '2015-01-25 17:25' }, ['date_due', 'date_started'], true)).toEqual({
      date_started: new Date(2015, 0, 25, 17, 25).getTime() / 1000,
    });
  });
});
