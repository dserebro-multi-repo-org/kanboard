import { describe, expect, it } from 'vitest';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import { phpDate } from '../../../src/core/php-date.js';
import { ROLE } from '../../../src/foundation/formatter-collaborators.js';
import {
  GroupAutoCompleteFormatter,
  ProjectActivityEventFormatter,
  ProjectApiFormatter,
  ProjectsApiFormatter,
  SubtaskTimeTrackingCalendarFormatter,
  TaskApiFormatter,
  TasksApiFormatter,
  UserAutoCompleteFormatter,
  UserMentionFormatter,
} from '../../../src/formatter/index.js';
import { createTestContainer, type LooseContainer } from '../support/m6-container.js';

const queryOf = (rows: unknown[]): FilterQuery => ({ findAll: async () => rows }) as unknown as FilterQuery;

describe('UserMentionFormatter', () => {
  it('renders the avatar and the escaped names', async () => {
    const container = createTestContainer();
    const users = [
      { id: 1, username: 'someone', name: 'Someone', email: 'test@localhost', avatar_path: 'avatar_image' },
      { id: 2, username: 'some<body>', name: '', email: '', avatar_path: '' },
    ];

    const result = await new UserMentionFormatter(container).withUsers(users).format();
    expect(result).toStrictEqual([
      {
        value: 'someone',
        html: '<avatar id="1" user="someone" class="avatar-inline"> someone <small aria-hidden="true">Someone</small>',
      },
      { value: 'some<body>', html: '<avatar id="2" user="some<body>" class="avatar-inline"> some&lt;body&gt;' },
    ]);
  });
});

describe('autocomplete formatters', () => {
  it('formats users', async () => {
    const container = createTestContainer();
    const provider = (name: string) => ({
      getInternalId: () => 1,
      getExternalId: () => 'ext',
      getExternalIdColumn: () => 'gitlab_id',
      getUsername: () => 'user',
      getName: () => name,
    });
    const result = await new UserAutoCompleteFormatter(container).withUsers([provider('John'), provider('')]).format();
    expect(result).toEqual([
      { id: 1, username: 'user', external_id: 'ext', external_id_column: 'gitlab_id', value: 'John', label: 'John (user)' },
      { id: 1, username: 'user', external_id: 'ext', external_id_column: 'gitlab_id', value: 'user', label: 'user' },
    ]);
  });

  it('formats groups', async () => {
    const container = createTestContainer();
    const group = { getInternalId: () => 3, getExternalId: () => 'cn=x', getName: () => 'Group' };
    expect(await new GroupAutoCompleteFormatter(container).withGroups([group]).format()).toEqual([
      { id: 3, external_id: 'cn=x', value: 'Group', label: 'Group' },
    ]);
  });
});

describe('API formatters', () => {
  it('adds the urls to a project', async () => {
    const container = createTestContainer();
    const project = { id: 7, is_public: 0, token: '' };
    const result = await new ProjectApiFormatter(container).withProject({ ...project }).format();
    expect(result!['url']).toEqual({
      board: 'http://kb/?controller=BoardViewController&action=show&project_id=7',
      list: 'http://kb/?controller=TaskListController&action=show&project_id=7',
    });
  });

  it('adds the public urls when the project is public', async () => {
    const container = createTestContainer();
    const result = await new ProjectApiFormatter(container).withProject({ id: 7, is_public: 1, token: 'abc' }).format();
    expect(result!['url']).toMatchObject({
      public_board: 'http://kb/?controller=BoardViewController&action=readonly&token=abc',
      rss_feed: 'http://kb/?controller=FeedController&action=project&token=abc',
      ical_feed: 'http://kb/?controller=ICalendarController&action=project&token=abc',
    });
  });

  it('returns null for a missing project and task', async () => {
    const container = createTestContainer();
    expect(await new ProjectApiFormatter(container).withProject(false).format()).toBeNull();
    expect(await new TaskApiFormatter(container).withTask(null).format()).toBeNull();
    expect(await new ProjectsApiFormatter(container).format()).toEqual([]);
    expect(await new TasksApiFormatter(container).format()).toEqual([]);
  });

  it('formats lists of projects', async () => {
    const container = createTestContainer();
    const result = await new ProjectsApiFormatter(container).withProjects([{ id: 1 }, { id: 2 }]).format();
    expect(result.map((p) => (p!['url'] as Record<string, string>)['board'])).toEqual([
      'http://kb/?controller=BoardViewController&action=show&project_id=1',
      'http://kb/?controller=BoardViewController&action=show&project_id=2',
    ]);
  });

  it('adds url and color to tasks', async () => {
    const container = createTestContainer();
    container.set('colorModel', { getColorProperties: (id: string) => ({ name: id, background: '#fff' }) });
    const result = await new TasksApiFormatter(container).withTasks([{ id: 5, color_id: 'blue' }]).format();
    expect(result).toEqual([
      { id: 5, color_id: 'blue', url: 'http://kb/?controller=TaskViewController&action=show&task_id=5', color: { name: 'blue', background: '#fff' } },
    ]);
  });
});

