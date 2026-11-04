import MarkdownIt from 'markdown-it';
import type { Options, RendererRule as RenderRule, StateBlock, StateInline, Token } from 'markdown-it';
import { Base } from './container/base.js';
import type { Container } from './container/container.js';
import type { TaskFinderModelLike, UrlHelperLike, UserCacheDecoratorLike } from '../foundation/markdown-collaborators.js';

/**
 * Markdown renderer (port of `app/Core/Markdown.php`, which extends Parsedown 1.7.4).
 *
 * markdown-it is configured with custom block/inline rules that mimic Parsedown (headers without a
 * space, regex based emphasis/links/code spans, raw entities, escaped markup in safe mode, URL
 * whitelist, ...) and the Kanboard extensions: `#123` task links, `@name` user mentions and no
 * header for `#123` at the beginning of a line. Users/tokens are looked up asynchronously
 * *before* parsing (the lookups are a superset of what the rules need), so the rules stay synchronous
 * and `text()` is async.
 */

const SAFE_LINKS_WHITELIST = [
  'http://', 'https://', 'ftp://', 'ftps://', 'mailto:',
  'data:image/png;base64,', 'data:image/gif;base64,', 'data:image/jpeg;base64,',
  'irc:', 'ircs:', 'git:', 'ssh:', 'news:', 'steam:',
];

const SPECIAL_CHARACTERS = new Set(['\\', '`', '*', '_', '{', '}', '[', ']', '(', ')', '>', '#', '+', '-', '.', '!', '|']);

interface UserInfo {
  url: string;
  name: string;
}

interface MarkdownEnv {
  references?: Record<string, { href: string; title: string | null }>;
  taskLinks: Map<string, string>;
  users: Map<string, UserInfo | null>;
  unresolvedUsers: Set<string>;
  isPublicLink: boolean;
  /** Link nesting depth: links, URLs, task links and mentions are not nestable inside a link. */
  linkDepth: number;
}

/** PHP `htmlspecialchars()`: ENT_QUOTES for attributes, ENT_NOQUOTES for text-like content. */
function escapeHtml(text: string, allowQuotes = false): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return allowQuotes ? escaped : escaped.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Plain text of a paragraph: `&`, `<`, `>` and `"` are escaped, apostrophes are kept (Parsedown special characters). */
function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attr(name: string, value: string | null): string {
  return value === null ? '' : ` ${name}="${escapeHtml(value)}"`;
}

function startsWithInsensitive(value: string, prefix: string): boolean {
  return value.length >= prefix.length && value.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}

function safeUrl(url: string): string {
  return SAFE_LINKS_WHITELIST.some((scheme) => startsWithInsensitive(url, scheme)) ? url : url.replace(/:/g, '%3A');
}

function rtrim(value: string, chars: string): string {
  let end = value.length;
  while (end > 0 && chars.includes(value[end - 1] as string)) end--;
  return value.slice(0, end);
}

function trimChars(value: string, chars: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value[start] as string)) start++;
  while (end > start && chars.includes(value[end - 1] as string)) end--;
  return value.slice(start, end);
}

/** `Core\Markdown` replacement. */
export class Markdown extends Base {
  private safeMode = false;
  private markupEscaped = false;
  private breaksEnabled = false;
  private urlsLinked = true;

  constructor(
    container: Container,
    private readonly isPublicLink = false,
  ) {
    super(container);
  }

  setSafeMode(safeMode: boolean): this {
    this.safeMode = Boolean(safeMode);
    return this;
  }

  setMarkupEscaped(markupEscaped: boolean): this {
    this.markupEscaped = Boolean(markupEscaped);
    return this;
  }

  setBreaksEnabled(breaksEnabled: boolean): this {
    this.breaksEnabled = Boolean(breaksEnabled);
    return this;
  }

  setUrlsLinked(urlsLinked: boolean): this {
    this.urlsLinked = Boolean(urlsLinked);
    return this;
  }

