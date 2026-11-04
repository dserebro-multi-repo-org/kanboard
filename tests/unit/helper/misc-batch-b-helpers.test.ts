import { describe, expect, it } from 'vitest';
import type { AvatarHelper } from '../../../src/helper/avatar-helper.js';
import type { BoardHelper } from '../../../src/helper/board-helper.js';
import type { CommentHelper } from '../../../src/helper/comment-helper.js';
import type { ProjectActivityHelper } from '../../../src/helper/project-activity-helper.js';
import type { ProjectHeaderHelper } from '../../../src/helper/project-header-helper.js';
import {
  ProjectActivityProjectIdFilter,
  ProjectActivityProjectIdsFilter,
  ProjectActivityTaskIdFilter,
  Role,
  convertPhpSizeToBytes,
  empty,
  getUploadMaxSize,
  isValidUrl,
  looseEq,
  range,
} from '../../../src/helper/batch-b-support.js';
import { registerBatchBHelpers } from '../../../src/helper/batch-b.js';
import { HelperRegistry } from '../../../src/foundation/helper.js';
import { makeBatchBContainer } from './batch-b-fixture.js';
import { helpers, setService } from './fixture.js';

describe('registerBatchBHelpers', () => {
  it('registers the PHP names', async () => {
    const { container } = await makeBatchBContainer();
    const registry = registerBatchBHelpers(new HelperRegistry(container));
    expect(registry.names().sort()).toEqual(['avatar', 'board', 'comment', 'dt', 'projectActivity', 'projectHeader', 'projectRole', 'subtask', 'task', 'user']);
    expect(helpers(container).has('user')).toBe(true);
    expect(helpers(container).has('projectRole')).toBe(true);
  });
});

describe('BoardHelper and CommentHelper', () => {
  it('isCollapsed', async () => {
    const { container, state } = await makeBatchBContainer();
    const h = helpers(container).get<BoardHelper>('board');
    expect(await h.isCollapsed(1)).toBe(false);
    state.metadata.set('board.collapsed.1', '1');
    state.metadata.set('board.collapsed.2', '0');
    expect(await h.isCollapsed(1)).toBe(true);
    expect(await h.isCollapsed(2)).toBe(false);
  });

  it('toggleSorting', async () => {
    const { container, state } = await makeBatchBContainer();
    const h = helpers(container).get<CommentHelper>('comment');
    await h.toggleSorting();
    expect(state.metadata.get('comment.sorting.direction')).toBe('DESC');
    await h.toggleSorting();
    expect(state.metadata.get('comment.sorting.direction')).toBe('ASC');
  });
});

describe('AvatarHelper', () => {
  it('renders default and user avatars', async () => {
    const { container, state } = await makeBatchBContainer();
    const calls: unknown[][] = [];
    setService(container, 'avatarManager', {
      render: (...args: unknown[]) => (calls.push(args), '<img>'),
      renderDefault: (size: number) => `<default ${size}>`,
    });
    const h = helpers(container).get<AvatarHelper>('avatar');
    expect(h.render(0, '', 'n', 'e', '')).toBe('<div class="avatar avatar-48 avatar-left"><default 48></div>');
    expect(h.render(1, 'bob', 'Bob', 'b@x', 'p', 'css', 30)).toBe('<div class="avatar avatar-30 css"><img></div>');
    expect(calls[0]).toEqual([1, 'bob', 'Bob', 'b@x', 'p', 30]);
    expect(h.small(0, '', '', '', '')).toBe('<div class="avatar avatar-20 "><default 20></div>');

    state.user = { id: 4, role: Role.APP_USER, username: 'u', name: 'N', email: 'e', avatar_path: 'ap' };
    expect(h.currentUserSmall('x')).toBe('<div class="avatar avatar-20 x"><img></div>');
    expect(calls[1]).toEqual([4, 'u', 'N', 'e', 'ap', 20]);
  });
});

