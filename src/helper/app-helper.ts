import {
  CsrfTokenStub,
  DateParserStub,
  FlashMessageStub,
  HelperRequestStub,
  LanguageModelStub,
  TimezoneModelStub,
  optionalService,
  type CsrfTokenInterface,
  type DateParserInterface,
  type FlashMessageInterface,
  type HelperRequestInterface,
  type LanguageModelInterface,
  type TimezoneModelInterface,
} from '../foundation/helper-collaborators.js';
import { HelperBase } from './helper-base.js';
import { jsonEncode, phpEmpty, type Values } from './php.js';
import type { TextHelper } from './text-helper.js';

/** Port of `app/Helper/AppHelper.php`. */
export class AppHelper extends HelperBase {
  tooltipMarkdown(markdownText: string, icon = 'fa-info-circle'): string {
    return `<span class="tooltip"><i class="fa ${icon}"></i><script type="text/template"><div class="markdown">${this.helper<TextHelper>('text').markdown(markdownText)}</div></script></span>`;
  }

  tooltipHTML(htmlText: string, icon = 'fa-info-circle'): string {
    return `<span class="tooltip"><i class="fa ${icon}"></i><script type="text/template"><div class="markdown">${htmlText}</div></script></span>`;
  }

  tooltipLink(label: string, link: string): string {
    return `<span class="tooltip" data-href="${link}">${label}</span>`;
  }

  /** The token service (CSRF tokens). */
  getToken(): CsrfTokenInterface {
    return optionalService<CsrfTokenInterface>(this.container, 'token', () => new CsrfTokenStub());
  }

  isAjax(): boolean {
    return this.request().isAjax();
  }

  /** Render a Javascript component. */
  component(name: string, params: Values = {}): string {
    return `<div class="js-${name}" data-params='${jsonEncode(params, true)}'></div>`;
  }

  /** Get a config variable (stored in the database, hence async). */
  async config<D = string>(param: string, defaultValue: D = '' as D): Promise<string | D> {
    return this.service('configModel').get(param, defaultValue);
  }

  /** Make a sidebar menu entry active. */
  checkMenuSelection(controller: string, action = '', plugin = ''): string {
    let result = this.getRouterController().toLowerCase() === controller.toLowerCase();

    if (result && action !== '') {
      result = this.getRouterAction().toLowerCase() === action.toLowerCase();
    }

    if (result && plugin !== '') {
      result = this.getPluginName().toLowerCase() === plugin.toLowerCase();
    }

    return result ? 'class="active"' : '';
  }

  getPluginName(): string {
    return this.service('router').getPlugin();
  }

  getRouterController(): string {
    return this.service('router').getController();
  }

  getRouterAction(): string {
    return this.service('router').getAction();
  }

  /** Javascript language code. */
  jsLang(): string {
    return this.language().getJsLanguageCode();
  }

  /** Whether the current language requires RTL direction. */
  isRtlLanguage(): boolean {
    return this.language().isRtlLanguage();
  }

  /** Date format for the jQuery DatePicker. */
  getJsDateFormat(): string {
    return this.dateParser()
      .getUserDateFormat()
      .replace(/m/g, 'mm')
      .replace(/Y/g, 'yy')
      .replace(/d/g, 'dd');
  }

  /** Time format for the jQuery DateTimePicker plugin. */
  getJsTimeFormat(): string {
    return this.dateParser()
      .getUserTimeFormat()
      .replace(/H/g, 'HH')
      .replace(/i/g, 'mm')
      .replace(/g/g, 'h')
      .replace(/a/g, 'tt');
  }

  /** Current timezone. */
  getTimezone(): string {
    return optionalService<TimezoneModelInterface>(this.container, 'timezoneModel', () => new TimezoneModelStub()).getCurrentTimezone();
  }

  /** Session flash message (read once). */
  flashMessage(): string {
    const text = this.helper<TextHelper>('text');
    const flash = optionalService<FlashMessageInterface>(this.container, 'flash', () => new FlashMessageStub());
    const successMessage = flash.getMessage('success');
    const failureMessage = flash.getMessage('failure');

    if (!phpEmpty(successMessage)) {
      return `<div class="alert alert-success alert-fade-out">${text.e(successMessage)}</div>`;
    }

    if (!phpEmpty(failureMessage)) {
      return `<div class="alert alert-error">${text.e(failureMessage)}</div>`;
    }

    return '';
  }

  private request(): HelperRequestInterface {
    return optionalService<HelperRequestInterface>(this.container, 'request', () => new HelperRequestStub());
  }

  private language(): LanguageModelInterface {
    return optionalService<LanguageModelInterface>(this.container, 'languageModel', () => new LanguageModelStub());
  }

  private dateParser(): DateParserInterface {
    return optionalService<DateParserInterface>(this.container, 'dateParser', () => new DateParserStub());
  }
}
