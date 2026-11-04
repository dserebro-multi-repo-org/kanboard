import { describe, expect, it } from 'vitest';
import type { SubtaskHelper } from '../../../src/helper/subtask-helper.js';
import { Role } from '../../../src/helper/batch-b-support.js';
import { makeBatchBContainer } from './batch-b-fixture.js';
import { helpers } from './fixture.js';

async function setup() {
  const { container, state } = await makeBatchBContainer();
  return { h: helpers(container).get<SubtaskHelper>('subtask'), state };
}

describe('SubtaskHelper', () => {
  it('renderTitle', async () => {
    const { h, state } = await setup();
    expect(h.renderTitle({ status: 0, title: 'A<' })).toBe('<i class="fa fa-square-o fa-fw "></i>A&lt;');
    state.subtaskInProgress = true;
    expect(h.renderTitle({ status: '0', title: 'A' })).toBe('<i class="fa fa-square-o fa-fw js-modal-confirm"></i>A');
    expect(h.renderTitle({ status: 1, title: 'B' })).toBe('<i class="fa fa-gears fa-fw"></i>B');
    expect(h.renderTitle({ status: 2, title: 'C' })).toBe('<i class="fa fa-check-square-o fa-fw"></i>C');
  });

  it('getSubtaskTooltip', async () => {
    const { h } = await setup();
    expect(h.getSubtaskTooltip({ status: 0 })).toBe('Subtask not started');
    expect(h.getSubtaskTooltip({ status: 1 })).toBe('Subtask currently in progress');
    expect(h.getSubtaskTooltip({ status: 2 })).toBe('Subtask completed');
    expect(h.getSubtaskTooltip({ status: 9 })).toBe('');
  });

  it('renderToggleStatus without access only renders the title', async () => {
    const { h } = await setup();
    const html = await h.renderToggleStatus({ project_id: 1 }, { id: 1, task_id: 2, status: 1, title: 'x' });
    expect(html).toBe('<span class="subtask-title"><i class="fa fa-gears fa-fw"></i>x</span>');
  });

  it('renderToggleStatus with access renders a link', async () => {
    const { h, state } = await setup();
    state.user = { id: 1, role: Role.APP_ADMIN };
    const subtask = { id: 3, task_id: 2, status: 0, title: 'x' };
    let html = await h.renderToggleStatus({ project_id: 1 }, subtask, 'frag', 4);
    expect(html).toContain('SubtaskStatusController');
    expect(html).toContain('js-subtask-toggle-status');
    expect(html).toContain('Subtask not started');
    expect(html).toContain('csrf_token=csrf');
    state.subtaskInProgress = true;
    html = await h.renderToggleStatus({ project_id: 1 }, subtask);
    expect(html).toContain('SubtaskRestrictionController');
    expect(html).toContain('js-modal-confirm');
  });

  it('renderTimer', async () => {
    const { h } = await setup();
    const start = h.renderTimer({}, { id: 1, task_id: 2, is_timer_started: 0 });
    expect(start.startsWith('<span class="subtask-timer-toggle">')).toBe(true);
    expect(start).toContain('fa-play-circle-o');
    expect(start).toContain('timer=start');
    const stop = h.renderTimer({}, { id: 1, task_id: 2, is_timer_started: 1, timer_start_date: Math.floor(Date.now() / 1000) - 2 * 3600 });
    expect(stop).toContain('fa-pause');
    expect(stop).toContain('timer=stop');
    expect(stop).toContain(' (~2h)');
    expect(stop.endsWith('</span>')).toBe(true);
  });

  it('form fields', async () => {
    const { h, state } = await setup();
    state.user = { id: 9, role: Role.APP_USER };
    expect(h.renderTitleField({ title: 't' }, {})).toContain('form-max-width');
    expect(h.renderBulkTitleField({}, {})).toContain('<p class="form-help">Enter one subtask by line.</p>');
    expect(h.renderAssigneeField({ 9: 'me' }, {})).toContain('data-current-id="9"');
    expect(h.renderTimeEstimatedField({})).toContain('tabindex="3"');
    expect(h.renderTimeSpentField({})).toContain('tabindex="4"');
  });
});
