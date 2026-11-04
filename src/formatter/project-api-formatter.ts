import type { Container } from '../core/container/container.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** API Project Formatter (port of `Kanboard\Formatter\ProjectApiFormatter`). */
export class ProjectApiFormatter extends BaseFormatter {
  protected project: Row | null = null;

  constructor(container: Container) {
    super(container);
  }

  withProject(project: Row | null | false): this {
    this.project = project || null;
    return this;
  }

  async format(): Promise<Row | null> {
    const project = this.project;

    if (project !== null && Object.keys(project).length > 0) {
      const url = this.urlHelper;
      const urls: Row = {
        board: url.to('BoardViewController', 'show', { project_id: project['id'] }, '', true),
        list: url.to('TaskListController', 'show', { project_id: project['id'] }, '', true),
      };

      // Add the public URLs if public access is enabled
      if (project['is_public'] && project['token']) {
        urls['public_board'] = url.to('BoardViewController', 'readonly', { token: project['token'] }, '', true);
        urls['rss_feed'] = url.to('FeedController', 'project', { token: project['token'] }, '', true);
        urls['ical_feed'] = url.to('ICalendarController', 'project', { token: project['token'] }, '', true);
      }

      project['url'] = urls;
    }

    return project;
  }
}
