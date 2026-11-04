import { describe, expect, it } from 'vitest';
import type { FormHelper } from '../../../src/helper/form-helper.js';
import type { ModalHelper } from '../../../src/helper/modal-helper.js';
import { helpers, makeContainer, setService } from './fixture.js';

async function form(): Promise<FormHelper> {
  const c = await makeContainer();
  setService(c, 'token', { getCSRFToken: () => 'tok' });
  setService(c, 'colorModel', { getList: () => ({ yellow: 'Yellow', blue: 'Blue' }), getCss: () => '' });
  return helpers(c).get<FormHelper>('form');
}

describe('FormHelper', () => {
  it('csrf and hidden', async () => {
    const h = await form();
    expect(h.csrf()).toBe('<input type="hidden" name="csrf_token" value="tok"/>');
    expect(h.hidden('a', { a: 'x"y' })).toBe('<input type="hidden" name="a" id="form-a" value="x&quot;y"/>');
    expect(h.hidden('a')).toBe('<input type="hidden" name="a" id="form-a" />');
  });

  it('select', async () => {
    const h = await form();
    expect(h.select('s', { a: 'A', b: 'B<' }, { s: 'b' }, { s: ['err'] }, ['required'], 'c')).toBe(
      '<select name="s" id="form-s" class="c" required><option value="a">A</option><option value="b" selected="selected">B&lt;</option></select><ul class="form-errors"><li>err</li></ul>',
    );
    expect(h.select('s', new Map<string | number, unknown>([[5, 'five'], [2, 'two']]), { s: '2' })).toBe(
      '<select name="s" id="form-s" class="" ><option value="5">five</option><option value="2" selected="selected">two</option></select>',
    );
  });

  it('color select', async () => {
    const h = await form();
    expect(h.colorSelect('color_id', { color_id: 'blue' })).toBe(
      '<label for="form-color_id" >Color</label><select name="color_id" id="form-color_id" class="color-picker" tabindex="4"><option value="yellow">Yellow</option><option value="blue" selected="selected">Blue</option></select>',
    );
  });

  it('radios and checkboxes', async () => {
    const h = await form();
    expect(h.radios('r', { 1: 'One', 2: 'Two' }, { r: 2 })).toBe(
      '<label><input type="radio" name="r" class="" value="1" > One</label><label><input type="radio" name="r" class="" value="2" checked="checked"> Two</label>',
    );
    expect(h.checkboxes('c', { 1: 'One', 2: 'Two' }, { c: [2] })).toBe(
      '<label><input type="checkbox" name="c[1]" class="" value="1" >&nbsp;One</label><label><input type="checkbox" name="c[2]" class="" value="2" checked="checked">&nbsp;Two</label>',
    );
    expect(h.checkbox('n', 'L', 'v', true, 'c', { data: 'd' })).toBe('<label><input type="checkbox" name="n" class="c" value="v" data="d"checked="checked">&nbsp;L</label>');
  });

  it('label, textarea, file', async () => {
    const h = await form();
    expect(h.label('A & B', 'n', ['x="1"'])).toBe('<label for="form-n" x="1">A & B</label>'.replace('A & B', 'A &amp; B'));
    expect(h.textarea('n', { n: '<b>' }, { n: ['e1', 'e<'] }, ['rows="3"'], 'big')).toBe(
      '<textarea name="n" id="form-n" class="big form-error" rows="3">&lt;b&gt;</textarea><ul class="form-errors"><li>e1</li><li>e&lt;</li></ul>',
    );
    expect(h.file('f', {}, true)).toBe('<input type="file" name="f" id="form-f" multiple>');
    expect(h.file('f')).toBe('<input type="file" name="f" id="form-f" >');
  });

  it('inputs', async () => {
    const h = await form();
    expect(h.text('n', { n: 'v' }, {}, ['required'])).toBe('<input type="text" name="n" id="form-n" value="v" class="" required><span class="form-required">*</span>');
    expect(h.text('n')).toBe('<input type="text" name="n" id="form-n"  class="" >');
    expect(h.password('p', {}, { p: ['bad'] })).toBe('<input type="password" name="p" id="form-p"  class=" form-error" ><ul class="form-errors"><li>bad</li></ul>');
    expect(h.email('e', { e: 'a@b' })).toContain('type="email"');
    expect(h.number('n', { n: 3 })).toContain('type="number" name="n" id="form-n" value="3"');
    expect(h.numeric('n')).toBe('<input type="text" name="n" id="form-n"  class=" form-numeric" >');
  });

  it('text editor', async () => {
    const h = await form();
    expect(h.textEditor('d', { d: 'a &amp; b' })).toBe(
      `<div class="js-text-editor" data-params='{"name":"d","css":"","required":false,"tabindex":"-1","labelPreview":"Preview","previewUrl":"?controller=TaskAjaxController&action=preview","labelWrite":"Write","labelTitle":"Title","placeholder":"Write your text in Markdown","ariaLabel":"","autofocus":false,"suggestOptions":{"triggers":{"#":"?controller=TaskAjaxController&action=suggest&search=SEARCH_TERM"}}}'><script type="text/template">a &amp;amp; b</script></div>`,
    );
    const html = h.textEditor('d', { project_id: 7 }, { d: ['x'] }, { required: true, tabindex: 3, 'aria-label': 'L', autofocus: 1 });
    expect(html).toContain('"css":" form-error","required":true,"tabindex":3');
    expect(html).toContain('"ariaLabel":"L","autofocus":true');
    expect(html).toContain('"@":"?controller=UserAjaxController&action=mention&project_id=7&search=SEARCH_TERM"');
    expect(html).toContain('<ul class="form-errors"><li>x</li></ul>');
  });

  it('date and datetime', async () => {
    const h = await form();
    const date = h.date('Due', 'd', { d: 86400 });
    expect(date).toMatch(/^<label for="form-d" >Due<\/label><input type="text" name="d" id="form-d" value="01\/02\/1970" class="form-date" placeholder="\d{2}\/\d{2}\/\d{4}">$/);
    expect(h.datetime('Due', 'd', { d: 86400 + 3600 })).toMatch(/value="01\/02\/1970 01:00" class="form-datetime" placeholder="\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}">$/);
    expect(h.date('Due', 'd', { d: 0 })).toContain('value="" class="form-date"');
  });
});

