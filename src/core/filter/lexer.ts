export interface LexerToken {
  match: string;
  token: string;
}

/** Tokens found in a query: token name to the list of values. */
export type LexerResult = Record<string, string[]>;

interface TokenDefinition {
  regex: RegExp;
  name: string;
}

/**
 * Convert a PHP style pattern (`/^(foo)/iu`) to a RegExp. RegExp instances are returned untouched.
 * The `u` flag is always set; `\w` is made Unicode aware, as PCRE does with the `u` modifier.
 */
function toRegExp(pattern: string | RegExp): RegExp {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  const end = pattern.lastIndexOf('/');
  if (!pattern.startsWith('/') || end <= 0) {
    return new RegExp(pattern, 'u');
  }

  const flags = new Set(pattern.slice(end + 1).split('').filter((f) => 'ims'.includes(f)));
  flags.add('u');
  const source = pattern.slice(1, end).replace(/(\\\\)|\\w/g, (m, escaped: string | undefined) => (escaped === undefined ? '[\\p{L}\\p{N}_]' : m));
  return new RegExp(source, [...flags].join(''));
}

/** Port of `Kanboard\Core\Filter\Lexer`. */
export class Lexer {
  private offset = 0;

  /** Token map, the first matching pattern wins; added tokens go first. */
  private tokenMap: TokenDefinition[] = [
    { regex: toRegExp('/^(\\s+)/'), name: 'T_WHITESPACE' },
    { regex: toRegExp('/^([<=>]{0,2}[0-9]{4}-[0-9]{2}-[0-9]{2})/'), name: 'T_STRING' },
    { regex: toRegExp('/^([<=>]{1,2}\\w+)/u'), name: 'T_STRING' },
    { regex: toRegExp('/^([<=>]{1,2}".+")/'), name: 'T_STRING' },
    { regex: toRegExp('/^("(.*?)")/'), name: 'T_STRING' },
    { regex: toRegExp('/^(\\S+)/u'), name: 'T_STRING' },
    { regex: toRegExp('/^(#\\d+)/'), name: 'T_STRING' },
  ];

  private defaultToken = '';

  /** Add a token (PHP pattern string or RegExp with the token in the first group); replaces the same pattern. */
  addToken(regex: string | RegExp, token: string): this {
    const definition = { regex: toRegExp(regex), name: token };
    const key = definition.regex.toString();
    this.tokenMap = [definition, ...this.tokenMap.filter((d) => d.regex.toString() !== key)];
    return this;
  }

  setDefaultToken(token: string): this {
    this.defaultToken = token;
    return this;
  }

  /** Tokenize the input; returns an empty object when a part of it cannot be matched. */
  tokenize(input: string | null | undefined): LexerResult {
    const tokens: LexerToken[] = [];
    this.offset = 0;
    const text = input ?? '';

    while (this.offset < text.length) {
      const result = this.match(text.slice(this.offset));

      if (result === false) {
        return {};
      }

      tokens.push(result);
    }

    return this.map(tokens);
  }

  /** Find a token that matches and move the offset. */
  protected match(input: string): LexerToken | false {
    for (const { regex, name } of this.tokenMap) {
      const matches = regex.exec(input);

      if (matches !== null) {
        const value = matches[1] ?? '';
        this.offset += value.length;

        return { match: value.replaceAll('"', ''), token: name };
      }
    }

    return false;
  }

  /** Build the map of tokens and matches. */
  protected map(tokens: LexerToken[]): LexerResult {
    const map: LexerResult = {};
    let leftOver = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] as LexerToken;

      if (token.token === 'T_STRING' || token.token === 'T_WHITESPACE') {
        leftOver += token.match;
      } else {
        // The value following a token is consumed, whatever its type (PHP `next($tokens)`).
        const next = tokens[++i];

        if (next !== undefined && next.token === 'T_STRING') {
          (Object.hasOwn(map, token.token) ? (map[token.token] as string[]) : (map[token.token] = [])).push(next.match);
        }
      }
    }

    leftOver = leftOver.trim();

    if (this.defaultToken !== '' && leftOver !== '') {
      map[this.defaultToken] = [leftOver];
    }

    return map;
  }

  /** Independent copy (PHP `clone`). */
  clone(): Lexer {
    const copy = Object.create(Object.getPrototypeOf(this) as object) as Lexer;
    Object.assign(copy, this);
    copy.tokenMap = [...this.tokenMap];
    return copy;
  }
}
