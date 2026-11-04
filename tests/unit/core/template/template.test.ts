import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../../src/config/index.js';
import { Template, TemplateNotFoundError, markSafe } from '../../../../src/core/template/index.js';
import { Translator } from '../../../../src/core/translator/index.js';
import { HelperRegistry, type HelperInterface } from '../../../../src/foundation/helper.js';
import { createContainer } from '../../../../src/service-provider/index.js';
import { renderGolden } from '../../util/golden.js';

let root: string;
let views: string;
let plugins: string;

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

class UrlHelper implements HelperInterface {
  constructor(public readonly container: never) {}
  href(a: string): string {
    return `<a href="/?a=${a}">link</a>`;
  }
  count(): number {
    return 3;
  }
}
class TextHelper implements HelperInterface {
  constructor(public readonly container: never) {}
  e(v: string): string {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
}

function make(opts: { translator?: boolean } = {}): Template {
  const helpers = new HelperRegistry(undefined as never);
  helpers.register('url', UrlHelper as never).register('text', TextHelper as never);
  return new Template(helpers, {
    viewsDir: views,
    pluginsDir: plugins,
    translator: opts.translator ? () => Translator.getInstance() : undefined,
  });
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-tpl-'));
  views = path.join(root, 'views');
  plugins = path.join(root, 'plugins');
  write(path.join(views, 'task/show.njk'), '<h1>{{ title }}</h1>');
  write(path.join(views, 'layout.njk'), '<main>{% block content %}{% endblock %}</main>');
  write(path.join(views, 'page.njk'), '{% extends "layout" %}{% block content %}{% include "task/show" %}{% endblock %}');
  write(path.join(plugins, 'Myplugin/Template/task/show.njk'), '<h2>plugin {{ title }}</h2>');
  write(path.join(plugins, 'Myplugin/Template/page.njk'), '{% include "kanboard:task/show" %}|{% include "myplugin:task/show" %}');
  write(path.join(views, 'helpers.njk'), '{{ helper.url.href("x") }}|{{ url.href("y") }}|{{ text.e(v) }}|{{ url.count() === 3 }}');
  write(path.join(views, 'tr.njk'), "{{ t('Hello %s', name) }}|{{ 'Hi %s' | t(name) }}|{{ n(1234.5) }}");
  write(path.join(views, 'golden.njk'), '<ul>\n{% for i in items %}  <li>{{ i }}</li>\n{% endfor %}</ul>\n');
  write(path.join(root, 'fixtures/golden.html'), '<ul>\n  <li>a&lt;b</li>\n  <li>c</li>\n</ul>');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('Template resolution', () => {
  it('resolves core, kanboard: and plugin namespaces', () => {
    const t = make();
    expect(t.getTemplateFile('task/show')).toBe(path.join(views, 'task', 'show.njk'));
    expect(t.getTemplateFile('kanboard:task/show')).toBe(path.join(views, 'task', 'show.njk'));
    expect(t.getTemplateFile('myplugin:task/show')).toBe(path.join(plugins, 'Myplugin', 'Template', 'task', 'show.njk'));
  });

  it('rejects path traversal and missing templates', () => {
    const t = make();
    expect(() => t.getTemplateFile('../etc/passwd')).toThrow(TemplateNotFoundError);
    expect(() => t.getTemplateFile('../x:a')).toThrow(TemplateNotFoundError);
    expect(t.exists('nope/missing')).toBe(false);
    expect(() => t.render('nope/missing')).toThrow();
  });

  it('renders core and plugin templates, include and extends', () => {
    const t = make();
    expect(t.render('task/show', { title: 'A' })).toBe('<h1>A</h1>');
    expect(t.render('myplugin:task/show', { title: 'A' })).toBe('<h2>plugin A</h2>');
    expect(t.render('page', { title: 'P' })).toBe('<main><h1>P</h1></main>');
    expect(t.render('myplugin:page', { title: 'P' })).toBe('<h1>P</h1>|<h2>plugin P</h2>');
  });

  it('applies overrides for render, include and extends, even after caching', () => {
    const t = make();
    expect(t.render('page', { title: 'P' })).toBe('<main><h1>P</h1></main>');
    t.setTemplateOverride('task/show', 'myplugin:task/show');
    expect(t.render('task/show', { title: 'A' })).toBe('<h2>plugin A</h2>');
    expect(t.render('page', { title: 'P' })).toBe('<main><h2>plugin P</h2></main>');
  });
});

describe('Template escaping and helpers', () => {
  it('autoescapes variables and honours safe/raw/markSafe', () => {
    const t = make();
    expect(t.renderString('{{ v }}', { v: '<b>&' })).toBe('&lt;b&gt;&amp;');
    expect(t.renderString('{{ v | safe }}|{{ v | raw }}|{{ s }}', { v: '<b>', s: markSafe('<i>') })).toBe('<b>|<b>|<i>');
    expect(t.render('task/show', { title: '<script>' })).toBe('<h1>&lt;script&gt;</h1>');
  });

  it('exposes helpers as helper.x and top-level x, output as safe strings', () => {
    const t = make();
    expect(t.render('helpers', { v: '<' })).toBe('<a href="/?a=x">link</a>|<a href="/?a=y">link</a>|&lt;|true');
  });

  it('resolves helpers registered after construction and prefers render vars', () => {
    const helpers = new HelperRegistry(undefined as never);
    const t = new Template(helpers, { viewsDir: views, pluginsDir: plugins });
    expect(t.renderString('[{{ text }}]')).toBe('[]');
    helpers.register('text', TextHelper as never);
    expect(t.renderString('{{ text.e("<") }}')).toBe('&lt;');
    expect(t.renderString('{{ text }}', { text: 'var' })).toBe('var');
  });

  it('can leave helper output escaped', () => {
    const helpers = new HelperRegistry(undefined as never).register('url', UrlHelper as never);
    const t = new Template(helpers, { viewsDir: views, pluginsDir: plugins, safeHelperOutput: false });
    expect(t.renderString('{{ url.href("x") }}')).toContain('&lt;a');
  });

  it('matches a golden fixture', () => {
    const t = make();
    const { actual, expected } = renderGolden(t, 'golden', { items: ['a<b', 'c'] }, { fixtureDir: path.join(root, 'fixtures') });
    expect(actual).toBe(expected);
  });
});

describe('Template translation', () => {
  it('falls back without a translator', () => {
    const t = make();
    expect(t.render('tr', { name: 'Bob' })).toBe('Hello Bob|Hi Bob|1234.5');
  });

  it('delegates to the Translator', () => {
    Translator.unload();
    const t = make({ translator: true });
    expect(t.render('tr', { name: '<Bob>' })).toBe('Hello &lt;Bob&gt;|Hi &lt;Bob&gt;|1,234.50'.replace('1,234.50', t.renderString('{{ n(1234.5) }}')));
    expect(t.renderString("{{ tc('ctx', 'Yes') }}|{{ 1700000000 | dt('Y-m-d') }}|{{ dt('Y', 0) }}")).toBe('Yes|2023-11-14|1970');
  });

  it('is provided by the container', () => {
    const container = createContainer(loadConfig({ LOG_DRIVER: 'stdout' }, { rootDir: root }));
    const t = container.get('template');
    expect(t).toBe(container.get('template'));
    expect(t.getTemplateFile('myplugin:a')).toBe(path.join(root, 'plugins', 'Myplugin', 'Template', 'a.njk'));
  });
});
