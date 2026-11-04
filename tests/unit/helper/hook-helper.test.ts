import { describe, expect, it, vi } from 'vitest';
import type { HookHelper } from '../../../src/helper/hook-helper.js';
import { helpers, makeContainer, setService } from './fixture.js';

async function setup(render: (name: string, params?: Record<string, unknown>) => string) {
  const c = await makeContainer();
  const template = { render: vi.fn(render) };
  setService(c, 'template', template);
  return { c, template, h: helpers(c).get<HookHelper>('hook') };
}

describe('HookHelper', () => {
  it('attachCallable merges the callable result', async () => {
    const { template, h } = await setup(() => 'tpl1_content');
    h.attachCallable('test', 'tpl1', () => ({ k1: 'v1' }));
    expect(h.render('test', { k0: 'v0' })).toBe('tpl1_content');
    expect(template.render).toHaveBeenCalledTimes(1);
    expect(template.render).toHaveBeenCalledWith('tpl1', { k0: 'v0', k1: 'v1' });
  });

  it('attachCallable with no result', async () => {
    const { template, h } = await setup(() => 'tpl1_content');
    h.attachCallable('test', 'tpl1', () => undefined);
    expect(h.render('test', { k0: 'v0' })).toBe('tpl1_content');
    expect(template.render).toHaveBeenCalledWith('tpl1', { k0: 'v0' });
  });

  it('attachCallable receives the variable values', async () => {
    const { h } = await setup(() => '');
    const seen: unknown[] = [];
    h.attachCallable('test', 'tpl1', (...args) => {
      seen.push(...args);
    });
    h.render('test', { a: 1, b: 2 });
    expect(seen).toEqual([1, 2]);
  });

  it('attach local variables', async () => {
    const { template, h } = await setup(() => 'tpl1_content');
    h.attach('test', 'tpl1', { k1: 'v1' });
    expect(h.render('test', { k0: 'v0' })).toBe('tpl1_content');
    expect(template.render).toHaveBeenCalledWith('tpl1', { k0: 'v0', k1: 'v1' });
  });

  it('multiple hooks are concatenated', async () => {
    const { h } = await setup((name) => `${name}_content`);
    h.attach('test', 'tpl1').attach('test', 'tpl2');
    expect(h.render('test')).toBe('tpl1_contenttpl2_content');
    expect(h.render('unknown')).toBe('');
  });

  it('asset hooks', async () => {
    const { c, h } = await setup(() => '');
    const asset = { css: vi.fn(() => '<link rel="stylesheet" href="skin.css"></link>'), js: vi.fn(() => '<script src="skin.js"></script>') };
    helpers(c).set('asset', { container: c, ...asset });
    h.attach('test1', 'skin.css');
    h.attach('test2', 'skin.js');

    expect(h.asset('css', 'test1')).toContain('<link rel="stylesheet" href="skin.css"></link>');
    expect(h.asset('js', 'test2')).toContain('<script src="skin.js"></script>');
    expect(asset.css).toHaveBeenCalledWith('skin.css');
    expect(asset.js).toHaveBeenCalledWith('skin.js');
  });
});
