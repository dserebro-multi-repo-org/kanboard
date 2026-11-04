import { describe, expect, it } from 'vitest';
import { DateHelper, strtotime } from '../../../src/helper/date-helper.js';
import { helpers, makeContainer } from './fixture.js';

async function dt(): Promise<DateHelper> {
  return helpers(await makeContainer(true)).get<DateHelper>('dt');
}

describe('DateHelper', () => {
  it('getTime', async () => {
    expect(await (await dt()).time(1422206700)).toBe('17:25');
  });

  it('getDate', async () => {
    const h = await dt();
    expect(await h.date(1422206700)).toBe('01/25/2015');
    expect(await h.date('2015-01-25')).toBe('01/25/2015');
    expect(await h.date('0')).toBe('');
    expect(await h.date(0)).toBe('');
    expect(await h.date('')).toBe('');
  });

  it('getDatetime', async () => {
    expect(await (await dt()).datetime(1422206700)).toBe('01/25/2015 17:25');
  });

  it('age', async () => {
    const h = await dt();
    expect(h.age(0, 30)).toBe('&lt;15m');
    expect(h.age(0, 1000)).toBe('&lt;30m');
    expect(h.age(0, 1500)).toBe('&lt;30m');
    expect(h.age(0, 3000)).toBe('&lt;1h');
    expect(h.age(0, 2 * 3600)).toBe('~2h');
    expect(h.age(0, 30 * 3600)).toBe('1d');
    expect(h.age(0, 65 * 3600)).toBe('2d');
    expect(h.age(Math.floor(Date.now() / 1000) - 10)).toBe('&lt;15m');
  });

  it('getDayHours', async () => {
    const slots = (await dt()).getDayHours();
    expect(Object.keys(slots)).toHaveLength(48);
    expect(slots).toHaveProperty('00:00');
    expect(slots).toHaveProperty('00:30');
    expect(slots).toHaveProperty('01:00');
    expect(slots).toHaveProperty('23:30');
    expect(slots).not.toHaveProperty('24:00');
  });

  it('getWeekDays', async () => {
    const slots = (await dt()).getWeekDays();
    expect(Object.values(slots)).toHaveLength(7);
    expect(Object.values(slots)).toContain('Monday');
    expect(Object.values(slots)).toContain('Sunday');
  });

  it('getWeekDay', async () => {
    const h = await dt();
    expect(h.getWeekDay(1)).toBe('Monday');
    expect(h.getWeekDay(7)).toBe('Sunday');
  });

  it('duration', async () => {
    const h = await dt();
    expect(h.duration(0)).toBe(0);
    expect(h.duration(90061)).toBe('1 days, 1 hours, 1 minutes, 1 seconds');
    expect(h.duration(59)).toBe('0 days, 0 hours, 0 minutes, 59 seconds');
  });

  it('durationHours', async () => {
    const h = await dt();
    expect(h.durationHours(1.005)).toBe('1.01 hours');
    expect(h.durationHours(2)).toBe('2.00 hours');
  });

  it('strtotime', () => {
    expect(strtotime('2015-01-25')).toBe(1422144000);
    expect(strtotime('2015-01-25 17:25')).toBe(1422206700);
    expect(strtotime('01/25/2015')).toBe(1422144000);
    expect(strtotime('2015-01-25T17:25:00+01:00')).toBe(1422203100);
    expect(strtotime('not a date')).toBe(false);
  });
});
