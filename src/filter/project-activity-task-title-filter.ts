import type { FilterInterface } from '../core/filter/filter-interface.js';
import { TaskTitleFilter } from './task-title-filter.js';

/** Port of `Kanboard\Filter\ProjectActivityTaskTitleFilter`. */
export class ProjectActivityTaskTitleFilter extends TaskTitleFilter implements FilterInterface {
  override getAttributes(): string[] {
    return ['title'];
  }
}
