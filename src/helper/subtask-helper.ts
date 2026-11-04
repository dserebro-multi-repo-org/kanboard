import { t } from '../core/translator/functions.js';
import { BatchBHelper, SubtaskStatus, looseEq, sibling, type Rec } from './batch-b-support.js';
import type { DateHelper } from './date-helper.js';
import type { UserHelper } from './user-helper.js';

/** Port of `app/Helper/SubtaskHelper.php`. */
export class SubtaskHelper extends BatchBHelper {
  /** Return if the current user has a subtask in progress. */
  hasSubtaskInProgress(): boolean {
    return this.collab('session').isTrue('hasSubtaskInProgress');
  }

  /** Render subtask title. */
  renderTitle(subtask: Rec): string {
    let html: string;

    if (looseEq(subtask.status, 0)) {
      html = '<i class="fa fa-square-o fa-fw ' + (this.hasSubtaskInProgress() ? 'js-modal-confirm' : '') + '"></i>';
    } else if (looseEq(subtask.status, 1)) {
      html = '<i class="fa fa-gears fa-fw"></i>';
    } else {
      html = '<i class="fa fa-check-square-o fa-fw"></i>';
    }

    return html + this.text.e(subtask.title);
  }

  /** Get the link to toggle subtask status. */
  async renderToggleStatus(task: Rec, subtask: Rec, fragment = '', userId: unknown = 0): Promise<string> {
    let html: string;

    if (!(await this.helper.get<UserHelper>('user').hasProjectAccess('SubtaskController', 'edit', task.project_id))) {
      html = this.renderTitle(subtask);
    } else {
      const title = this.renderTitle(subtask);
      const params = {
        project_id: task.project_id,
        task_id: subtask.task_id,
        subtask_id: subtask.id,
        user_id: userId,
        fragment,
        csrf_token: this.collab('token').getReusableCSRFToken(),
      };

      if (looseEq(subtask.status, 0) && this.hasSubtaskInProgress()) {
        html = this.url.link(title, 'SubtaskRestrictionController', 'show', params, false, 'js-modal-confirm', this.getSubtaskTooltip(subtask));
      } else {
        html = this.url.link(title, 'SubtaskStatusController', 'change', params, false, 'js-subtask-toggle-status', this.getSubtaskTooltip(subtask));
      }
    }

    return '<span class="subtask-title">' + html + '</span>';
  }

  renderTimer(_task: Rec, subtask: Rec): string {
    let html = '<span class="subtask-timer-toggle">';
    const params: Rec = {
      task_id: subtask.task_id,
      subtask_id: subtask.id,
      timer: '',
      csrf_token: this.collab('token').getReusableCSRFToken(),
    };

    if (subtask.is_timer_started && subtask.is_timer_started !== '0') {
      params.timer = 'stop';
      html += this.url.icon('pause', t('Stop timer'), 'SubtaskStatusController', 'timer', params, false, 'js-subtask-toggle-timer');
      html += ' (' + sibling<DateHelper>(this.helper, 'dt').age(Number(subtask.timer_start_date)) + ')';
    } else {
      params.timer = 'start';
      html += this.url.icon('play-circle-o', t('Start timer'), 'SubtaskStatusController', 'timer', params, false, 'js-subtask-toggle-timer');
    }

    html += '</span>';

    return html;
  }

  renderBulkTitleField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="1"', 'required', ...attributes];

    let html = this.form.label(t('Title'), 'title');
    html += this.form.textarea('title', values, errors, attrs);
    html += '<p class="form-help">' + t('Enter one subtask by line.') + '</p>';

    return html;
  }

  renderTitleField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="1"', 'required', ...attributes];

    let html = this.form.label(t('Title'), 'title');
    html += this.form.text('title', values, errors, attrs, 'form-max-width');

    return html;
  }

  renderAssigneeField(users: Rec, values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="2"', ...attributes];

    let html = this.form.label(t('Assignee'), 'user_id');
    html += this.form.select('user_id', users, values, errors, attrs);
    html += '&nbsp;';
    html += '<small>';
    html +=
      '<a href="#" class="assign-me" data-target-id="form-user_id" data-current-id="' +
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

  renderTimeEstimatedField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="3"', ...attributes];

    let html = this.form.label(t('Original estimate'), 'time_estimated');
    html += this.form.numeric('time_estimated', values, errors, attrs);
    html += ' ' + t('hours');

    return html;
  }

  renderTimeSpentField(values: Rec, errors: Rec = {}, attributes: string[] = []): string {
    const attrs = ['tabindex="4"', ...attributes];

    let html = this.form.label(t('Time spent'), 'time_spent');
    html += this.form.numeric('time_spent', values, errors, attrs);
    html += ' ' + t('hours');

    return html;
  }

  getSubtaskTooltip(subtask: Rec): string {
    switch (Number(subtask.status)) {
      case SubtaskStatus.STATUS_TODO:
        return t('Subtask not started');
      case SubtaskStatus.STATUS_INPROGRESS:
        return t('Subtask currently in progress');
      case SubtaskStatus.STATUS_DONE:
        return t('Subtask completed');
    }

    return '';
  }
}
