import { describe, expect, it } from 'vitest';
import type { UrlHelper } from '../../../src/helper/url-helper.js';
import { helpers, makeContainer, setService } from './fixture.js';

describe('UrlHelper', () => {
  it('plugin link', async () => {
    const c = await makeContainer();
    const h = helpers(c).get<UrlHelper>('url');
    expect(h.link('label', 'a', 'b', { d: 'e', plugin: 'something' }, false, 'f', 'g', true)).toBe(
      `<a href="?controller=a&amp;action=b&amp;d=e&amp;plugin=something" class="f" title='g' target="_blank">label</a>`,
    );
  });

  it('plugin link with route defined', async () => {
    const c = await makeContainer();
    c.get('route').enable();
    c.get('route').addRoute('/myplugin/something/:d', 'a', 'b', 'something');
    const h = helpers(c).get<UrlHelper>('url');
    expect(h.link('label', 'a', 'b', { d: 'e', plugin: 'something' }, false, 'f', 'g', true)).toBe(
      `<a href="myplugin/something/e" class="f" title='g' target="_blank">label</a>`,
    );
  });

  it('app link, href and to', async () => {
    const h = helpers(await makeContainer()).get<UrlHelper>('url');
    expect(h.link('label', 'a', 'b', { d: 'e' }, false, 'f', 'g', true)).toBe(`<a href="?controller=a&amp;action=b&amp;d=e" class="f" title='g' target="_blank">label</a>`);
    expect(h.link('l', 'a', 'b')).toBe(`<a href="?controller=a&amp;action=b" class="" title='' >l</a>`);
    expect(h.href('a', 'b', { d: 'e' })).toBe('?controller=a&amp;action=b&amp;d=e');
    expect(h.to('a', 'b', { d: 'e' })).toBe('?controller=a&action=b&d=e');
    expect(h.to('a', 'b', { q: 'a b&c' }, 'top')).toBe('?controller=a&action=b&q=a+b%26c#top');
  });

  it('adds the csrf token and the anchor', async () => {
    const c = await makeContainer();
    setService(c, 'token', { getCSRFToken: () => 'tok' });
    const h = helpers(c).get<UrlHelper>('url');
    expect(h.href('a', 'b', {}, true, 'x')).toBe('?controller=a&amp;action=b&amp;csrf_token=tok#x');
  });

  it('button, icon, doc and absolute link', async () => {
    const c = await makeContainer();
    const h = helpers(c).get<UrlHelper>('url');
    expect(h.button('plus', 'Add', 'a', 'b', {}, 'x')).toBe(`<a href="?controller=a&amp;action=b" class="btn x" title='' ><i class="fa fa-plus fa-fw"></i> Add</a>`);
    expect(h.icon('plus', 'Add', 'a', 'b')).toBe(
      `<a href="?controller=a&amp;action=b" class="" title='' ><i class="fa fa-fw fa-plus" aria-hidden="true"></i>Add</a>`,
    );
    expect(h.doc('Help', 'file.markdown')).toBe(`<a href="${c.get('config').DOCUMENTATION_URL_PATTERN.replace('%s', 'file.markdown')}" target="_blank">Help</a>`);
    expect(h.absoluteLink('L', 'a', 'b')).toBe(`<a href="http://localhost/?controller=a&amp;action=b" class="" title='' target="_blank">L</a>`);
  });

  it('dir', async () => {
    const c = await makeContainer();
    setService(c, 'request', { isAjax: () => false, getMethod: () => 'GET', getServerVariable: () => '/kanboard/index.php' });
    expect(helpers(c).get<UrlHelper>('url').dir()).toBe('/kanboard/');

    const c2 = await makeContainer();
    setService(c2, 'request', { isAjax: () => false, getMethod: () => 'GET', getServerVariable: () => '/index.php' });
    expect(helpers(c2).get<UrlHelper>('url').dir()).toBe('/');

    const c3 = await makeContainer();
    expect(helpers(c3).get<UrlHelper>('url').dir()).toBe('');
  });

  it('base reads application_url from the settings', async () => {
    const c = await makeContainer(true);
    const h = helpers(c).get<UrlHelper>('url');
    expect(await h.loadBase()).toBe('http://localhost/');
    expect(h.base()).toBe('http://localhost/');

    await c.get('configModel').save({ application_url: 'https://mykanboard/' });
    c.get('memoryCache').flush();
    expect(await h.loadBase()).toBe('https://mykanboard/');
    expect(h.base()).toBe('https://mykanboard/');
    expect(h.to('a', 'b', {}, '', true)).toBe('https://mykanboard/?controller=a&action=b');
    await c.get('db').close();
  });
});