describe('ModalHelper', () => {
  async function modal(): Promise<ModalHelper> {
    const c = await makeContainer();
    setService(c, 'token', { getCSRFToken: () => 'tok' });
    return helpers(c).get<ModalHelper>('modal');
  }

  it('buttons', async () => {
    const h = await modal();
    expect(h.submitButtons()).toBe(
      `<div class="js-submit-buttons" data-params='{"submitLabel":"Save","orLabel":"or","cancelLabel":"cancel","color":"blue","tabindex":null,"disabled":false}'></div>`,
    );
    expect(h.submitButtons({ submitLabel: 'Go', color: 'red', tabindex: 2, disabled: false })).toContain('"submitLabel":"Go","orLabel":"or","cancelLabel":"cancel","color":"red","tabindex":2,"disabled":true');
    expect(h.confirmButtons('A', 'b', { id: 1 }, '', 4)).toBe(
      `<div class="js-confirm-buttons" data-params='{"url":"?controller=A&amp;action=b&amp;id=1&amp;csrf_token=tok","submitLabel":"Yes","orLabel":"or","cancelLabel":"cancel","tabindex":4}'></div>`,
    );
  });

  it('links', async () => {
    const h = await modal();
    const link = (inner: string, cls: string, title = '') => `<a href="?controller=A&amp;action=b" class="${cls}" title='${title}' >${inner}</a>`;
    expect(h.largeIcon('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-large" aria-hidden="true"></i>', 'js-modal-large', 'Lbl'));
    expect(h.large('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-large" aria-hidden="true"></i>Lbl', 'js-modal-large'));
    expect(h.medium('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-medium" aria-hidden="true"></i>Lbl', 'js-modal-medium'));
    expect(h.medium('i', 'Lbl', 'A', 'b', {}, 'T')).toBe(link('<i class="fa fa-i fa-fw js-modal-medium" role="img" aria-label="T"></i>Lbl', 'js-modal-medium', 'T'));
    expect(h.small('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-small" aria-hidden="true"></i>Lbl', 'js-modal-small'));
    expect(h.mediumButton('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-medium" aria-hidden="true"></i>Lbl', 'js-modal-medium btn'));
    expect(h.mediumIcon('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-medium" aria-hidden="true"></i>', 'js-modal-medium', 'Lbl'));
    expect(h.confirm('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-confirm" aria-hidden="true"></i>Lbl', 'js-modal-confirm'));
    expect(h.confirmLink('Lbl', 'A', 'b')).toBe(link('Lbl', 'js-modal-confirm'));
    expect(h.replaceLink('Lbl', 'A', 'b')).toBe(link('Lbl', 'js-modal-replace'));
    expect(h.replaceIconLink('i', 'Lbl', 'A', 'b')).toBe(link('<i class="fa fa-i fa-fw js-modal-replace" aria-hidden="true"></i>Lbl', 'js-modal-replace'));
  });
});
