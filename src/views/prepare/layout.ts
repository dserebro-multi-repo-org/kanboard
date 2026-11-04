import type { HelperRegistry } from '../../foundation/helper.js';
import type { AssetHelper } from '../../helper/asset-helper.js';

/** Pre-resolved variables of `layout.njk` (the helper results Nunjucks cannot await). */
export interface LayoutVars {
  /** HTML of `asset.customCss()` (the custom stylesheet setting). */
  custom_css: string;
}

export async function prepareLayoutVars(helpers: HelperRegistry): Promise<LayoutVars> {
  return { custom_css: await helpers.get<AssetHelper>('asset').customCss() };
}