  /** Convert Markdown to HTML (Parsedown `text()`). */
  async text(text: string): Promise<string> {
    const source = preprocess(text ?? '');
    const env: MarkdownEnv = {
      taskLinks: new Map(),
      users: new Map(),
      unresolvedUsers: new Set(),
      isPublicLink: this.isPublicLink,
      linkDepth: 0,
    };

    await this.resolveTaskLinks(source, env);

    const parser = this.createParser();
    let html = parser.render(source, env);

    // Mentions are resolved lazily: the rules report the usernames they met and could not resolve yet.
    while (env.unresolvedUsers.size > 0) {
      const usernames = [...env.unresolvedUsers];
      env.unresolvedUsers.clear();
      await this.resolveUsers(usernames, env);
      html = parser.render(source, env);
    }

    return trimChars(html, '\n');
  }

  /** Same as {@link text} (Parsedown `parse()`). */
  async parse(text: string): Promise<string> {
    return this.text(text);
  }

  // ---------------------------------------------------------------------------------------------
  // Collaborators (async lookups done before the synchronous parsing)
  // ---------------------------------------------------------------------------------------------

  private dep<T>(name: string): T {
    return (this.container as unknown as Container<Record<string, unknown>>).get(name) as T;
  }

  private async resolveTaskLinks(source: string, env: MarkdownEnv): Promise<void> {
    for (const match of source.matchAll(/#(\d+)/g)) {
      const id = match[1] as string;
      if (!env.taskLinks.has(id)) {
        env.taskLinks.set(id, await this.buildTaskLink(id));
      }
    }
  }

  private async resolveUsers(usernames: string[], env: MarkdownEnv): Promise<void> {
    for (const username of usernames) {
      const user = await this.dep<UserCacheDecoratorLike>('userCacheDecorator').getByUsername(username);
      if (user) {
        const helper = this.dep<{ get<H>(name: string): H }>('helper');
        const url = await helper.get<UrlHelperLike>('url').to('UserViewController', 'profile', { user_id: user.id });
        env.users.set(username, { url, name: user.name || user.username });
      } else {
        env.users.set(username, null);
      }
    }
  }

  private async buildTaskLink(taskId: string): Promise<string> {
    const url = this.dep<{ get<H>(name: string): H }>('helper').get<UrlHelperLike>('url');

    if (this.isPublicLink) {
      const cache = this.dep<{ proxy(object: unknown, method: string, ...args: unknown[]): unknown }>('memoryCache');
      const token = await cache.proxy(this.dep<TaskFinderModelLike>('taskFinderModel'), 'getProjectToken', taskId);

      if (token) {
        return url.to('TaskViewController', 'readonly', { token: String(token), task_id: taskId }, '', true);
      }

      return '';
    }

    return url.to('TaskViewController', 'show', { task_id: taskId });
  }

  // ---------------------------------------------------------------------------------------------
  // Parser
  // ---------------------------------------------------------------------------------------------

  private createParser(): MarkdownIt {
    const options: Options = {
      html: !this.markupEscaped && !this.safeMode,
      xhtmlOut: true,
      breaks: this.breaksEnabled,
      linkify: false,
      typographer: false,
    };
    const md = new MarkdownIt('default', options);
    const safeMode = this.safeMode;

    md.disable(['escape', 'backticks', 'strikethrough', 'emphasis', 'link', 'image', 'autolink', 'entity', 'html_inline'], true);
    md.disable(['balance_pairs'], true);

    md.block.ruler.at('heading', heading, { alt: ['paragraph', 'reference', 'blockquote'] });
    md.block.ruler.at('reference', reference, { alt: [] });
    md.block.ruler.at('paragraph', paragraph);
    const listRule = (md.block.ruler as unknown as { __rules__: Array<{ name: string; fn: BlockRule }> }).__rules__.find((rule) => rule.name === 'list')!.fn;
    md.block.ruler.at(
      'list',
      (state, startLine, endLine, silent) => {
        // Parsedown only knows `1.` ordered lists, not `1)`.
        const pos = state.bMarks[startLine]! + state.tShift[startLine]!;
        return /^\d+\)/.test(state.src.slice(pos, state.eMarks[startLine])) ? false : listRule(state, startLine, endLine, silent);
      },
      { alt: ['paragraph', 'reference', 'blockquote'] },
    );
    md.core.ruler.after('block', 'kb_list_looseness', listLooseness);

    md.inline.ruler.push('pb_escape', escapeSequence);
    md.inline.ruler.push('pb_code', codeSpan);
    md.inline.ruler.push('pb_emphasis', emphasis);
    md.inline.ruler.push('pb_strikethrough', strikethrough);
    md.inline.ruler.push('pb_image', image);
    md.inline.ruler.push('pb_link', link);
    md.inline.ruler.push('pb_url_tag', urlTag);
    md.inline.ruler.push('pb_email_tag', emailTag);
    md.inline.ruler.push('pb_entity', entity);
    if (this.urlsLinked) {
      md.inline.ruler.push('pb_url', url);
    }
    md.inline.ruler.push('kb_task_link', taskLink);
    md.inline.ruler.push('kb_user_link', userLink);

    const rules = md.renderer.rules;
    rules.text = (tokens, idx) => escapeText((tokens[idx] as Token).content);
    rules.code_inline = (tokens, idx) => `<code>${escapeHtml((tokens[idx] as Token).content, true)}</code>`;
    rules.code_block = (tokens, idx) => `<pre><code>${escapeHtml(trimEndNewline((tokens[idx] as Token).content), true)}</code></pre>\n`;
    rules.fence = (tokens, idx) => {
      const token = tokens[idx] as Token;
      const language = token.info.trim().split(/[ \t\n\f\r]/)[0] ?? '';
      const cls = language === '' ? '' : ` class="language-${escapeHtml(language)}"`;
      return `<pre><code${cls}>${escapeHtml(trimEndNewline(token.content), true)}</code></pre>\n`;
    };
    rules.link_open = (tokens, idx) => {
      const token = tokens[idx] as Token;
      let out = '<a';
      for (const [name, value] of token.attrs ?? []) {
        out += attr(name, safeMode && name === 'href' ? safeUrl(value) : value);
      }
      return `${out}>`;
    };
    rules.image = (tokens, idx) => {
      const token = tokens[idx] as Token;
      const src = token.attrGet('src') ?? '';
      const title = token.attrGet('title');
      return `<img${attr('src', safeMode ? safeUrl(src) : src)}${attr('alt', token.content)}${attr('title', title)} />`;
    };
    // Parsedown does not break the line between a nested list and the end of a tight item.
    const listClose = (tag: string): RenderRule => (tokens, idx) =>
      tokens[idx + 1]?.type === 'list_item_close' && isTightItem(tokens, idx + 1) ? `</${tag}>` : `</${tag}>\n`;
    rules.bullet_list_close = listClose('ul');
    rules.ordered_list_close = listClose('ol');
    const cell = (tag: string): RenderRule => (tokens, idx) => {
      const style = (tokens[idx] as Token).attrGet('style');
      const align = style === null ? '' : ` style="${style.replace(/^text-align:(\w+)$/, 'text-align: $1;')}"`;
      return `<${tag}${align}>`;
    };
    rules.th_open = cell('th');
    rules.td_open = cell('td');
    rules.html_inline = (tokens, idx) => (tokens[idx] as Token).content;

    return md;
  }
}

