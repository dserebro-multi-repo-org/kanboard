import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Paginator } from '../../../src/core/paginator.js';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import type { FormatterInterface } from '../../../src/core/filter/formatter-interface.js';
import type { Database } from '../../../src/db/database.js';
import { createTestContainer, migratedDb, type LooseContainer } from '../support/m6-container.js';
import { fakeRequest } from '../support/m6-models.js';

let db: Database;
let container: LooseContainer;

beforeEach(async () => {
  db = await migratedDb();
  container = createTestContainer(db);
  container.set('request', fakeRequest());
  for (let i = 1; i <= 12; i++) await db.table('settings').insert({ option: `opt${String(i).padStart(2, '0')}`, value: String(i) });
});
afterEach(async () => {
  await db.close();
});

const query = (): FilterQuery => db.table('settings').like('option', 'opt%') as unknown as FilterQuery;

async function paginator(max: number, params: Record<string, string | number> = {}): Promise<Paginator> {
  container.set('request', fakeRequest(params));
  return (await new Paginator(container as never).setUrl('MyController', 'show', { project_id: 3 }, 'anchor').setMax(max).setOrder('option').setQuery(query())).calculate();
}

describe('Paginator', () => {
  it('counts the items and returns the first page', async () => {
    const p = await paginator(5);
    expect(p.getTotal()).toBe(12);
    expect(p.isEmpty()).toBe(false);
    expect(p.getMax()).toBe(5);
    const items = await p.getCollection();
    expect(items.map((i) => i['option'])).toEqual(['opt01', 'opt02', 'opt03', 'opt04', 'opt05']);
  });

  it('reads the page, order and direction from the request', async () => {
    const p = await paginator(5, { page: 2, direction: 'DESC' });
    expect(p.getPage()).toBe(2);
    expect(p.getDirection()).toBe('DESC');
    expect((await p.getCollection()).map((i) => i['option'])).toEqual(['opt07', 'opt06', 'opt05', 'opt04', 'opt03']);
  });

  it('falls back to the first page when the page is invalid', async () => {
    expect((await paginator(5, { page: 0 })).getPage()).toBe(1);
    expect((await paginator(5, { page: 'abc' })).getPage()).toBe(1);
  });

  it('ignores an order that is not a valid column name', async () => {
    const p = await paginator(3, { order: 'option; DROP TABLE settings' });
    expect(await p.getCollection()).toHaveLength(3);
    expect(p.getOrder()).toBe('');
    expect(await db.table('settings').count()).toBeGreaterThan(12);
  });

  it('calculateOnlyIf does nothing when the condition is false', async () => {
    container.set('request', fakeRequest({ page: 3 }));
    const p = (await new Paginator(container as never).setMax(5).setOrder('option').setQuery(query())).calculateOnlyIf(false);
    expect(p.getPage()).toBe(1);
    expect((await p.getCollection())[0]!['option']).toBe('opt01');
  });

  it('uses the formatter and the manual collection', async () => {
    const formatter: FormatterInterface<Promise<unknown>> = {
      withQuery() {
        return this;
      },
      format: async () => ['formatted'],
    };
    const p = (await new Paginator(container as never).setMax(5).setQuery(query())).setFormatter(formatter);
    expect(await p.getCollection()).toEqual(['formatted']);
    p.setCollection(['manual']);
    expect(await p.getCollection()).toEqual(['manual']);
  });

  it('returns nothing without query', async () => {
    expect(await new Paginator(container as never).getCollection()).toEqual([]);
    expect(new Paginator(container as never).setTotal(4).getTotal()).toBe(4);
    expect(new Paginator(container as never).setPage(3).getPage()).toBe(3);
  });

  it('generates the pagination links', async () => {
    const first = await paginator(5);
    const html = first.toHtml();
    expect(html).toContain('<div class="pagination">');
    expect(html).toContain('<span class="pagination-showing">Showing 1-5 of 12</span>');
    expect(html).toContain('<span class="pagination-previous">&larr; Previous</span>');
    expect(html).toContain('<a href="?controller=MyController&action=show&project_id=3&page=2&order=option&direction=ASC" class="js-modal-replace" title="Next" anchor="anchor">Next &rarr;</a>');
    expect(String(first)).toBe(html);

    const middle = await paginator(5, { page: 2 });
    expect(middle.generatePreviousLink()).toContain('page=1&order=option&direction=ASC');
    expect(middle.generatePreviousLink()).toContain('&larr; Previous</a>');
    expect(middle.generateNextLink()).toContain('page=3');
    expect(middle.generatePageShowing()).toContain('Showing 6-10 of 12');

    const last = await paginator(5, { page: 3 });
    expect(last.generateNextLink()).toBe('<span class="pagination-next">Next &rarr;</span>');
    expect(last.generatePageShowing()).toContain('Showing 11-12 of 12');
  });

  it('shows nothing when everything fits on one page', async () => {
    const p = await paginator(30);
    expect(p.hasNothingToShow()).toBe(true);
    expect(p.toHtml()).toBe('');
  });

  it('generates the sortable column headers', async () => {
    const p = await paginator(5);
    expect(p.order('Option', 'option')).toContain('&#9650; <a href="?controller=MyController&action=show&project_id=3&page=1&order=option&direction=DESC"');
    expect(p.order('Value', 'value')).toBe(
      '<a href="?controller=MyController&action=show&project_id=3&page=1&order=value&direction=ASC" class="js-modal-replace" title="" anchor="">Value</a>',
    );
    const desc = await paginator(5, { direction: 'DESC' });
    expect(desc.order('Option', 'option')).toMatch(/^&#9660; .*direction=ASC/);
  });
});
