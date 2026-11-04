import type { FilterQuery } from './filter/filter-interface.js';
import type { FormatterInterface } from './filter/formatter-interface.js';
import type { Container } from './container/container.js';
import '../service-provider/registry.js';
import { collaborator, type UrlHelperLike } from '../foundation/formatter-collaborators.js';
import { t } from '../foundation/translator.js';
import type { Row } from '../foundation/model.js';

/**
 * Paginator Helper (port of `Kanboard\Core\Paginator`).
 *
 * Differences with PHP, due to the asynchronous database layer: {@link setQuery} (which counts the rows)
 * and {@link getCollection} / {@link executeQuery} return promises.
 */
export class Paginator {
  private total = 0;
  private page = 1;
  private offset = 0;
  private limit = 0;
  private sortColumn = '';
  private direction = 'ASC';
  private items: unknown[] = [];
  private query: FilterQuery | null = null;
  private controller = '';
  private action = '';
  private anchor = '';
  private params: Row = {};
  protected formatter: FormatterInterface<unknown> | null = null;

  constructor(private readonly container: Container) {}

  /** Set a query and count the total number of items. */
  async setQuery(query: FilterQuery): Promise<this> {
    this.query = query;
    this.total = await query.count();
    return this;
  }

  /** Set the formatter applied to the query result. */
  setFormatter(formatter: FormatterInterface<unknown>): this {
    this.formatter = formatter;
    return this;
  }

  /** Execute the query (offset, limit and sorting applied) and format the result. */
  async executeQuery(): Promise<unknown[]> {
    if (this.query !== null) {
      this.query.offset(this.offset).limit(this.limit);

      if (/^[a-zA-Z0-9._]+$/.test(this.sortColumn)) {
        this.query.orderBy(this.sortColumn, this.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
      } else {
        this.sortColumn = '';
      }

      if (this.formatter !== null) {
        return (await this.formatter.withQuery(this.query).format()) as unknown[];
      }

      return this.query.findAll();
    }

    return [];
  }

  setUrl(controller: string, action: string, params: Row = {}, anchor = ''): this {
    this.controller = controller;
    this.action = action;
    this.params = params;
    this.anchor = anchor;
    return this;
  }

  /** Set the items manually. */
  setCollection(items: unknown[]): this {
    this.items = items;
    return this;
  }

  /** The items: the manual collection when it is not empty, otherwise the query result. */
  async getCollection<T = Row>(): Promise<T[]> {
    return (this.items.length > 0 ? this.items : await this.executeQuery()) as T[];
  }

  setTotal(total: number): this {
    this.total = total;
    return this;
  }

  getTotal(): number {
    return this.total;
  }

  setPage(page: number): this {
    this.page = page;
    return this;
  }

  getPage(): number {
    return this.page;
  }

  /** Set the default column order. */
  setOrder(order: string): this {
    this.sortColumn = order;
    return this;
  }

  getOrder(): string {
    return this.sortColumn;
  }

  /** Set the default sorting direction. */
  setDirection(direction: string): this {
    this.direction = direction;
    return this;
  }

  getDirection(): string {
    return this.direction;
  }

  /** Set the maximum number of items per page. */
  setMax(limit: number): this {
    this.limit = limit;
    return this;
  }

  getMax(): number {
    return this.limit;
  }

  isEmpty(): boolean {
    return this.total === 0;
  }

  /** Execute the offset calculation only if the condition is true. */
  calculateOnlyIf(condition: boolean): this {
    if (condition) {
      this.calculate();
    }

    return this;
  }

  /** Calculate the offset value according to the url params and the page number. */
  calculate(): this {
    const request = collaborator(this.container, 'request');

    this.page = request.getIntegerParam('page', 1);
    this.direction = request.getStringParam('direction', this.direction);
    this.sortColumn = request.getStringParam('order', this.sortColumn);

    if (this.page < 1) {
      this.page = 1;
    }

    this.offset = Math.trunc((this.page - 1) * this.limit);

    return this;
  }

  /** Url params for link generation. */
  getUrlParams(page: number, order: string, direction: string): Row {
    return { ...this.params, page, order, direction };
  }

  private get urlHelper(): UrlHelperLike {
    return this.container.get('helper').get<UrlHelperLike>('url');
  }

  generatePreviousLink(): string {
    let html = '<span class="pagination-previous">';

    if (this.offset > 0) {
      html += this.urlHelper.link(
        `&larr; ${t('Previous')}`,
        this.controller,
        this.action,
        this.getUrlParams(this.page - 1, this.sortColumn, this.direction),
        false,
        'js-modal-replace',
        t('Previous'),
        false,
        this.anchor,
      );
    } else {
      html += `&larr; ${t('Previous')}`;
    }

    return `${html}</span>`;
  }

  generateNextLink(): string {
    let html = '<span class="pagination-next">';

    if (this.total - this.offset > this.limit) {
      html += this.urlHelper.link(
        `${t('Next')} &rarr;`,
        this.controller,
        this.action,
        this.getUrlParams(this.page + 1, this.sortColumn, this.direction),
        false,
        'js-modal-replace',
        t('Next'),
        false,
        this.anchor,
      );
    } else {
      html += `${t('Next')} &rarr;`;
    }

    return `${html}</span>`;
  }

  generatePageShowing(): string {
    return `<span class="pagination-showing">${t(
      'Showing %d-%d of %d',
      (this.getPage() - 1) * this.getMax() + 1,
      Math.min(this.getTotal(), this.getPage() * this.getMax()),
      this.getTotal(),
    )}</span>`;
  }

  /** True if there is no pagination to show. */
  hasNothingToShow(): boolean {
    return this.offset === 0 && this.total - this.offset <= this.limit;
  }

  /** Pagination links. */
  toHtml(): string {
    let html = '';

    if (!this.hasNothingToShow()) {
      html += '<div class="pagination">';
      html += this.generatePageShowing();
      html += this.generatePreviousLink();
      html += this.generateNextLink();
      html += '</div>';
    }

    return html;
  }

  toString(): string {
    return this.toHtml();
  }

  /** Column sorting link (PHP `order($label, $column)`). */
  order(label: string, column: string): string {
    let prefix = '';
    let direction = 'ASC';

    if (this.sortColumn === column) {
      prefix = this.direction === 'DESC' ? '&#9660; ' : '&#9650; ';
      direction = this.direction === 'DESC' ? 'ASC' : 'DESC';
    }

    return (
      prefix +
      this.urlHelper.link(
        label,
        this.controller,
        this.action,
        this.getUrlParams(this.page, column, direction),
        false,
        'js-modal-replace',
      )
    );
  }
}
