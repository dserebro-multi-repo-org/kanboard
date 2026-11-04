import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppHelper } from '../../../src/helper/app-helper.js';
import type { AssetHelper } from '../../../src/helper/asset-helper.js';
import type { FileHelper } from '../../../src/helper/file-helper.js';
import type { MailHelper } from '../../../src/helper/mail-helper.js';
import type { ModelHelper } from '../../../src/helper/model-helper.js';
import { FlashMessageStub } from '../../../src/foundation/helper-collaborators.js';
import { helpers, makeContainer, setService } from './fixture.js';

describe('AppHelper', () => {
  it('language, timezone and js formats', async () => {
    const h = helpers(await makeContainer()).get<AppHelper>('app');
    expect(h.jsLang()).toBe('en');
    expect(h.isRtlLanguage()).toBe(false);
    expect(h.getTimezone()).toBe('UTC');
    expect(h.getJsDateFormat()).toBe('mm/dd/yy');
    expect(h.getJsTimeFormat()).toBe('HH:mm');
  });

  it('flash message', async () => {
    const c = await makeContainer();
    const flash = new FlashMessageStub();
    setService(c, 'flash', flash);
    const h = helpers(c).get<AppHelper>('app');

    expect(h.flashMessage()).toBe('');
    flash.success('test & test');
    expect(h.flashMessage()).toBe('<div class="alert alert-success alert-fade-out">test &amp; test</div>');
    expect(h.flashMessage()).toBe('');
    flash.failure('test & test');
    expect(h.flashMessage()).toBe('<div class="alert alert-error">test &amp; test</div>');
    expect(h.flashMessage()).toBe('');
  });

  it('component and tooltips', async () => {
    const h = helpers(await makeContainer()).get<AppHelper>('app');
    expect(h.component('x', { a: "it's", b: 'a/b', c: 'é' })).toBe(`<div class="js-x" data-params='{"a":"it\\u0027s","b":"a\\/b","c":"\\u00e9"}'></div>`);
    expect(h.component('x')).toBe(`<div class="js-x" data-params='[]'></div>`);
    expect(h.tooltipHTML('<b>x</b>')).toBe('<span class="tooltip"><i class="fa fa-info-circle"></i><script type="text/template"><div class="markdown"><b>x</b></div></script></span>');
    expect(h.tooltipMarkdown('x', 'fa-x')).toBe('<span class="tooltip"><i class="fa fa-x"></i><script type="text/template"><div class="markdown"><p>x</p></div></script></span>');
    expect(h.tooltipLink('L', '/u')).toBe('<span class="tooltip" data-href="/u">L</span>');
  });

  it('menu selection uses the router', async () => {
    const c = await makeContainer();
    setService(c, 'router', { getPlugin: () => 'P', getController: () => 'BoardViewController', getAction: () => 'show' });
    const h = helpers(c).get<AppHelper>('app');
    expect(h.checkMenuSelection('boardviewcontroller')).toBe('class="active"');
    expect(h.checkMenuSelection('BoardViewController', 'show', 'p')).toBe('class="active"');
    expect(h.checkMenuSelection('BoardViewController', 'other')).toBe('');
    expect(h.checkMenuSelection('BoardViewController', 'show', 'q')).toBe('');
    expect(h.checkMenuSelection('x')).toBe('');
    expect(h.getPluginName()).toBe('P');
  });

  it('isAjax, token and config', async () => {
    const c = await makeContainer(true);
    setService(c, 'request', { isAjax: () => true, getMethod: () => 'GET' });
    setService(c, 'token', { getCSRFToken: () => 't' });
    const h = helpers(c).get<AppHelper>('app');
    expect(h.isAjax()).toBe(true);
    expect(h.getToken().getCSRFToken()).toBe('t');
    expect(await h.config('missing', 'dflt')).toBe('dflt');
    await c.get('configModel').save({ application_language: 'fr_FR' });
    c.get('memoryCache').flush();
    expect(await h.config('application_language')).toBe('fr_FR');
    await c.get('db').close();
  });
});

describe('AssetHelper', () => {
  it('custom css', async () => {
    const c = await makeContainer(true);
    const h = helpers(c).get<AssetHelper>('asset');
    expect(await h.customCss()).toBe('');
    await c.get('configModel').save({ application_stylesheet: 'p { color: red }' });
    c.get('memoryCache').flush();
    expect(await h.customCss()).toBe('<style>p { color: red }</style>');
    expect(h.colorCss()).toBe('<style></style>');
    await c.get('db').close();
  });

  it('js and css with the file modification time', async () => {
    const h = helpers(await makeContainer()).get<AssetHelper>('asset');
    const dir = mkdtempSync(path.join(tmpdir(), 'kb-asset-'));
    writeFileSync(path.join(dir, 'app.js'), '');
    utimesSync(path.join(dir, 'app.js'), 1000000, 1000000);
    h.rootDir = dir;
    expect(h.js('app.js')).toBe('<script  defer type="text/javascript" src="app.js?1000000"></script>');
    expect(h.js('app.js', true)).toBe('<script async defer type="text/javascript" src="app.js?1000000"></script>');
    expect(h.css('app.js')).toBe('<link rel="stylesheet" href="app.js?1000000" media="screen">');
    expect(h.css('x.css', false, 'print')).toBe('<link rel="stylesheet" href="x.css" media="print">');
    expect(h.css('missing.css')).toBe('<link rel="stylesheet" href="missing.css?" media="screen">');
  });
});

