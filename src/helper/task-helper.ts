import { t } from '../core/translator/functions.js';
import {
  BatchBHelper,
  getUploadMaxSize,
  isValidUrl,
  looseEq,
  empty,
  range,
  sibling,
  type AppHelperLike,
  type ModalHelperLike,
  type Options,
  type Rec,
} from './batch-b-support.js';
import type { ProjectRoleHelper } from './project-role-helper.js';

/** Port of `app/Helper/TaskHelper.php`. */
export class TaskHelper extends BatchBHelper {
  /** Local cache for project columns. */
  private readonly columns = new Map<string, Rec>();

  async getColors(): Promise<Rec> {
    return this.collab('colorModel').getList();
  }

  async recurrenceTriggers(): Promise<Rec> {
    return this.collab('taskRecurrenceModel').getRecurrenceTriggerList();
  }

  async recurrenceTimeframes(): Promise<Rec> {
    return this.collab('taskRecurrenceModel').getRecurrenceTimeframeList();
  }

  async recurrenceBasedates(): Promise<Rec> {
    return this.collab('taskRecurrenceModel').getRecurrenceBasedateList();
  }

  renderTitleField(values: Rec, errors: Rec): string {
    let html = this.form.label(t('Title'), 'title', ['class="ui-helper-hidden-accessible"']);
    html += this.form.text('title', values, errors, ['autofocus', 'required', 'tabindex="1"', 'placeholder="' + t('Title') + '"']);

    return html;
  }

  renderDescriptionField(values: Rec, errors: Rec): string {
    return this.form.textEditor('description', values, errors, { tabindex: 2, 'aria-label': t('Description') });
  }

  async renderDescriptionTemplateDropdown(projectId: unknown): Promise<string> {
    const templates = await this.collab('predefinedTaskDescriptionModel').getAll(projectId);

    if (templates.length > 0) {
      let html = '<div class="dropdown dropdown-smaller">';
      html +=
        '<a href="#" class="dropdown-menu dropdown-menu-link-icon"><i class="fa fa-floppy-o fa-fw" aria-hidden="true"></i>' +
        t('Template for the task description') +
        ' <i class="fa fa-caret-down" aria-hidden="true"></i></a>';
      html += '<ul>';

      for (const template of templates) {
        html += '<li>';
        html +=
          '<a href="#" data-template-target="textarea[name=description]" data-template="' +
          this.text.e(template.description) +
          '" class="js-template">';
        html += this.text.e(template.title);
        html += '</a>';
        html += '</li>';
      }

      html += '</ul></div>';
      return html;
    }

    return '';
  }

  async renderTagField(project: Rec, tags: unknown[] = []): Promise<string> {
    const options = Object.values(await this.collab('tagModel').getAssignableList(project.id, project.enable_global_tags));

    let html = this.form.label(t('Tags'), 'tags[]');
    html += '<input type="hidden" name="tags[]" value="">';
    html += '<select name="tags[]" id="form-tags" class="tag-autocomplete" multiple tabindex="3">';

    for (const tag of options) {
      html += `<option value="${this.text.e(tag)}" ${tags.some((candidate) => looseEq(candidate, tag)) ? 'selected="selected"' : ''}>${this.text.e(tag)}</option>`;
    }

    html += '</select>';

    return html;
  }

  renderColorField(values: Rec): string {
    return this.form.colorSelect('color_id', values);
  }

  async renderAssigneeField(users: Options, values: Rec, errors: Rec = {}, attributes: string[] = []): Promise<string> {
    if (values.project_id !== undefined && values.project_id !== null && !(await this.helper.get<ProjectRoleHelper>('projectRole').canChangeAssignee(values))) {
      return '';
    }

    const attrs = ['tabindex="5"', ...attributes];

    let html = this.form.label(t('Assignee'), 'owner_id');
    html += this.form.select('owner_id', users, values, errors, attrs);
    html += '&nbsp;';
    html += '<small>';
    html +=
      '<a href="#" class="assign-me" data-target-id="form-owner_id" data-current-id="' +
      this.userSession.getId() +
      '" title="' +
      t('Assign to me') +
      '" aria-label="' +
      t('Assign to me') +
      '">' +
      t('Me') +
      '</a>';
    html += '</small>';

    return html;
  }

  renderCategoryField(categories: Rec, values: Rec, errors: Rec = {}, attributes: string[] = [], allowOneItem = false): string {
    const attrs = ['tabindex="6"', ...attributes];
    let html = '';
    const keys = Object.keys(categories);

    if (!(!allowOneItem && keys.length === 1 && keys[0] === '0')) {
      html += this.form.label(t('Category'), 'category_id');
      html += this.form.select('category_id', categories, values, errors, attrs);
    }

    return html;
  }

  renderSwimlaneField(swimlanes: Rec, values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="7"', ...attributes];
    let html = '';

    if (Object.keys(swimlanes).length > 1) {
      html += this.form.label(t('Swimlane'), 'swimlane_id');
      html += this.form.select('swimlane_id', swimlanes, values, errors, attrs);
    }

    return html;
  }

  renderColumnField(columns: Options, values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="8"', ...attributes];

    let html = this.form.label(t('Column'), 'column_id');
    html += this.form.select('column_id', columns, values, errors, attrs);

    return html;
  }

  renderPriorityField(project: Rec, values: Rec): string {
    const values2: Rec = { priority: project.priority_default, ...values };
    // A Map keeps the PHP insertion order (the range may be descending).
    const options = new Map<number, number>(range(project.priority_start, project.priority_end).map((value) => [value, value]));

    let html = this.form.label(t('Priority'), 'priority');
    html += this.form.select('priority', options, values2, {}, ['tabindex="9"']);

    return html;
  }

