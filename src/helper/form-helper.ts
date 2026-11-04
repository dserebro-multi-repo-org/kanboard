import { t } from '../core/translator/functions.js';
import { formatDate } from '../core/translator/date.js';
import {
  ColorModelStub,
  CsrfTokenStub,
  DateParserStub,
  optionalService,
  type ColorModelInterface,
  type CsrfTokenInterface,
  type DateParserInterface,
} from '../foundation/helper-collaborators.js';
import { HelperBase } from './helper-base.js';
import { htmlspecialchars, inArray, isSet, jsonEncode, looseEquals, phpTruthy, toPhpString, type Values } from './php.js';
import type { TextHelper } from './text-helper.js';
import type { UrlHelper } from './url-helper.js';

/** Select/radio/checkbox options. A `Map` keeps insertion order of integer keys like a PHP array does. */
export type FormOptions = Readonly<Record<string, unknown>> | ReadonlyMap<string | number, unknown>;
/** Validation errors: field name to the list of messages. */
export type FormErrors = Readonly<Record<string, readonly string[]>>;
type Attributes = readonly string[];

function optionEntries(options: FormOptions): Array<[string | number, unknown]> {
  return options instanceof Map ? [...options.entries()] : Object.entries(options);
}

/** Port of `app/Helper/FormHelper.php`. */
export class FormHelper extends HelperBase {
  private get textHelper(): TextHelper {
    return this.helper<TextHelper>('text');
  }

  private get urlHelper(): UrlHelper {
    return this.helper<UrlHelper>('url');
  }

  /** Hidden CSRF token field. */
  csrf(): string {
    const token = optionalService<CsrfTokenInterface>(this.container, 'token', () => new CsrfTokenStub());
    return `<input type="hidden" name="csrf_token" value="${token.getCSRFToken()}"/>`;
  }

  /** Hidden form field. */
  hidden(name: string, values: Values = {}): string {
    return `<input type="hidden" name="${name}" id="form-${name}" ${this.formValue(values, name)}/>`;
  }

  /** Select field. */
  select(name: string, options: FormOptions, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    let html = `<select name="${name}" id="form-${name}" class="${cssClass}" ${attributes.join(' ')}>`;

    for (const [id, value] of optionEntries(options)) {
      html += `<option value="${this.textHelper.e(id)}"`;

      if (isSet(values, name) && looseEquals(id, values[name])) {
        html += ' selected="selected"';
      }

      html += `>${this.textHelper.e(value)}</option>`;
    }

    html += '</select>';
    html += this.errorList(errors, name);

    return html;
  }

  /** Color select field. */
  colorSelect(name: string, values: Values): string {
    const colors = optionalService<ColorModelInterface>(this.container, 'colorModel', () => new ColorModelStub()).getList();
    let html = this.label(t('Color'), name);
    html += this.select(name, colors, values, {}, ['tabindex="4"'], 'color-picker');
    return html;
  }

  /** Radio field group. */
  radios(name: string, options: FormOptions, values: Values = {}): string {
    let html = '';

    for (const [value, label] of optionEntries(options)) {
      html += this.radio(name, label, value, isSet(values, name) && looseEquals(values[name], value));
    }

    return html;
  }

  /** Radio field. */
  radio(name: string, label: unknown, value: unknown, selected = false, cssClass = ''): string {
    return `<label><input type="radio" name="${name}" class="${cssClass}" value="${this.textHelper.e(value)}" ${selected ? 'checked="checked"' : ''}> ${this.textHelper.e(label)}</label>`;
  }

  /** Checkboxes group. */
  checkboxes(name: string, options: FormOptions, values: Values = {}): string {
    let html = '';

    for (const [value, label] of optionEntries(options)) {
      html += this.checkbox(`${name}[${value}]`, label, value, isSet(values, name) && inArray(value, values[name]));
    }

    return html;
  }

  /** Checkbox field. */
  checkbox(name: string, label: unknown, value: unknown, checked = false, cssClass = '', attributes: Values = {}): string {
    let htmlAttributes = '';
    const all: Record<string, unknown> = { ...attributes };

    if (checked) {
      all['checked'] = 'checked';
    }

    for (const [attribute, attributeValue] of Object.entries(all)) {
      htmlAttributes += `${attribute}="${this.textHelper.e(attributeValue)}"`;
    }

    return `<label><input type="checkbox" name="${name}" class="${cssClass}" value="${this.textHelper.e(value)}" ${htmlAttributes}>&nbsp;${this.textHelper.e(label)}</label>`;
  }

  /** Form label. */
  label(label: unknown, name: string, attributes: Attributes = []): string {
    return `<label for="form-${name}" ${attributes.join(' ')}>${this.textHelper.e(label)}</label>`;
  }