/** Parsedown pre-processing: line endings, tab expansion and blockquotes continued across blank lines. */
function preprocess(text: string): string {
  const lines = text.replace(/\r\n|\r/g, '\n').replace(/^\n+|\n+$/g, '').split('\n').map((line) => {
    let result = line;
    for (let tab = result.indexOf('\t'); tab !== -1; tab = result.indexOf('\t')) {
      result = result.slice(0, tab) + ' '.repeat(4 - (tab % 4)) + result.slice(tab + 1);
    }
    return result;
  });

  let inFence = false;
  const isQuote = (line: string | undefined): boolean => line !== undefined && /^ {0,3}>/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) inFence = !inFence;
    if (inFence || line.trim() !== '' || i === 0) continue;

    // Blank line(s) between two quote lines: the quote goes on.
    let previous = i - 1;
    while (previous >= 0 && (lines[previous] as string).trim() === '') previous--;
    let next = i;
    while (next < lines.length && (lines[next] as string).trim() === '') next++;
    if (isQuote(lines[previous]) && isQuote(lines[next])) {
      lines[i] = '>';
    }
  }

  return lines.join('\n');
}

type BlockRule = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;

function isTightItem(tokens: Token[], closeIdx: number): boolean {
  const level = (tokens[closeIdx] as Token).level;
  let open = closeIdx - 1;
  while (open >= 0 && !((tokens[open] as Token).type === 'list_item_open' && (tokens[open] as Token).level === level)) open--;
  return !tokens.slice(open + 1, closeIdx).some((t) => t.type === 'paragraph_open' && !t.hidden && t.level === level + 1);
}

