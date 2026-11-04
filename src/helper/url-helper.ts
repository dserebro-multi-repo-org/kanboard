import {
  CsrfTokenStub,
  HelperRequestStub,
  optionalService,
  type CsrfTokenInterface,
  type HelperRequestInterface,
} from '../foundation/helper-collaborators.js';
import { HelperBase } from './helper-base.js';
import { httpBuildQuery, phpEmpty, type Values } from './php.js';
import { posix } from 'node:path';

type Params = Record<string, string | number>;

/** Path component of a URL (PHP `parse_url($url, PHP_URL_PATH)`), '' when absent. */
function urlPath(url: string): string {
  const match = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?(?:\/\/[^/?#]*)?([^?#]*)/.exec(url);
  return match?.[1] ?? '';
}

/**
 * Port of `app/Helper/UrlHelper.php`.
 *
 * The application URL is stored in the database (async `configModel`): call and await {@link loadBase} (the template
 * layer does it once per render) before generating absolute URLs, `base()` itself is synchronous.
 */
export class UrlHelper extends HelperBase {
  private baseUrl = '';
  private directory = '';

  /** Link to the documentation. */
  doc(label: string, file = ''): string {
    const url = this.service('config').DOCUMENTATION_URL_PATTERN.replace(/%s/g, () => file);
    return `<a href="${url}" target="_blank">${label}</a>`;
  }

  /** Button link element. */
  button(icon: string, label: string, controller: string, action: string, params: Params = {}, cssClass = ''): string {
    const html = `<i class="fa fa-${icon} fa-fw"></i> ${label}`;
    return this.link(html, controller, action, params, false, `btn ${cssClass}`);
  }

  /** Link element with icon. */
  icon(
    icon: string,
    label: string,
    controller: string,
    action: string,
    params: Params = {},
    csrf = false,
    cssClass = '',
    title = '',
    newTab = false,
    anchor = '',
    absolute = false,
  ): string {
    const html = `<i class="fa fa-fw fa-${icon}" aria-hidden="true"></i>${label}`;
    return this.helper<UrlHelper>('url').link(html, controller, action, params, csrf, cssClass, title, newTab, anchor, absolute);
  }

  /** Link element. */
  link(
    label: string,
    controller: string,
    action: string,
    params: Params = {},
    csrf = false,
    cssClass = '',
    title = '',
    newTab = false,
    anchor = '',
    absolute = false,
  ): string {
    return `<a href="${this.href(controller, action, params, csrf, anchor, absolute)}" class="${cssClass}" title='${title}' ${newTab ? 'target="_blank"' : ''}>${label}</a>`;
  }

  /** Absolute link opened in a new tab. */
  absoluteLink(label: string, controller: string, action: string, params: Params = {}): string {
    return this.link(label, controller, action, params, false, '', '', true, '', true);
  }

  /** URL for HTML attributes (`&amp;` separators). */
  href(controller: string, action: string, params: Params = {}, csrf = false, anchor = '', absolute = false): string {
    return this.build('&amp;', controller, action, params, csrf, anchor, absolute);
  }

  /** Raw controller/action URL (`&` separators). */
  to(controller: string, action: string, params: Params = {}, anchor = '', absolute = false): string {
    return this.build('&', controller, action, params, false, anchor, absolute);
  }

  /** Load (from the `application_url` setting) and cache the application base URL. */
  async loadBase(): Promise<string> {
    this.baseUrl = (await this.service('configModel').get('application_url')) || 'http://localhost/';
    return this.baseUrl;
  }

  /** Application base URL as last loaded by {@link loadBase} (`http://localhost/` until then). */
  base(): string {
    return this.baseUrl === '' ? 'http://localhost/' : this.baseUrl;
  }

  /** Application base directory, e.g. `/kanboard/`. */
  dir(): string {
    const request = optionalService<HelperRequestInterface>(this.container, 'request', () => new HelperRequestStub());

    if (this.directory === '' && request.getMethod() !== '') {
      const kanboardUrl = (this.service('config') as unknown as Values)['KANBOARD_URL'];

      if (typeof kanboardUrl === 'string' && kanboardUrl.length > 0) {
        this.directory = urlPath(kanboardUrl);
      } else {
        const script = request.getServerVariable?.('PHP_SELF') ?? '/index.php';
        let directory = posix.dirname(script.replace(/\\/g, '/'));
        directory = directory !== '/' ? `${directory}/` : '/';
        this.directory = directory.replace(/\/\//g, '/');
      }
    }

    return this.directory;
  }

  /** Build a relative (or absolute) URL. */
  protected build(separator: string, controller: string, action: string, params: Params = {}, csrf = false, anchor = '', absolute = false): string {
    let path = this.service('route').findUrl(controller, action, params);
    const qs: Record<string, unknown> = {};

    if (path === '') {
      qs['controller'] = controller;
      qs['action'] = action;
      for (const [key, value] of Object.entries(params)) {
        if (!(key in qs)) qs[key] = value;
      }
    }

    if (csrf) {
      const token = optionalService<CsrfTokenInterface>(this.container, 'token', () => new CsrfTokenStub());
      qs['csrf_token'] = token.getCSRFToken();
    }

    if (Object.keys(qs).length > 0) {
      path += `?${httpBuildQuery(qs, separator)}`;
    }

    return (absolute ? this.base() : this.dir()) + path + (phpEmpty(anchor) ? '' : `#${anchor}`);
  }
}
