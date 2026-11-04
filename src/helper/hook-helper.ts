import { HelperBase } from './helper-base.js';
import { phpEmpty } from './php.js';
import { TemplateRendererStub, optionalService, type TemplateParams, type TemplateRendererInterface } from '../foundation/helper-collaborators.js';
import type { AssetHelper } from './asset-helper.js';

/**
 * A template attached to a hook. The PHP hook registry stores arrays (`template`, `variables`, `callable`); the TS
 * `Hook` only stores functions, so the metadata is carried by properties of the (no-op) listener function.
 */
export interface TemplateHookListener {
  (): void;
  template: string;
  variables?: TemplateParams;
  callable?: (...args: unknown[]) => unknown;
}

function makeListener(template: string, extra: Pick<TemplateHookListener, 'variables' | 'callable'>): TemplateHookListener {
  return Object.assign((): void => undefined, { template }, extra);
}

/** Port of `app/Helper/HookHelper.php`. */
export class HookHelper extends HelperBase {
  /** Add the JS or CSS assets attached to a hook. */
  asset(type: 'js' | 'css', hook: string): string {
    let buffer = '';
    const assets = this.helper<AssetHelper>('asset');

    for (const listener of this.service('hook').getListeners(hook) as unknown as TemplateHookListener[]) {
      buffer += assets[type](listener.template);
    }

    return buffer;
  }

  /** Render all the templates attached to a hook. */
  render(hook: string, variables: TemplateParams = {}): string {
    let buffer = '';
    const template = optionalService<TemplateRendererInterface>(this.container, 'template', () => new TemplateRendererStub());

    for (const listener of this.service('hook').getListeners(hook) as unknown as TemplateHookListener[]) {
      let currentVariables = variables;

      if (!phpEmpty(listener.variables)) {
        currentVariables = { ...variables, ...listener.variables };
      } else if (listener.callable !== undefined) {
        const result = listener.callable(...Object.values(variables));

        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
          currentVariables = { ...variables, ...(result as TemplateParams) };
        }
      }

      buffer += template.render(listener.template, currentVariables);
    }

    return buffer;
  }

  /** Attach a template to a hook. */
  attach(hook: string, template: string, variables: TemplateParams = {}): this {
    this.service('hook').on(hook, makeListener(template, { variables }));
    return this;
  }

  /** Attach a template to a hook with a callable receiving the hook arguments (the variables values). */
  attachCallable(hook: string, template: string, callable: (...args: unknown[]) => unknown): this {
    this.service('hook').on(hook, makeListener(template, { callable }));
    return this;
  }
}