function trimEndNewline(value: string): string {
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}

// ---------------------------------------------------------------------------------------------
// Block rules
// ---------------------------------------------------------------------------------------------

/** `blockCustomHeader` / `blockHeader`: no space required after the hashes, but `#123` is a task reference. */
function heading(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;

  const pos = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  const line = state.src.slice(pos, max);

  if (line[0] !== '#' || line.length < 2 || /^#\d+/.test(line)) return false;

  let level = 1;
  while (line[level] === '#') level++;
  if (level > 6) return false;

  if (silent) return true;

  const open = state.push('heading_open', `h${level}`, 1);
  open.markup = '#'.repeat(level);
  open.map = [startLine, startLine + 1];

  const inline = state.push('inline', '', 0);
  inline.content = trimChars(line, '# ');
  inline.map = [startLine, startLine + 1];
  inline.children = [];

  state.push('heading_close', `h${level}`, -1).markup = open.markup;
  state.line = startLine + 1;
  return true;
}

/** markdown-it paragraph without the trailing whitespace trimming (Parsedown keeps it). */
function paragraph(state: StateBlock, startLine: number, endLine: number): boolean {
  const terminators = state.md.block.ruler.getRules('paragraph');
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = 'paragraph';

  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine]! - state.blkIndent > 3) continue;
    if (state.sCount[nextLine]! < 0) continue;

    let terminate = false;
    for (const rule of terminators) {
      if (rule(state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) break;
  }

  const content = state.getLines(startLine, nextLine, state.blkIndent, false).replace(/^\s+/, '');

  state.line = nextLine;
  const open = state.push('paragraph_open', 'p', 1);
  open.map = [startLine, state.line];
  const inline = state.push('inline', '', 0);
  inline.content = content;
  inline.map = [startLine, state.line];
  inline.children = [];
  state.push('paragraph_close', 'p', -1);
  state.parentType = oldParentType;
  return true;
}

/**
 * Parsedown decides per list item whether paragraphs are kept: all the items when a blank line separates two
 * items, otherwise only the items that contain a blank line themselves (markdown-it makes the whole list loose).
 */
