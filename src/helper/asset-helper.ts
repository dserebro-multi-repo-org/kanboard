import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ColorModelStub, optionalService, type ColorModelInterface } from '../foundation/helper-collaborators.js';
import { HelperBase } from './helper-base.js';
import type { UrlHelper } from './url-helper.js';

/** Project root (PHP `dirname(__DIR__, 2)`), the directory assets are served from. */
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Port of `app/Helper/AssetHelper.php`. */
export class AssetHelper extends HelperBase {
  /** Directory that contains the asset files (overridable for tests). */
  rootDir = DEFAULT_ROOT;

  /** `filemtime()` of an asset, '' when the file does not exist (PHP warns and concatenates `false`). */
  private mtime(filename: string): string {
    try {
      return String(Math.floor(statSync(`${this.rootDir}/${filename}`).mtimeMs / 1000));
    } catch {
      return '';
    }
  }

  /** Add a Javascript asset. */
  js(filename: string, async = false): string {
    return `<script ${async ? 'async' : ''} defer type="text/javascript" src="${this.helper<UrlHelper>('url').dir()}${filename}?${this.mtime(filename)}"></script>`;
  }

  /** Add a stylesheet asset. */
  css(filename: string, isFile = true, media = 'screen'): string {
    return `<link rel="stylesheet" href="${this.helper<UrlHelper>('url').dir()}${filename}${isFile ? `?${this.mtime(filename)}` : ''}" media="${media}">`;
  }

  /** Custom stylesheet saved in the application settings. */
  async customCss(): Promise<string> {
    const stylesheet = await this.service('configModel').get('application_stylesheet');
    return stylesheet ? `<style>${stylesheet}</style>` : '';
  }

  /** CSS of the task colors. */
  colorCss(): string {
    const colors = optionalService<ColorModelInterface>(this.container, 'colorModel', () => new ColorModelStub());
    return `<style>${colors.getCss()}</style>`;
  }
}