describe('MailHelper', () => {
  it('filters the subject', async () => {
    const h = helpers(await makeContainer()).get<MailHelper>('mail');
    expect(h.filterSubject('Test')).toBe('Test');
    expect(h.filterSubject('RE: Test')).toBe('Test');
    expect(h.filterSubject('re: FW: Test')).toBe('Test');
    expect(h.filterSubject('Fwd: Test')).toBe('Test');
  });

  it('sender address and transport', async () => {
    const c = await makeContainer(true);
    const h = helpers(c).get<MailHelper>('mail');
    const config = c.get('config');
    expect(await h.getMailSenderAddress()).toBe(config.MAIL_FROM);
    expect(await h.getMailTransport()).toBe(config.MAIL_TRANSPORT);

    await c.get('configModel').save({ mail_sender_address: 'me@here', mail_transport: 'smtp' });
    c.get('memoryCache').flush();
    expect(await h.getMailSenderAddress()).toBe(config.MAIL_CONFIGURATION ? 'me@here' : config.MAIL_FROM);
    expect(await h.getMailTransport()).toBe(config.MAIL_CONFIGURATION ? 'smtp' : config.MAIL_TRANSPORT);
    await c.get('db').close();
  });

  it('ignores the settings when MAIL_CONFIGURATION is off', async () => {
    const c = await makeContainer(true, { MAIL_CONFIGURATION: 'false' });
    await c.get('configModel').save({ mail_sender_address: 'me@here', mail_transport: 'smtp' });
    const h = helpers(c).get<MailHelper>('mail');
    expect(await h.getMailSenderAddress()).toBe(c.get('config').MAIL_FROM);
    expect(await h.getMailTransport()).toBe(c.get('config').MAIL_TRANSPORT);
    await c.get('db').close();
  });
});

describe('FileHelper', () => {
  it('icons', async () => {
    const h = helpers(await makeContainer()).get<FileHelper>('file');
    expect(h.icon('test.png')).toBe('fa-file-image-o');
    expect(h.icon('test')).toBe('fa-file-o');
    expect(h.icon('a.XLSX')).toBe('fa-file-excel-o');
    expect(h.icon('a.docx')).toBe('fa-file-word-o');
    expect(h.icon('a.pptx')).toBe('fa-file-powerpoint-o');
    expect(h.icon('a.tar')).toBe('fa-file-archive-o');
    expect(h.icon('a.flac')).toBe('fa-file-audio-o');
    expect(h.icon('a.mkv')).toBe('fa-file-video-o');
    expect(h.icon('a.css')).toBe('fa-file-code-o');
    expect(h.icon('a.pdf')).toBe('fa-file-pdf-o');
  });

  it('mime types', async () => {
    const h = helpers(await makeContainer()).get<FileHelper>('file');
    expect(h.getImageMimeType('My File.JPG')).toBe('image/jpeg');
    expect(h.getImageMimeType('My File.jpeg')).toBe('image/jpeg');
    expect(h.getImageMimeType('My File.PNG')).toBe('image/png');
    expect(h.getImageMimeType('My File.gif')).toBe('image/gif');
    expect(h.getImageMimeType('My File.webp')).toBe('image/webp');
    expect(h.getImageMimeType('My File.bmp')).toBe('image/jpeg');
    expect(h.getImageMimeType('My File')).toBe('image/jpeg');
  });

  it('preview and browser view types', async () => {
    const h = helpers(await makeContainer()).get<FileHelper>('file');
    expect(h.getPreviewType('test.txt')).toBe('text');
    expect(h.getPreviewType('test.markdown')).toBe('markdown');
    expect(h.getPreviewType('test.md')).toBe('markdown');
    expect(h.getPreviewType('test.doc')).toBeNull();
    expect(h.getBrowserViewType('SomeFile.PDF')).toBe('application/pdf');
    expect(h.getBrowserViewType('SomeFile.doc')).toBeNull();
    expect(h.getBrowserViewType('a.svg')).toBe('image/svg+xml');
    expect(h.getBrowserViewType('a.mov')).toBe('video/quicktime');
  });
});

describe('ModelHelper', () => {
  it('manipulates fields in place', async () => {
    const h = helpers(await makeContainer()).get<ModelHelper>('model');

    const a: Record<string, unknown> = { a: 1, b: 2, c: 3 };
    h.removeFields(a, ['a', 'x']);
    expect(a).toEqual({ b: 2, c: 3 });

    const b: Record<string, unknown> = { a: '', b: 0, c: '0', d: 'x', e: null };
    h.removeEmptyFields(b, ['a', 'b', 'c', 'd', 'e', 'z']);
    expect(b).toEqual({ d: 'x' });

    const c: Record<string, unknown> = { a: '', b: null, c: 'x', d: 0 };
    h.resetFields(c, ['a', 'b', 'c', 'd', 'z']);
    expect(c).toEqual({ a: 0, b: null, c: 'x', d: 0 });

    const d: Record<string, unknown> = { a: '12', b: '3.9', c: 'abc', d: null, e: true };
    h.convertIntegerFields(d, ['a', 'b', 'c', 'd', 'e', 'z']);
    expect(d).toEqual({ a: 12, b: 3, c: 0, d: null, e: 1 });

    const e: Record<string, unknown> = { a: '', b: 0, c: 'x', d: null };
    h.convertNullFields(e, ['a', 'b', 'c', 'd', 'z']);
    expect(e).toEqual({ a: null, b: null, c: 'x', d: null });
  });
});