function listLooseness(state: { tokens: Token[] }): boolean {
  const tokens = state.tokens;

  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i] as Token;
    if (open.type !== 'bullet_list_open' && open.type !== 'ordered_list_open') continue;

    const items: Array<{ start: number; end: number }> = [];
    for (let j = i + 1; j < tokens.length; j++) {
      const token = tokens[j] as Token;
      if (token.level === open.level && token.type === open.type.replace('_open', '_close')) break;
      if (token.type === 'list_item_open' && token.level === open.level + 1) {
        let k = j + 1;
        while (!((tokens[k] as Token).type === 'list_item_close' && (tokens[k] as Token).level === token.level)) k++;
        items.push({ start: j, end: k });
      }
    }

    const paragraphs = (item: { start: number; end: number }): Token[] =>
      tokens.slice(item.start + 1, item.end).filter((t) => t.type === 'paragraph_open' && t.level === open.level + 2);
    if (items.every((item) => paragraphs(item).every((p) => p.hidden))) continue;

    const maps = items.map((item) => tokens[item.start]!.map);
    const blankBetweenItems = items.some((_, index) => {
      const next = maps[index + 1];
      const current = tokens.slice(items[index]!.start + 1, items[index]!.end).filter((t) => t.level === open.level + 2 && t.map && t.nesting >= 0);
      const lastEnd = Math.max(...current.map((t) => t.map![1]), -1);
      return next !== undefined && next !== null && lastEnd >= 0 && next[0] > lastEnd;
    });
    if (blankBetweenItems) continue;

    for (const item of items) {
      const children = tokens.slice(item.start + 1, item.end).filter((t) => t.level === open.level + 2 && t.map && t.nesting >= 0);
      const internalBlank = children.some((t, index) => index > 0 && t.map![0] > children[index - 1]!.map![1]);
      for (const p of paragraphs(item)) {
        p.hidden = !internalBlank;
        const index = tokens.indexOf(p);
        const close = tokens.slice(index).find((t) => t.type === 'paragraph_close' && t.level === p.level);
        if (close) close.hidden = !internalBlank;
      }
    }
  }
  return true;
}

