import { t } from '../core/translator/functions.js';
import { elvis, empty, BatchBHelper, type Rec } from './batch-b-support.js';

/** PHP `rawurldecode()`: malformed escape sequences are left untouched. */
function rawurldecode(value: string): string {
  return value.replace(/(?:%[0-9a-fA-F]{2})+/g, (sequence) => {
    try {
      return decodeURIComponent(sequence);
    } catch {
      return sequence;
    }
  });
}

/** Port of `app/Helper/ProjectHeaderHelper.php`. */
export class ProjectHeaderHelper extends BatchBHelper {
  /** Get current search query. */
  getSearchQuery(project: Rec): string {
    const search = this.collab('request').getStringParam('search', this.userSession.getFilters(project.id));
    this.userSession.setFilters(project.id, search);
    return rawurldecode(search);
  }

  /** Render project header (views switcher and search box). */
  async render(project: Rec, controller: string, action: string, boardView = false, plugin = ''): Promise<string> {
    const filters = {
      controller,
      action,
      project_id: project.id,
      search: this.getSearchQuery(project),
      plugin,
    };

    return this.collab('template').render('project_header/header', {
      project,
      filters,
      categories_list: await this.collab('categoryModel').getList(project.id, false),
      users_list: await this.collab('projectUserRoleModel').getAssignableUsersList(project.id, false),
      custom_filters_list: await this.collab('customFilterModel').getAll(project.id, this.userSession.getId()),
      board_view: boardView,
    });
  }

  /** Get project description. */
  getDescription(project: Rec): string {
    let description: string;

    if (Number(project.owner_id) > 0) {
      description =
        t('Project owner: ') + '<strong>' + this.text.e(elvis(project.owner_name, project.owner_username)) + '</strong>' + '\n\n';

      if (!empty(project.description)) {
        description += '<hr>' + '\n\n';
        description += this.text.markdown(String(elvis(project.description, '')));
      }
    } else {
      description = this.text.markdown(String(elvis(project.description, '')));
    }

    return description;
  }
}
