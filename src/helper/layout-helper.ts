import {
  HelperRequestStub,
  ProjectUserRoleModelStub,
  TemplateRendererStub,
  optionalService,
  type HelperRequestInterface,
  type ProjectUserRoleModelInterface,
  type TemplateParams,
  type TemplateRendererInterface,
} from '../foundation/helper-collaborators.js';
import { HelperBase } from './helper-base.js';
import { isSet, phpEmpty, toPhpString } from './php.js';

type Dict = Record<string, unknown>;

/** `$params[$key]` when it is an array/object, else an empty object (PHP nested `isset`/access). */
function child(params: TemplateParams, key: string): Dict {
  const value = params[key];
  return typeof value === 'object' && value !== null ? (value as Dict) : {};
}

/**
 * Port of `app/Helper/LayoutHelper.php`. Layout methods render templates and return the final HTML; the ones that
 * go through {@link LayoutHelper.app} are async because the board selector needs database access.
 */
export class LayoutHelper extends HelperBase {
  private get request(): HelperRequestInterface {
    return optionalService<HelperRequestInterface>(this.container, 'request', () => new HelperRequestStub());
  }

  private get template(): TemplateRendererInterface {
    return optionalService<TemplateRendererInterface>(this.container, 'template', () => new TemplateRendererStub());
  }

  /** Render a template without the layout if Ajax request. */
  async app(template: string, params: TemplateParams = {}): Promise<string> {
    const isAjax = this.request.isAjax();
    params = { ...params, is_ajax: isAjax };

    if (isAjax) {
      return this.template.render(template, params);
    }

    if (!isSet(params, 'no_layout') && !isSet(params, 'board_selector')) {
      const projectUserRoleModel = optionalService<ProjectUserRoleModelInterface>(
        this.container,
        'projectUserRoleModel',
        () => new ProjectUserRoleModelStub(),
      );
      const boardSelector = { ...(await projectUserRoleModel.getActiveProjectsByUser(this.service('userSession').getId())) };

      const project = child(params, 'project');
      if (isSet(project, 'id')) {
        delete boardSelector[toPhpString(project['id'])];
      }

      this.service('hook').reference('helper:layout:board-selector:list', boardSelector);
      params['board_selector'] = boardSelector;
    }

    return this.pageLayout(template, params);
  }

  /** Common layout for user views. */
  user(template: string, params: TemplateParams): Promise<string> {
    if (isSet(params, 'user')) {
      const user = child(params, 'user');
      params = { ...params, title: `#${toPhpString(user['id'])} ${toPhpString(phpEmpty(user['name']) ? user['username'] : user['name'])}` };
    }

    return this.subLayout('user_view/layout', 'user_view/sidebar', template, params);
  }

  /** Common layout for task views. */
  task(template: string, params: TemplateParams): Promise<string> {
    const task = child(params, 'task');
    params = {
      ...params,
      page_title: `${toPhpString(task['project_name'])}, #${toPhpString(task['id'])} - ${toPhpString(task['title'])}`,
      title: task['project_name'],
    };
    return this.subLayout('task/layout', 'task/sidebar', template, params);
  }

  /** Common layout for project views. */
  project(template: string, params: TemplateParams, sidebar = 'project/sidebar'): Promise<string> {
    const project = child(params, 'project');

    if (phpEmpty(params['title'])) {
      params = { ...params, title: project['name'] };
    } else if (project['name'] !== params['title']) {
      params = { ...params, title: `${toPhpString(project['name'])} &gt; ${toPhpString(params['title'])}` };
    }

    return this.subLayout('project/layout', sidebar, template, params);
  }

  /** Common layout for project user views. */
  projectUser(template: string, params: TemplateParams): Promise<string> {
    params = { ...params, filter: { user_id: params['user_id'] } };
    return this.subLayout('project_user_overview/layout', 'project_user_overview/sidebar', template, params);
  }

  /** Common layout for config views. */
  async config(template: string, params: TemplateParams): Promise<string> {
    params = { ...params };

    if (phpEmpty(params['values'])) {
      params['values'] = await this.service('configModel').getAll();
    }

    if (!isSet(params, 'errors')) {
      params['errors'] = {};
    }

    return this.subLayout('config/layout', 'config/sidebar', template, params);
  }

  /** Common layout for plugin views. */
  plugin(template: string, params: TemplateParams): Promise<string> {
    return this.subLayout('plugin/layout', 'plugin/sidebar', template, params);
  }

  /** Common layout for dashboard views. */
  dashboard(template: string, params: TemplateParams): Promise<string> {
    return this.subLayout('dashboard/layout', 'dashboard/sidebar', template, params);
  }

  /** Common layout for analytic views. */
  analytic(template: string, params: TemplateParams): Promise<string> {
    if (isSet(child(params, 'project'), 'name')) {
      params = { ...params, title: `${toPhpString(child(params, 'project')['name'])} &gt; ${toPhpString(params['title'])}` };
    }

    return this.subLayout('analytic/layout', 'analytic/sidebar', template, params, true);
  }

  /** Render the page layout around a template. */
  pageLayout(template: string, params: TemplateParams = {}, layout = 'layout'): string {
    const content = this.template.render(template, params);
    // PHP array union: existing keys of $params win over `content_for_layout`.
    return this.template.render(layout, { ...params, content_for_layout: Object.hasOwn(params, 'content_for_layout') ? params['content_for_layout'] : content });
  }

  /** Common method to generate a sub-layout. */
  async subLayout(sublayout: string, sidebar: string, template: string, params: TemplateParams = {}, ignoreAjax = false): Promise<string> {
    const isAjax = this.request.isAjax();
    params = { ...params, is_ajax: isAjax };
    const content = this.template.render(template, params);

    if (!ignoreAjax && isAjax) {
      return content;
    }

    params = { ...params, content_for_sublayout: content, sidebar_template: sidebar };

    return this.app(sublayout, params);
  }
}
