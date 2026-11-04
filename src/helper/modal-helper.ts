import { t } from '../core/translator/functions.js';
import type { AppHelper } from './app-helper.js';
import { HelperBase } from './helper-base.js';
import { isSet, phpEmpty, phpTruthy, type Values } from './php.js';
import type { UrlHelper } from './url-helper.js';

type Params = Record<string, string | number>;

/** Port of `app/Helper/ModalHelper.php`. */
export class ModalHelper extends HelperBase {
  private get url(): UrlHelper {
    return this.helper<UrlHelper>('url');
  }

  submitButtons(params: Values = {}): string {
    return this.helper<AppHelper>('app').component('submit-buttons', {
      submitLabel: isSet(params, 'submitLabel') ? params['submitLabel'] : t('Save'),
      orLabel: t('or'),
      cancelLabel: t('cancel'),
      color: isSet(params, 'color') ? params['color'] : 'blue',
      tabindex: isSet(params, 'tabindex') ? params['tabindex'] : null,
      disabled: isSet(params, 'disabled'),
    });
  }

  confirmButtons(controller: string, action: string, params: Params = {}, submitLabel = '', tabindex: number | string | null = null): string {
    return this.helper<AppHelper>('app').component('confirm-buttons', {
      url: this.url.href(controller, action, params, true),
      submitLabel: phpTruthy(submitLabel) ? submitLabel : t('Yes'),
      orLabel: t('or'),
      cancelLabel: t('cancel'),
      tabindex,
    });
  }

  largeIcon(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-large" aria-hidden="true"></i>`;
    return this.url.link(html, controller, action, params, false, 'js-modal-large', label);
  }

  large(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-large" aria-hidden="true"></i>${label}`;
    return this.url.link(html, controller, action, params, false, 'js-modal-large');
  }

  medium(icon: string, label: string, controller: string, action: string, params: Params = {}, title = ''): string {
    const ariaLabel = phpEmpty(title) ? 'aria-hidden="true"' : `role="img" aria-label="${title}"`;
    const html = `<i class="fa fa-${icon} fa-fw js-modal-medium" ${ariaLabel}></i>${label}`;
    return this.url.link(html, controller, action, params, false, 'js-modal-medium', title);
  }

  small(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-small" aria-hidden="true"></i>${label}`;
    return this.url.link(html, controller, action, params, false, 'js-modal-small');
  }

  mediumButton(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-medium" aria-hidden="true"></i>${label}`;
    return this.url.link(html, controller, action, params, false, 'js-modal-medium btn');
  }

  mediumIcon(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-medium" aria-hidden="true"></i>`;
    return this.url.link(html, controller, action, params, false, 'js-modal-medium', label);
  }

  confirm(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-confirm" aria-hidden="true"></i>${label}`;
    return this.url.link(html, controller, action, params, false, 'js-modal-confirm');
  }

  confirmLink(label: string, controller: string, action: string, params: Params = {}): string {
    return this.url.link(label, controller, action, params, false, 'js-modal-confirm');
  }

  replaceLink(label: string, controller: string, action: string, params: Params = {}): string {
    return this.url.link(label, controller, action, params, false, 'js-modal-replace');
  }

  replaceIconLink(icon: string, label: string, controller: string, action: string, params: Params = {}): string {
    const html = `<i class="fa fa-${icon} fa-fw js-modal-replace" aria-hidden="true"></i>${label}`;
    return this.url.link(html, controller, action, params, false, 'js-modal-replace');
  }
}