describe('SubtaskTimeTrackingCalendarFormatter', () => {
  it('builds calendar events', async () => {
    const container = createTestContainer();
    container.set('colorModel', { getBackgroundColor: (id: string) => `bg-${id}`, getBorderColor: (id: string) => `border-${id}` });
    const rows = [
      { id: 1, subtask_id: 2, task_id: 3, subtask_title: 'Sub', start: 1_700_000_000, end: 1_700_003_600, color_id: 'red', username: 'jdoe', user_fullname: 'John' },
      { id: 2, subtask_id: 4, task_id: 5, subtask_title: 'Other', start: 1_700_000_000, end: 0, color_id: 'blue' },
    ];

    const events = await new SubtaskTimeTrackingCalendarFormatter(container).withQuery(queryOf(rows)).format();

    expect(events[0]).toEqual({
      id: 1,
      subtask_id: 2,
      title: '#3 Sub (John)',
      start: phpDate('Y-m-d\\TH:i:s', 1_700_000_000),
      end: phpDate('Y-m-d\\TH:i:s', 1_700_003_600),
      backgroundColor: 'bg-red',
      borderColor: 'border-red',
      textColor: 'black',
      url: '?controller=TaskViewController&action=show&task_id=3',
      editable: false,
    });
    expect(events[1]!['title']).toBe('#5 Other');
    expect(String(events[1]!['end'])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe('ProjectActivityEventFormatter', () => {
  function setup(role: string): LooseContainer {
    const container = createTestContainer();
    container.set('userSession', { getId: () => 1, getRole: () => role });
    container.set('notificationModel', {
      getTitleWithAuthor: (author: string, eventName: string) => `${author} did ${eventName}`,
    });
    container.set('template', { render: (name: string, params: { event_name: string }) => `${name}:${params.event_name}` });
    return container;
  }

  const rows = () => [
    { id: 1, event_name: 'task.create', author_name: 'John', author_username: 'jdoe', data: JSON.stringify({ task: { id: 1 } }) },
    { id: 2, event_name: 'comment.create', author_name: '', author_username: 'jane', data: JSON.stringify({ comment: { visibility: ROLE.APP_ADMIN } }) },
    { id: 3, event_name: 'comment.create', author_name: '', author_username: 'bob', data: JSON.stringify({ comment: { visibility: ROLE.APP_USER } }) },
    { id: 4, event_name: 'task.update', author_name: '', author_username: 'x', data: 'a:1:{s:1:"a";}' },
    { id: 5, event_name: 'task.update', author_name: '', author_username: 'x', data: '{broken' },
    { id: 6, event_name: 'task.update', author_name: '', author_username: 'x', data: '[]' },
  ];

  it('decodes, titles and renders the events and skips invalid payloads', async () => {
    const result = await new ProjectActivityEventFormatter(setup(ROLE.APP_ADMIN)).withQuery(queryOf(rows())).format();

    expect(result.map((e) => e['id'])).toEqual([1, 2, 3]);
    expect(result[0]).toMatchObject({
      author: 'John',
      event_title: 'John did task.create',
      event_content: 'event/task_create:task.create',
      task: { id: 1 },
    });
    expect(result[0]).not.toHaveProperty('data');
    expect(result[1]!['author']).toBe('jane');
  });

  it('hides the restricted comments from simple users', async () => {
    const result = await new ProjectActivityEventFormatter(setup(ROLE.APP_USER)).withQuery(queryOf(rows())).format();
    expect(result.map((e) => e['id'])).toEqual([1, 3]);
  });

  it('hides the admin comments from managers', async () => {
    const result = await new ProjectActivityEventFormatter(setup(ROLE.APP_MANAGER)).withQuery(queryOf(rows())).format();
    expect(result.map((e) => e['id'])).toEqual([1, 3]);
  });

  it('keeps the values of the row when the payload has the same keys', async () => {
    const data = JSON.stringify({ id: 99, extra: 'yes' });
    const result = await new ProjectActivityEventFormatter(setup(ROLE.APP_ADMIN))
      .withQuery(queryOf([{ id: 1, event_name: 'a.b', author_name: 'n', author_username: 'u', data }]))
      .format();
    expect(result[0]).toMatchObject({ id: 1, extra: 'yes' });
  });
});
