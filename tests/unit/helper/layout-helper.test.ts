import { describe, expect, it, vi } from 'vitest';
import type { LayoutHelper } from '../../../src/helper/layout-helper.js';
import { helpers, makeContainer, setService } from './fixture.js';

async function setup(ajax = false) {
  const c = await makeContainer(true);
  const template = { render: vi.fn((name: string, params: Record<string, unknown> = {}) => `[${name}:${JSON.stringify(params)}]`) };
  setService(c, 'template', template);
  setService(c, 'request', { isAjax: () => ajax, getMethod: () => 'GET' });
  setService(c, 'projectUserRoleModel', { getActiveProjectsByUser: async () => ({ 1: 'P1', 2: 'P2' }) });
  return { c, template, h: helpers(c).get<LayoutHelper>('layout') };
}

describe('LayoutHelper', () => {
  it('app renders only the template for ajax requests', async () => {
    const { c, template, h } = await setup(true);
    expect(await h.app('t', { a: 1 })).toBe('[t:{"a":1,"is_ajax":true}]');
    expect(template.render).toHaveBeenCalledTimes(1);
    await c.get('db').close();
  });

  it('app wraps the template in the layout with the board selector', async () => {
    const { c, template, h } = await setup();
    c.get('hook').on('helper:layout:board-selector:list', ((list: Record<string, string>) => {
      list['9'] = 'Plugin';
    }) as never);
    const html = await h.app('t', { project: { id: 1 } });
    expect(template.render).toHaveBeenNthCalledWith(1, 't', { project: { id: 1 }, is_ajax: false, board_selector: { 2: 'P2', 9: 'Plugin' } });
    expect(html).toContain('[layout:');
    expect(html).toContain('"content_for_layout":"[t:');
    await c.get('db').close();
  });

  it('app skips the board selector with no_layout', async () => {
    const { c, template, h } = await setup();
    await h.app('t', { no_layout: true });
    expect(template.render.mock.calls[0]?.[1]).toEqual({ no_layout: true, is_ajax: false });
    await c.get('db').close();
  });

  it('project layout builds the title', async () => {
    const { c, template, h } = await setup(true);
    await h.project('t', { project: { name: 'P' } });
    expect(template.render.mock.calls[0]?.[1]).toMatchObject({ title: 'P' });
    await h.project('t', { project: { name: 'P' }, title: 'Sub' });
    expect(template.render.mock.calls[1]?.[1]).toMatchObject({ title: 'P &gt; Sub' });
    await h.project('t', { project: { name: 'P' }, title: 'P' });
    expect(template.render.mock.calls[2]?.[1]).toMatchObject({ title: 'P' });
    await c.get('db').close();
  });

  it('task, user, analytic, projectUser and dashboard layouts (non ajax goes through subLayout)', async () => {
    const { c, template, h } = await setup();
    const html = await h.task('t', { task: { id: 3, title: 'T', project_name: 'PN' } });
    expect(template.render.mock.calls[0]).toEqual(['t', { task: { id: 3, title: 'T', project_name: 'PN' }, page_title: 'PN, #3 - T', title: 'PN', is_ajax: false }]);
    expect(template.render.mock.calls[1]?.[0]).toBe('task/layout');
    expect(template.render.mock.calls[1]?.[1]).toMatchObject({ content_for_sublayout: expect.stringContaining('[t:'), sidebar_template: 'task/sidebar' });
    expect(html).toContain('[layout:');

    template.render.mockClear();
    await h.user('t', { user: { id: 2, name: '', username: 'bob' } });
    expect(template.render.mock.calls[0]?.[1]).toMatchObject({ title: '#2 bob' });
    template.render.mockClear();
    await h.analytic('t', { project: { name: 'P' }, title: 'A' });
    expect(template.render.mock.calls[0]?.[1]).toMatchObject({ title: 'P &gt; A' });
    template.render.mockClear();
    await h.projectUser('t', { user_id: 4 });
    expect(template.render.mock.calls[0]?.[1]).toMatchObject({ filter: { user_id: 4 } });
    await h.dashboard('t', {});
    await h.plugin('t', {});
    await c.get('db').close();
  });

  it('config layout loads the settings and defaults the errors', async () => {
    const { c, template, h } = await setup(true);
    await h.config('t', {});
    const params = template.render.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(params['errors']).toEqual({});
    expect(params['values']).toBeTypeOf('object');
    await h.config('t', { values: { a: 1 }, errors: { x: ['y'] } });
    expect(template.render.mock.calls[1]?.[1]).toMatchObject({ values: { a: 1 }, errors: { x: ['y'] } });
    await c.get('db').close();
  });

  it('pageLayout keeps an existing content_for_layout', async () => {
    const { c, template, h } = await setup();
    h.pageLayout('t', { content_for_layout: 'mine' }, 'other');
    expect(template.render).toHaveBeenLastCalledWith('other', { content_for_layout: 'mine' });
    await c.get('db').close();
  });
});