  renderScoreField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="14"', ...attributes];

    let html = this.form.label(t('Complexity'), 'score');
    html += this.form.number('score', values, errors, attrs);

    return html;
  }

  renderReferenceField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="15"', ...attributes];

    let html = this.form.label(t('Reference'), 'reference');
    html += this.form.text('reference', values, errors, attrs, 'form-input-small');

    return html;
  }

  renderTimeEstimatedField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="12"', ...attributes];

    let html = this.form.label(t('Original estimate'), 'time_estimated');
    html += this.form.numeric('time_estimated', values, errors, attrs);
    html += ' ' + t('hours');

    return html;
  }

  renderTimeSpentField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="13"', ...attributes];

    let html = this.form.label(t('Time spent'), 'time_spent');
    html += this.form.numeric('time_spent', values, errors, attrs);
    html += ' ' + t('hours');

    return html;
  }

  renderStartDateField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    return this.form.datetime(t('Start Date'), 'date_started', values, errors, ['tabindex="11"', ...attributes]);
  }

  renderDueDateField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    return this.form.datetime(t('Due Date'), 'date_due', values, errors, ['tabindex="10"', ...attributes]);
  }

  renderPriority(priority: number): string {
    let html = '<span class="task-priority" title="' + t('Task priority') + '">';
    html += '<span class="ui-helper-hidden-accessible">' + t('Task priority') + ' </span>';
    html += this.text.e(priority >= 0 ? 'P' + priority : '-P' + Math.abs(priority));
    html += '</span>';

    return html;
  }

  renderReference(task: Rec): string {
    if (!empty(task.reference)) {
      const reference = this.text.e(task.reference);

      if (isValidUrl(String(task.reference))) {
        // The unbalanced quote after target=_blank is part of the PHP output and is kept byte for byte.
        return `<a href="${reference}" target=_blank">${reference}</a>`;
      }

      return reference;
    }

    return '';
  }

  renderInternalLinkField(internallinks: Options, values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    let html = '';

    html += this.form.hidden('opposite_task_id', values);
    html += '<span class="task-internallink" title="' + t('Add internal link') + '">' + t('Add internal link') + '</span>';
    html += '<br><br>';
    html += this.form.label(t('Label'), 'link_id');
    html += this.form.select('link_id', internallinks, values, errors, attributes);

    html += this.form.label(t('Task'), 'title');
    html += this.form.text(
      'title',
      values,
      errors,
      [
        'required',
        'placeholder="' + t('Start to type task title...') + '"',
        'title="' + t('Start to type task title...') + '"',
        'data-dst-field="opposite_task_id"',
        'data-search-url="' + this.url.href('TaskAjaxController', 'autocomplete', { exclude_task_ids: values.task_ids }) + '"',
      ],
      'autocomplete',
    );

    return html;
  }

  renderFileUpload(screenshot = '', files: unknown[] = []): string {
    const uploadMaxSize = getUploadMaxSize() * 0.9; // 10% margin for the other part of request + conversion in base64
    let html = '<div class="task-form-bottom-column">';
    html += '    <div id="screenshot-zone">';
    html += '        <p id="screenshot-inner">' + t('Take a screenshot and press CTRL+V or ⌘+V to paste here.') + '</p>';
    html += '    </div>';
    html += '</div>';
    html += '<div class="task-form-bottom-column">';
    html += sibling<AppHelperLike>(this.helper, 'app').component('file-upload-task-create', {
      maxSize: uploadMaxSize,
      labelDropzone: t('Drag and drop your files here'),
      labelOr: t('or'),
      labelChooseFiles: t('choose files'),
      labelOversize: t('The total maximum allowed attachments size is %sB.', this.text.bytes(uploadMaxSize)),
      labelSuccess: t('All files have been uploaded successfully.'),
      labelCloseSuccess: t('Close this window'),
      labelUploadError: t('Unable to upload this file.'),
      screenshot,
      files,
    });
    html += '</div>';
    return html;
  }

  async getProgress(task: Rec): Promise<number> {
    const key = String(task.project_id);
    let columns = this.columns.get(key);

    if (columns === undefined) {
      columns = await this.collab('columnModel').getList(task.project_id);
      this.columns.set(key, columns);
    }

    return this.collab('taskModel').getProgress(task, columns);
  }

  getNewBoardTaskButton(swimlane: Rec, column: Rec): string {
    const modal = sibling<ModalHelperLike>(this.helper, 'modal');
    let html = '<div class="board-add-icon">';
    const providers = this.collab('externalTaskManager').getProviders();

    if (providers.length === 0) {
      html += modal.largeIcon('plus', t('Add a new task'), 'TaskCreationController', 'show', {
        project_id: column.project_id,
        column_id: column.id,
        swimlane_id: swimlane.id,
      });
    } else {
      html += '<div class="dropdown">';
      html += '<a href="#" class="dropdown-menu"><i class="fa fa-plus" aria-hidden="true"></i></a><ul>';

      const link = modal.large('plus', t('Add a new Kanboard task'), 'TaskCreationController', 'show', {
        project_id: column.project_id,
        column_id: column.id,
        swimlane_id: swimlane.id,
      });

      html += '<li>' + link + '</li>';

      for (const provider of providers) {
        const providerLink = this.url.link(
          provider.getMenuAddLabel(),
          'ExternalTaskCreationController',
          'step1',
          { project_id: column.project_id, swimlane_id: swimlane.id, column_id: column.id, provider_name: provider.getName() },
          false,
          'js-modal-large',
        );

        html += '<li>' + provider.getIcon() + ' ' + providerLink + '</li>';
      }

      html += '</ul></div>';
    }

    html += '</div>';

    return html;
  }
}
