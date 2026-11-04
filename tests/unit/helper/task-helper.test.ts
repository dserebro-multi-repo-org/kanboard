import { describe, expect, it } from 'vitest';
import type { TaskHelper } from '../../../src/helper/task-helper.js';
import { makeBatchBContainer } from './batch-b-fixture.js';
import { helpers, setService } from './fixture.js';

async function setup() {
  const { container, state } = await makeBatchBContainer();
  return { h: helpers(container).get<TaskHelper>('task'), container, state };
}

describe('TaskHelper', () => {
  it('selectPriority', async () => {
    const { h } = await setup();
    expect(h.renderPriorityField({ priority_end: '1', priority_start: '5', priority_default: '2' }, {})).not.toBe('');
    expect(h.renderPriorityField({ priority_end: '3', priority_start: '1', priority_default: '2' }, {})).not.toBe('');
  });

  it('renders the priority options in the PHP range order with the default selected', async () => {
    const { h } = await setup();
    const html = h.renderPriorityField({ priority_end: '1', priority_start: '3', priority_default: '2' }, {});
    expect(html.indexOf('value="3"')).toBeLessThan(html.indexOf('value="2"'));
    expect(html.indexOf('value="2"')).toBeLessThan(html.indexOf('value="1"'));
    expect(html).toContain('<option value="2" selected="selected">2</option>');
    expect(html).toContain('tabindex="9"');
  });

  it('formatPriority', async () => {
    const { h } = await setup();
    expect(h.renderPriority(2)).toBe('<span class="task-priority" title="Task priority"><span class="ui-helper-hidden-accessible">Task priority </span>P2</span>');
    expect(h.renderPriority(-6)).toBe('<span class="task-priority" title="Task priority"><span class="ui-helper-hidden-accessible">Task priority </span>-P6</span>');
    expect(h.renderPriority(0)).toContain('>P0</span>');
  });

  it('renderReference', async () => {
    const { h } = await setup();
    expect(h.renderReference({})).toBe('');
    expect(h.renderReference({ reference: '' })).toBe('');
    expect(h.renderReference({ reference: 'ABC-1<' })).toBe('ABC-1&lt;');
    expect(h.renderReference({ reference: 'https://example.org/a?b=1&c=2' })).toBe(
      '<a href="https://example.org/a?b=1&amp;c=2" target=_blank">https://example.org/a?b=1&amp;c=2</a>',
    );
  });

  it('renderTitleField and renderDescriptionField', async () => {
    const { h } = await setup();
    const title = h.renderTitleField({ title: 'Hello' }, {});
    expect(title).toContain('class="ui-helper-hidden-accessible"');
    expect(title).toContain('autofocus required tabindex="1" placeholder="Title"');
    expect(h.renderDescriptionField({ description: 'x' }, {})).toContain('"tabindex":2');
  });

  it('renders optional fields only when needed', async () => {
    const { h } = await setup();
    expect(h.renderCategoryField({ 0: 'None' }, {})).toBe('');
    expect(h.renderCategoryField({ 0: 'None' }, {}, {}, [], true)).toContain('name="category_id"');
    expect(h.renderCategoryField({ 0: 'None', 1: 'Cat' }, {})).toContain('tabindex="6"');
    expect(h.renderSwimlaneField({ 1: 'Default' }, {})).toBe('');
    expect(h.renderSwimlaneField({ 1: 'Default', 2: 'Other' }, {})).toContain('tabindex="7"');
    expect(h.renderColumnField({ 1: 'Backlog' }, {})).toContain('tabindex="8"');
    expect(h.renderScoreField({})).toContain('tabindex="14"');
    expect(h.renderReferenceField({})).toContain('form-input-small');
    expect(h.renderTimeEstimatedField({})).toMatch(/ hours$/);
    expect(h.renderTimeSpentField({})).toMatch(/ hours$/);
    expect(h.renderStartDateField({})).toContain('date_started');
    expect(h.renderDueDateField({})).toContain('date_due');
  });

  it('renderAssigneeField honours the project role restriction', async () => {
    const { h, state } = await setup();
    state.user = { id: 5, role: 'app-user' };
    state.projectRoles = { 1: 'Custom' };
    expect(await h.renderAssigneeField({ 0: 'None', 5: 'me' }, {})).toContain('data-current-id="5"');
    expect(await h.renderAssigneeField({ 5: 'me' }, { project_id: 1 })).toContain('tabindex="5"');
    state.projectRestrictions = [{ rule: 'task_change_assignee' }];
    expect(await h.renderAssigneeField({ 5: 'me' }, { project_id: 1 })).toBe('');
  });

  it('renderTagField and renderDescriptionTemplateDropdown', async () => {
    const { h, container } = await setup();
    setService(container, 'tagModel', { getAssignableList: () => ({ a: 'a&b', 2: 'two' }) });
    setService(container, 'predefinedTaskDescriptionModel', {
      getAll: (id: number) => (id === 1 ? [{ title: 'T<1', description: 'D"1' }] : []),
    });
    const tags = await h.renderTagField({ id: 1, enable_global_tags: 1 }, ['two']);
    expect(tags).toContain('<input type="hidden" name="tags[]" value="">');
    expect(tags).toContain('<option value="a&amp;b" >a&amp;b</option>');
    expect(tags).toContain('<option value="two" selected="selected">two</option>');

    const dropdown = await h.renderDescriptionTemplateDropdown(1);
    expect(dropdown).toContain('data-template="D&quot;1"');
    expect(dropdown).toContain('>T&lt;1</a>');
    expect(await h.renderDescriptionTemplateDropdown(2)).toBe('');
  });

  it('getProgress caches the columns per project', async () => {
    const { h, container } = await setup();
    let calls = 0;
    setService(container, 'columnModel', { getList: () => (calls++, { 1: 'A' }) });
    setService(container, 'taskModel', { getProgress: (_task: unknown, columns: Record<string, string>) => Object.keys(columns).length * 10 });
    expect(await h.getProgress({ project_id: 1 })).toBe(10);
    expect(await h.getProgress({ project_id: 1 })).toBe(10);
    expect(calls).toBe(1);
  });

  it('getNewBoardTaskButton with and without external providers', async () => {
    const { h, container } = await setup();
    const swimlane = { id: 3 };
    const column = { id: 2, project_id: 1 };
    const single = h.getNewBoardTaskButton(swimlane, column);
    expect(single.startsWith('<div class="board-add-icon">')).toBe(true);
    expect(single).toContain('TaskCreationController');
    expect(single).not.toContain('dropdown');

    setService(container, 'externalTaskManager', {
      getProviders: () => [{ getName: () => 'jira', getIcon: () => '<i class="x"></i>', getMenuAddLabel: () => 'Add Jira' }],
    });
    const multi = h.getNewBoardTaskButton(swimlane, column);
    expect(multi).toContain('<div class="dropdown">');
    expect(multi).toContain('Add a new Kanboard task');
    expect(multi).toContain('<li><i class="x"></i> <a href=');
    expect(multi).toContain('provider_name=jira');
    expect(multi.endsWith('</ul></div></div>')).toBe(true);
  });

  it('renderInternalLinkField and renderFileUpload', async () => {
    const { h } = await setup();
    const link = h.renderInternalLinkField({ 1: 'relates to' }, { task_ids: [4, 5] });
    expect(link).toContain('name="opposite_task_id"');
    expect(link).toContain('data-dst-field="opposite_task_id"');
    expect(link).toContain('TaskAjaxController');
    const upload = h.renderFileUpload('shot', ['f']);
    expect(upload).toContain('id="screenshot-zone"');
    expect(upload.startsWith('<div class="task-form-bottom-column">')).toBe(true);
  });

  it('simple model delegations', async () => {
    const { h, container } = await setup();
    setService(container, 'colorModel', { getList: () => ({ yellow: 'Yellow' }) });
    setService(container, 'taskRecurrenceModel', {
      getRecurrenceTriggerList: () => ({ 1: 'a' }),
      getRecurrenceTimeframeList: () => ({ 2: 'b' }),
      getRecurrenceBasedateList: () => ({ 3: 'c' }),
    });
    expect(await h.getColors()).toEqual({ yellow: 'Yellow' });
    expect(await h.recurrenceTriggers()).toEqual({ 1: 'a' });
    expect(await h.recurrenceTimeframes()).toEqual({ 2: 'b' });
    expect(await h.recurrenceBasedates()).toEqual({ 3: 'c' });
  });
});
