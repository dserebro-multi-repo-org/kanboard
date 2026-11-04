import type { Container } from '../core/container/container.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** API Projects Formatter (port of `Kanboard\Formatter\ProjectsApiFormatter`). */
export class ProjectsApiFormatter extends BaseFormatter {
  protected projects: Row[] = [];

  constructor(container: Container) {
    super(container);
  }

  withProjects(projects: Row[]): this {
    this.projects = projects;
    return this;
  }

  async format(): Promise<Array<Row | null>> {
    const result: Array<Row | null> = [];

    for (const project of this.projects) {
      result.push(await this.service('projectApiFormatter').withProject(project).format());
    }

    return result;
  }
}