describe('ProjectActivityHelper', () => {
  function builder() {
    const log: { filter: unknown[]; desc: string[]; limit: number[]; formatter: unknown[] } = { filter: [], desc: [], limit: [], formatter: [] };
    const query = {
      desc: (c: string) => (log.desc.push(c), query),
      limit: (n: number) => (log.limit.push(n), query),
    };
    const qb = {
      withFilter: (f: unknown) => (log.filter.push(f), qb),
      getQuery: () => query,
      format: (f: unknown) => (log.formatter.push(f), [{ task_id: 3, event_title: 't' }]),
    };
    return { qb, log };
  }

  it('getProjectEvents / getProjectsEvents / getTaskEvents', async () => {
    const { container } = await makeBatchBContainer();
    const { qb, log } = builder();
    const formatter = {};
    setService(container, 'projectActivityQuery', qb);
    setService(container, 'projectActivityEventFormatter', formatter);
    const h = helpers(container).get<ProjectActivityHelper>('projectActivity');

    expect(await h.getProjectEvents(1)).toEqual([{ task_id: 3, event_title: 't' }]);
    expect(log.filter[0]).toEqual(new ProjectActivityProjectIdFilter(1));
    expect(log.desc[0]).toBe('project_activities.id');
    expect(log.limit[0]).toBe(50);
    expect(log.formatter[0]).toBe(formatter);

    await h.getProjectsEvents([1, 2], 10);
    expect(log.filter[1]).toEqual(new ProjectActivityProjectIdsFilter([1, 2]));
    expect(log.limit[1]).toBe(10);

    await h.getTaskEvents(5);
    expect(log.filter[2]).toEqual(new ProjectActivityTaskIdFilter(5));
    expect(log.limit).toHaveLength(2);
    expect(log.desc).toHaveLength(3);
  });

  it('searchEvents restricts the search to the active projects of the user', async () => {
    const { container, state } = await makeBatchBContainer();
    state.user = { id: 2, role: Role.APP_USER };
    const { qb, log } = builder();
    const searched: string[] = [];
    setService(container, 'projectActivityLexer', { build: (s: string) => (searched.push(s), qb) });
    const h = helpers(container).get<ProjectActivityHelper>('projectActivity');

    expect(await h.searchEvents('')).toEqual([]);
    expect(searched).toEqual([]);

    expect(await h.searchEvents('foo')).toHaveLength(1);
    expect(searched).toEqual(['foo']);
    expect(log.filter[0]).toEqual(new ProjectActivityProjectIdsFilter(['1', '3']));
    expect(log.limit).toEqual([500]);
  });
});

