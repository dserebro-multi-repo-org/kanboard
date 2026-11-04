import {
  BatchBHelper,
  PROJECT_ACTIVITY_TABLE,
  ProjectActivityProjectIdFilter,
  ProjectActivityProjectIdsFilter,
  ProjectActivityTaskIdFilter,
  type Rec,
} from './batch-b-support.js';

/** Port of `app/Helper/ProjectActivityHelper.php`. */
export class ProjectActivityHelper extends BatchBHelper {
  /** Search events. */
  async searchEvents(search: string): Promise<Rec[]> {
    const projects = await this.collab('projectUserRoleModel').getActiveProjectsByUser(this.userSession.getId());
    let events: Rec[] = [];

    if (search !== '') {
      const queryBuilder = this.collab('projectActivityLexer')
        .build(search)
        .withFilter(new ProjectActivityProjectIdsFilter(Object.keys(projects)));
      queryBuilder.getQuery().desc(`${PROJECT_ACTIVITY_TABLE}.id`).limit(500);

      events = await queryBuilder.format(this.collab('projectActivityEventFormatter'));
    }

    return events;
  }

  /** Get project activity events. */
  async getProjectEvents(projectId: unknown, limit = 50): Promise<Rec[]> {
    const queryBuilder = this.collab('projectActivityQuery').withFilter(new ProjectActivityProjectIdFilter(projectId));
    queryBuilder.getQuery().desc(`${PROJECT_ACTIVITY_TABLE}.id`).limit(limit);

    return queryBuilder.format(this.collab('projectActivityEventFormatter'));
  }

  /** Get projects activity events. */
  async getProjectsEvents(projectIds: unknown[], limit = 50): Promise<Rec[]> {
    const queryBuilder = this.collab('projectActivityQuery').withFilter(new ProjectActivityProjectIdsFilter(projectIds));
    queryBuilder.getQuery().desc(`${PROJECT_ACTIVITY_TABLE}.id`).limit(limit);

    return queryBuilder.format(this.collab('projectActivityEventFormatter'));
  }

  /** Get task activity events. */
  async getTaskEvents(taskId: unknown): Promise<Rec[]> {
    const queryBuilder = this.collab('projectActivityQuery').withFilter(new ProjectActivityTaskIdFilter(taskId));
    queryBuilder.getQuery().desc(`${PROJECT_ACTIVITY_TABLE}.id`);

    return queryBuilder.format(this.collab('projectActivityEventFormatter'));
  }
}