/** `blockReference`: single line `[label]: url "title"` definitions. */
function reference(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;

  const pos = state.bMarks[startLine]! + state.tShift[startLine]!;
  const line = state.src.slice(pos, state.eMarks[startLine]!);
  if (line[0] !== '[') return false;

  const match = /^\[(.+?)\]:[ ]*<?(\S+?)>?(?:[ ]+["'(](.+)["')])?[ ]*$/.exec(line);
  if (match === null) return false;
  if (silent) return true;

  const env = state.env as MarkdownEnv;
  env.references ??= {};
  env.references[(match[1] as string).toLowerCase()] = { href: match[2] as string, title: match[3] ?? null };
  state.line = startLine + 1;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Inline rules
// ---------------------------------------------------------------------------------------------

function flushPending(state: StateInline): void {
  if (state.pending) {
    state.pushPending();
  }
}

function pushRaw(state: StateInline, html: string): void {
  flushPending(state);
  state.push('html_inline', '', 0).content = html;
}

/** Tokenize a nested segment (Parsedown `handler => line`) and append its tokens. */
function pushInner(state: StateInline, content: string): void {
  const children: Token[] = [];
  state.md.inline.parse(content, state.md, state.env, children);
  for (const child of children) {
    state.tokens.push(child);
  }
}

function pushLink(state: StateInline, attrs: Array<[string, string]>, text: string | null, inner: string | null): void {
  flushPending(state);
  const env = state.env as MarkdownEnv;
  const open = state.push('link_open', 'a', 1);
  open.attrs = attrs;
  env.linkDepth++;
  try {
    if (inner !== null) {
      pushInner(state, inner);
    } else if (text !== null) {
      state.push('html_inline', '', 0).content = escapeHtml(text, true);
    }
  } finally {
    env.linkDepth--;
  }
  state.push('link_close', 'a', -1);
}

function escapeSequence(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '\\') return false;
  const next = state.src[state.pos + 1];
  if (next === undefined || !SPECIAL_CHARACTERS.has(next)) return false;
  if (!silent) pushRaw(state, next);
  state.pos += 2;
  return true;
}

function entity(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '&') return false;
  if (!/^&#?\w+;/.test(state.src.slice(state.pos))) return false;
  // Parsedown leaves the ampersand of a valid entity untouched and goes on with the remaining text.
  if (!silent) pushRaw(state, '&');
  state.pos += 1;
  return true;
}

function codeSpan(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '`') return false;
  const match = /^(`+)[ ]*(.+?)[ ]*(?<!`)\1(?!`)/s.exec(state.src.slice(state.pos));
  if (match === null) return false;
  if (!silent) {
    flushPending(state);
    state.push('code_inline', 'code', 0).content = (match[2] as string).replace(/[ ]*\n/g, ' ');
  }
  state.pos += match[0].length;
  return true;
}

const STRONG: Record<string, RegExp> = {
  '*': /^[*]{2}((?:\\\*|[^*]|[*][^*]*[*])+?)[*]{2}(?![*])/s,
  _: /^__((?:\\_|[^_]|_[^_]*_)+?)__(?!_)/su,
};
const EM: Record<string, RegExp> = {
  '*': /^[*]((?:\\\*|[^*]|[*][*][^*]+?[*][*])+?)[*](?![*])/s,
  _: /^_((?:\\_|[^_]|__[^_]*__)+?)_(?!_)\b/su,
};

function emphasis(state: StateInline, silent: boolean): boolean {
  const marker = state.src[state.pos] as string;
  if (marker !== '*' && marker !== '_') return false;
  if (state.pos + 1 >= state.posMax) return false;

  const rest = state.src.slice(state.pos);
  let tag = 'strong';
  let match: RegExpExecArray | null = null;

  if (rest[1] === marker) {
    match = (STRONG[marker] as RegExp).exec(rest);
  }
  if (match === null) {
    tag = 'em';
    match = (EM[marker] as RegExp).exec(rest);
  }
  if (match === null) return false;

  if (!silent) {
    flushPending(state);
    state.push(`${tag}_open`, tag, 1);
    pushInner(state, match[1] as string);
    state.push(`${tag}_close`, tag, -1);
  }
  state.pos += match[0].length;
  return true;
}

function strikethrough(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '~' || state.src[state.pos + 1] !== '~') return false;
  const match = /^~~(?=\S)(.+?)(?<=\S)~~/.exec(state.src.slice(state.pos));
  if (match === null) return false;
  if (!silent) {
    flushPending(state);
    state.push('del_open', 'del', 1);
    pushInner(state, match[1] as string);
    state.push('del_close', 'del', -1);
  }
  state.pos += match[0].length;
  return true;
}

interface ParsedLink {
  extent: number;
  text: string;
  href: string;
  title: string | null;
}

/** `inlineLink` of Parsedown, anchored at `pos`. */
function parseLink(state: StateInline, pos: number): ParsedLink | null {
  const src = state.src;
  if (src[pos] !== '[') return null;

  let depth = 0;
  let end = -1;
  for (let i = pos; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const text = src.slice(pos + 1, end);
  let extent = end + 1 - pos;
  const remainder = src.slice(end + 1);

  const dest = /^[(]\s*((?:[^ ()]|[(][^ )]+[)])+)(?:[ ]+("[^"]*"|'[^']*'))?\s*[)]/.exec(remainder);
  if (dest !== null) {
    return {
      extent: extent + dest[0].length,
      text,
      href: dest[1] as string,
      title: dest[2] !== undefined ? dest[2].slice(1, -1) : null,
    };
  }

  let definition: string;
  const ref = /^\s*\[(.*?)\]/.exec(remainder);
  if (ref !== null) {
    definition = ((ref[1] as string).length > 0 ? (ref[1] as string) : text).toLowerCase();
    extent += ref[0].length;
  } else {
    definition = text.toLowerCase();
  }

  const refs = (state.env as MarkdownEnv).references;
  const found = refs !== undefined && Object.prototype.hasOwnProperty.call(refs, definition) ? refs[definition] : undefined;
  if (found === undefined) return null;

  return { extent, text, href: found.href, title: found.title };
}

function link(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '[' || (state.env as MarkdownEnv).linkDepth > 0) return false;
  const parsed = parseLink(state, state.pos);
  if (parsed === null) return false;

  if (!silent) {
    const attrs: Array<[string, string]> = [['href', parsed.href]];
    if (parsed.title !== null) attrs.push(['title', parsed.title]);
    pushLink(state, attrs, null, parsed.text);
  }
  state.pos += parsed.extent;
  return true;
}

function image(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '!' || state.src[state.pos + 1] !== '[') return false;
  const parsed = parseLink(state, state.pos + 1);
  if (parsed === null) return false;

  if (!silent) {
    flushPending(state);
    const token = state.push('image', 'img', 0);
    token.attrs = [['src', parsed.href]];
    if (parsed.title !== null) token.attrs.push(['title', parsed.title]);
    token.content = parsed.text;
  }
  state.pos += parsed.extent + 1;
  return true;
}

/** `inlineUrl`: the scheme has already been consumed as plain text, so it is taken back from the pending text. */
function url(state: StateInline, silent: boolean): boolean {
  const env = state.env as MarkdownEnv;
  if (state.src[state.pos] !== ':' || state.src[state.pos + 1] !== '/' || state.src[state.pos + 2] !== '/' || env.linkDepth > 0) return false;

  const scheme = /https?$/i.exec(state.pending);
  if (scheme === null) return false;

  const start = state.pos - scheme[0].length;
  const matcher = /\bhttps?:[/]{2}[^\s<]+\b\/*/iuy;
  matcher.lastIndex = start;
  const match = matcher.exec(state.src);
  if (match === null) return false;

  if (!silent) {
    state.pending = state.pending.slice(0, state.pending.length - scheme[0].length);
    pushLink(state, [['href', match[0]]], match[0], null);
  }
  state.pos = start + match[0].length;
  return true;
}

function urlTag(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '<' || (state.env as MarkdownEnv).linkDepth > 0) return false;
  const match = /^<(\w+:\/{2}[^ >]+)>/i.exec(state.src.slice(state.pos));
  if (match === null) return false;
  if (!silent) pushLink(state, [['href', match[1] as string]], match[1] as string, null);
  state.pos += match[0].length;
  return true;
}

function emailTag(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '<' || (state.env as MarkdownEnv).linkDepth > 0) return false;
  const match = /^<((mailto:)?\S+?@\S+?)>/i.exec(state.src.slice(state.pos));
  if (match === null) return false;
  if (!silent) {
    const href = match[2] === undefined ? `mailto:${match[1]}` : (match[1] as string);
    pushLink(state, [['href', href]], match[1] as string, null);
  }
  state.pos += match[0].length;
  return true;
}

/** Kanboard `inlineTaskLink`: reproduces the unanchored `#(\d+)` search of the original. */
function taskLink(state: StateInline, silent: boolean): boolean {
  const env = state.env as MarkdownEnv;
  if (state.src[state.pos] !== '#' || env.linkDepth > 0) return false;

  const match = /#(\d+)/.exec(state.src.slice(state.pos));
  if (match === null) return false;

  const href = env.taskLinks.get(match[1] as string);
  if (!href) return false;

  if (!silent) pushLink(state, [['href', href]], match[0], null);
  state.pos += match[0].length;
  return true;
}

/** Kanboard `inlineUserLink`. */
function userLink(state: StateInline, silent: boolean): boolean {
  const env = state.env as MarkdownEnv;
  if (state.src[state.pos] !== '@' || env.isPublicLink || env.linkDepth > 0) return false;

  const match = /^@([^\s,!:?]+)/.exec(state.src.slice(state.pos));
  if (match === null) return false;

  const username = rtrim(match[1] as string, '.');
  if (username === '') return false;
  const user = env.users.get(username);
  if (user === undefined) {
    env.unresolvedUsers.add(username);
    return false;
  }
  if (user === null) return false;

  if (!silent) {
    pushLink(
      state,
      [
        ['href', user.url],
        ['class', 'user-mention-link'],
        ['title', user.name],
        ['aria-label', user.name],
      ],
      `@${username}`,
      null,
    );
  }
  state.pos += username.length + 1;
  return true;
}
