import { describe, expect, it } from 'vitest';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import { Calendar, Event, Organizer, Attendees, TaskICalFormatter } from '../../../src/formatter/index.js';
import { createTestContainer } from '../support/m6-container.js';

const queryOf = (rows: unknown[]): FilterQuery => ({ findAll: async () => rows }) as unknown as FilterQuery;

const task = {
  id: 12,
  title: 'My task',
  description: 'Line1, line2; x',
  date_creation: 1_700_000_000,
  date_modification: 1_700_000_100,
  date_started: 1_700_100_000,
  date_due: 1_700_200_000,
  owner_id: 2,
  assignee_email: '',
  assignee_username: 'bob',
  assignee_name: '',
  creator_id: 1,
  creator_email: 'admin@example.org',
  creator_username: 'admin',
  creator_name: 'Admin',
};

describe('TaskICalFormatter', () => {
  it('renders tasks with a start and a due date', async () => {
    const container = createTestContainer();
    const formatter = new TaskICalFormatter(container).setCalendar(new Calendar());
    await formatter.addTasksWithStartAndDueDate(queryOf([task]), 'date_started', 'date_due');
    const ical = (await formatter.format()) as string;

    expect(ical.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ical.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ical).toContain('UID:task-#12-date_started-date_due');
    expect(ical).toContain('SUMMARY:#12 My task');
    expect(ical).toContain('DESCRIPTION:Line1\\, line2\\; x');
    expect(ical).toContain('URL:http://kb/?controller=TaskViewController&action=show&task_id=12');
    expect(ical).toContain('ATTENDEE;CN=bob:MAILTO:bob@kanboard.local');
    expect(ical).toContain('ORGANIZER;CN=Admin:MAILTO:admin@example.org');
    expect(ical).toContain('CREATED:20231114T221320Z');
    expect(ical).toMatch(/DTSTART;TZID=[^:]+:\d{8}T\d{6}/);
  });

  it('renders tasks with a due date only, as all day events at midnight', async () => {
    const container = createTestContainer();
    const midnight = new Date(2023, 10, 20, 0, 0, 0).getTime() / 1000;
    const formatter = new TaskICalFormatter(container).setCalendar(new Calendar());
    await formatter.addTasksWithDueDateOnly(queryOf([{ ...task, date_due: midnight, owner_id: 0, creator_id: 0 }, { ...task, id: 13, date_due: midnight + 3600 }]));
    const ical = (await formatter.format()) as string;

    expect(ical).toContain('DTSTART;VALUE=DATE:20231120');
    expect(ical.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ical).toContain('UID:task-#13-date_due');
    const [first, second] = ical.split('BEGIN:VEVENT').slice(1);
    expect(first).not.toContain('ATTENDEE');
    expect(first).not.toContain('ORGANIZER');
    expect(second).toContain('ATTENDEE');
    expect(second).toContain('ORGANIZER');
  });

  it('requires a calendar', async () => {
    await expect(new TaskICalFormatter(createTestContainer()).format()).rejects.toThrow('no calendar');
  });
});

describe('ical writer', () => {
  it('folds long lines to 75 octets', () => {
    const calendar = new Calendar('-//test//EN').addComponent(new Event('uid').setSummary('x'.repeat(200)));
    const lines = calendar.render().split('\r\n');
    for (const line of lines) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(calendar.render().replace(/\r\n /g, '')).toContain(`SUMMARY:${'x'.repeat(200)}`);
  });

  it('builds attendees and organizers', () => {
    expect(new Attendees().add('MAILTO:a@b.c', { CN: 'A, B' }).toLines()).toEqual(['ATTENDEE;CN="A, B":MAILTO:a@b.c']);
    expect(new Organizer('MAILTO:a@b.c').toLine()).toBe('ORGANIZER:MAILTO:a@b.c');
  });
});