  /** Textarea. */
  textarea(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    cssClass += this.errorClass(errors, name);

    let html = `<textarea name="${name}" id="form-${name}" class="${cssClass}" `;
    html += `${attributes.join(' ')}>`;
    html += isSet(values, name) ? this.textHelper.e(values[name]) : '';
    html += '</textarea>';
    html += this.errorList(errors, name);

    return html;
  }

  /** Markdown editor. `attributes` is the PHP associative array (`required`, `tabindex`, `aria-label`, `autofocus`). */
  textEditor(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Values = {}): string {
    const triggers: Record<string, string> = {
      '#': this.urlHelper.to('TaskAjaxController', 'suggest', { search: 'SEARCH_TERM' }),
    };

    const params = {
      name,
      css: this.errorClass(errors, name),
      required: isSet(attributes, 'required') && phpTruthy(attributes['required']),
      tabindex: isSet(attributes, 'tabindex') ? attributes['tabindex'] : '-1',
      labelPreview: t('Preview'),
      previewUrl: this.urlHelper.to('TaskAjaxController', 'preview'),
      labelWrite: t('Write'),
      labelTitle: t('Title'),
      placeholder: t('Write your text in Markdown'),
      ariaLabel: isSet(attributes, 'aria-label') ? attributes['aria-label'] : '',
      autofocus: isSet(attributes, 'autofocus') && phpTruthy(attributes['autofocus']),
      suggestOptions: { triggers },
    };

    if (isSet(values, 'project_id')) {
      triggers['@'] = this.urlHelper.to('UserAjaxController', 'mention', { project_id: values['project_id'] as string | number, search: 'SEARCH_TERM' });
    }

    let html = `<div class="js-text-editor" data-params='${jsonEncode(params, true)}'>`;
    html += `<script type="text/template">${isSet(values, name) ? htmlspecialchars(values[name], true) : ''}</script>`;
    html += '</div>';
    html += this.errorList(errors, name);

    return html;
  }

  /** File field. */
  file(name: string, errors: FormErrors = {}, multiple = false): string {
    let html = `<input type="file" name="${name}" id="form-${name}" ${multiple ? 'multiple' : ''}>`;
    html += this.errorList(errors, name);

    return html;
  }

  /** Input field. */
  input(type: string, name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    cssClass += this.errorClass(errors, name);

    let html = `<input type="${type}" name="${name}" id="form-${name}" ${this.formValue(values, name)} class="${cssClass}" `;
    html += `${attributes.join(' ')}>`;

    if (attributes.includes('required')) {
      html += '<span class="form-required">*</span>';
    }

    html += this.errorList(errors, name);

    return html;
  }

  /** Text field. */
  text(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    return this.input('text', name, values, errors, attributes, cssClass);
  }

  /** Password field. */
  password(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    return this.input('password', name, values, errors, attributes, cssClass);
  }

  /** Email field. */
  email(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    return this.input('email', name, values, errors, attributes, cssClass);
  }

  /** Number field. */
  number(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    return this.input('number', name, values, errors, attributes, cssClass);
  }

  /** Numeric field (allows decimal numbers). */
  numeric(name: string, values: Values = {}, errors: FormErrors = {}, attributes: Attributes = [], cssClass = ''): string {
    return this.input('text', name, values, errors, attributes, `${cssClass} form-numeric`);
  }

  /** Date field. */
  date(label: string, name: string, values: Values, errors: FormErrors = {}, attributes: Attributes = []): string {
    const parser = this.dateParser();
    return this.dateField(label, name, values, errors, attributes, parser.getUserDateFormat(), 'form-date');
  }

  /** Datetime field. */
  datetime(label: string, name: string, values: Values, errors: FormErrors = {}, attributes: Attributes = []): string {
    const parser = this.dateParser();
    return this.dateField(label, name, values, errors, attributes, parser.getUserDateTimeFormat(), 'form-datetime');
  }

  private dateParser(): DateParserInterface {
    return optionalService<DateParserInterface>(this.container, 'dateParser', () => new DateParserStub());
  }

  private dateField(label: string, name: string, values: Values, errors: FormErrors, attributes: Attributes, format: string, cssClass: string): string {
    const formatted = this.dateParser().format({ ...values }, [name], format);
    const allAttributes = [`placeholder="${formatDate(format)}"`, ...attributes];

    return this.label(label, name) + this.text(name, formatted, errors, allAttributes, cssClass);
  }

  private errorClass(errors: FormErrors, name: string): string {
    return !isSet(errors, name) ? '' : ' form-error';
  }

  private errorList(errors: FormErrors, name: string): string {
    let html = '';

    if (isSet(errors, name)) {
      html += '<ul class="form-errors">';

      for (const error of errors[name] ?? []) {
        html += `<li>${this.textHelper.e(error)}</li>`;
      }

      html += '</ul>';
    }

    return html;
  }

  private formValue(values: Values, name: string): string {
    return isSet(values, name) ? `value="${this.textHelper.e(toPhpString(values[name]))}"` : '';
  }
}