describe('ProjectHeaderHelper', () => {
  it('getSearchQuery keeps the filter in the session and url-decodes it', async () => {
    const { container } = await makeBatchBContainer();
    const store: Record<string, string> = {};
    setService(container, 'userSession', {
      getId: () => 1,
      getFilters: (id: number) => store[id] ?? 'status:open',
      setFilters: (id: number, v: string) => void (store[id] = v),
    });
    setService(container, 'request', { getStringParam: (_n: string, d: string) => (store.override ?? d) });
    const h = helpers(container).get<ProjectHeaderHelper>('projectHeader');

    expect(h.getSearchQuery({ id: 1 })).toBe('status:open');
    expect(store[1]).toBe('status:open');
    store.override = 'title%3A%22a%20b%22%zz';
    expect(h.getSearchQuery({ id: 1 })).toBe('title:"a b"%zz');
    expect(store[1]).toBe('title%3A%22a%20b%22%zz');
  });

  it('render passes the header variables to the template', async () => {
    const { container, state } = await makeBatchBContainer();
    state.user = { id: 3, role: Role.APP_USER };
    let rendered: { name: string; vars: Record<string, unknown> } | null = null;
    setService(container, 'template', { render: (name: string, vars: Record<string, unknown>) => ((rendered = { name, vars }), '<header>') });
    setService(container, 'categoryModel', { getList: () => ({ 1: 'c' }) });
    setService(container, 'customFilterModel', { getAll: (p: number, u: number) => [{ p, u }] });
    const h = helpers(container).get<ProjectHeaderHelper>('projectHeader');

    expect(await h.render({ id: 8 }, 'BoardViewController', 'show', true, 'plug')).toBe('<header>');
    expect(rendered).not.toBeNull();
    const { name, vars } = rendered as unknown as { name: string; vars: Record<string, unknown> };
    expect(name).toBe('project_header/header');
    expect(vars.filters).toEqual({ controller: 'BoardViewController', action: 'show', project_id: 8, search: 'status:open', plugin: 'plug' });
    expect(vars.categories_list).toEqual({ 1: 'c' });
    expect(vars.users_list).toEqual({ 0: 'Unassigned', 2: 'user' });
    expect(vars.custom_filters_list).toEqual([{ p: 8, u: 3 }]);
    expect(vars.board_view).toBe(true);
  });

  it('getDescription', async () => {
    const { container } = await makeBatchBContainer();
    setService(container, 'markdown', { render: (text: string) => `<p>${text}</p>` });
    const h = helpers(container).get<ProjectHeaderHelper>('projectHeader');

    const noOwner = h.getDescription({ owner_id: 0, description: 'desc' });
    expect(noOwner).not.toContain('Project owner');
    expect(h.getDescription({ owner_id: 0, description: '' })).toBe(h.getDescription({ owner_id: 0 }));

    const withOwner = h.getDescription({ owner_id: 2, owner_name: '', owner_username: 'bob<', description: 'desc' });
    expect(withOwner.startsWith('Project owner: <strong>bob&lt;</strong>\n\n<hr>\n\n')).toBe(true);

    const noDescription = h.getDescription({ owner_id: 2, owner_name: 'Bob', owner_username: 'bob', description: '' });
    expect(noDescription).toBe('Project owner: <strong>Bob</strong>\n\n');
  });
});

describe('PHP semantic utilities', () => {
  it('empty / looseEq / range', () => {
    expect([0, '0', '', null, undefined, false, [], {}].every(empty)).toBe(true);
    expect(['a', 1, '00', [0], { a: 1 }].some(empty)).toBe(false);
    expect(looseEq('1', 1)).toBe(true);
    expect(looseEq('abc', 0)).toBe(false);
    expect(looseEq(null, 0)).toBe(true);
    expect(looseEq(1, true)).toBe(true);
    expect(range('5', '1')).toEqual([5, 4, 3, 2, 1]);
    expect(range(1, 3)).toEqual([1, 2, 3]);
    expect(range(2, 2)).toEqual([2]);
  });

  it('isValidUrl mirrors FILTER_VALIDATE_URL', () => {
    expect(isValidUrl('https://kanboard.org/doc?a=1#x')).toBe(true);
    expect(isValidUrl('http://localhost:8080')).toBe(true);
    expect(isValidUrl('mailto:me@example.org')).toBe(true);
    expect(isValidUrl('ABC-123')).toBe(false);
    expect(isValidUrl('http://')).toBe(false);
    expect(isValidUrl('http://exa mple.org')).toBe(false);
    expect(isValidUrl('//example.org')).toBe(false);
  });

  it('upload size helpers', () => {
    expect(convertPhpSizeToBytes('2M')).toBe(2 * 1024 * 1024);
    expect(convertPhpSizeToBytes('1G')).toBe(1024 ** 3);
    expect(convertPhpSizeToBytes('512K')).toBe(512 * 1024);
    expect(getUploadMaxSize({})).toBe(2 * 1024 * 1024);
    expect(getUploadMaxSize({ UPLOAD_MAX_FILESIZE: '16M', POST_MAX_SIZE: '8M' })).toBe(8 * 1024 * 1024);
    expect(getUploadMaxSize({ UPLOAD_MAX_FILESIZE: '0', POST_MAX_SIZE: '8M' })).toBe(8 * 1024 * 1024);
    expect(getUploadMaxSize({ UPLOAD_MAX_FILESIZE: '3M', POST_MAX_SIZE: '0' })).toBe(3 * 1024 * 1024);
  });
});
