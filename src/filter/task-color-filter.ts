import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TABLES } from '../foundation/model-constants.js';
import type { ColorModelLike } from '../foundation/filter-collaborators.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\TaskColorFilter`. */
export class TaskColorFilter extends BaseFilter implements FilterInterface {
  private colorModel!: ColorModelLike;

  setColorModel(colorModel: ColorModelLike): this {
    this.colorModel = colorModel;
    return this;
  }

  getAttributes(): string[] {
    return ['color', 'colour'];
  }

  apply(): this {
    this.query.eq(`${TABLES.TASK}.color_id`, this.colorModel.find(this.stringValue));

    return this;
  }
}
