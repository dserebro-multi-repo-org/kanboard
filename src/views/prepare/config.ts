import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Container } from '../../core/container/container.js';
import type { HelperRegistry } from '../../foundation/helper.js';
import type { UrlHelper } from '../../helper/url-helper.js';

/** Pre-resolved variables of the `config/*` templates (`email.njk`, `api.njk`). */
export interface ConfigVars {
  /** The `MAIL_CONFIGURATION` constant. */
  mail_configuration: boolean;
  /** The `MAIL_FROM` constant. */
  mail_from: string;
}

/**
 * `url.base()` is read synchronously by `config/api.njk`: the application URL setting is loaded here first.
 */
export async function prepareConfigVars(helpers: HelperRegistry, container: Container): Promise<ConfigVars> {
  await helpers.get<UrlHelper>('url').loadBase();
  const config = container.get('config');
  return { mail_configuration: Boolean(config.MAIL_CONFIGURATION), mail_from: String(config.MAIL_FROM) };
}

/** Pre-resolved variables of `config/about.njk` (environment values, see the comment of that template). */
export interface AboutVars {
  app_version: string;
  php_version: string;
  php_sapi: string;
  http_client_backend: string;
  os_version: string;
  db_driver: string;
  license_html: string;
}

/** PHP `nl2br()`: insert `<br />` before every line break. */
export function nl2br(text: string): string {
  return text.replace(/(\r\n|\n\r|\n|\r)/g, '<br />$1');
}

export function prepareAboutVars(container: Container, rootDir?: string): AboutVars {
  const config = container.get('config');
  let license = '';
  try {
    license = fs.readFileSync(path.join(rootDir ?? config.ROOT_DIR, 'LICENSE'), 'utf8');
  } catch {
    license = '';
  }

  return {
    app_version: config.APP_VERSION,
    // The "PHP" labels of the template are kept (translation keys); the values describe the Node runtime.
    php_version: process.versions.node,
    php_sapi: 'node',
    http_client_backend: 'fetch',
    os_version: `${os.type()} ${os.release()}`,
    db_driver: config.DB_DRIVER,
    license_html: nl2br(license),
  };
}
