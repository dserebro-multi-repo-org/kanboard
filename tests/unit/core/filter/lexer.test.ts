import { describe, expect, it } from 'vitest';
import { Lexer } from '../../../../src/core/filter/lexer.js';

const withToken = (pattern: string, token: string, defaultToken?: string): Lexer => {
  const lexer = new Lexer();
  lexer.addToken(pattern, token);
  if (defaultToken !== undefined) lexer.setDefaultToken(defaultToken);
  return lexer;
};

describe('Lexer', () => {
  it('returns nothing without default token', () => {
    expect(new Lexer().tokenize('This is Kanboard')).toEqual({});
  });

  it('tokenizes with a default token', () => {
    const lexer = new Lexer().setDefaultToken('myDefaultToken');
    expect(lexer.tokenize('This is Kanboard')).toEqual({ myDefaultToken: ['This is Kanboard'] });
  });

  it('tokenizes with a custom token', () => {
    expect(withToken('/^(assignee:)/', 'T_USER').tokenize('assignee:admin something else')).toEqual({ T_USER: ['admin'] });
  });

  it('tokenizes with a custom token and a default token', () => {
    const lexer = withToken('/^(assignee:)/', 'T_USER', 'myDefaultToken');
    expect(lexer.tokenize('assignee:admin something else')).toEqual({ T_USER: ['admin'], myDefaultToken: ['something else'] });
  });

  it('removes the quotes of quoted strings', () => {
    expect(withToken('/^(assignee:)/', 'T_USER').tokenize('assignee:"Foo Bar" something else')).toEqual({ T_USER: ['Foo Bar'] });
  });

  it('tokenizes a number', () => {
    expect(new Lexer().setDefaultToken('myDefaultToken').tokenize('#123')).toEqual({ myDefaultToken: ['#123'] });
  });

  it('tokenizes string dates', () => {
    expect(withToken('/^(date:)/', 'T_MY_DATE').tokenize('date:today something else')).toEqual({ T_MY_DATE: ['today'] });
  });

  it('tokenizes string dates with spaces', () => {
    expect(withToken('/^(date:)/', 'T_MY_DATE').tokenize('date:"last month" something else')).toEqual({ T_MY_DATE: ['last month'] });
  });

  it.each([
    ['date:<="last month" something else', '<=last month'],
    ['date:>="next month" something else', '>=next month'],
    ['date:<"+2 days" something else', '<+2 days'],
    ['date:<"-1 hour" something else', '<-1 hour'],
  ])('tokenizes string dates with spaces and operator: %s', (input, expected) => {
    expect(withToken('/^(date:)/', 'T_MY_DATE').tokenize(input)).toEqual({ T_MY_DATE: [expected] });
  });

  it.each([
    ['date:<=today something else', '<=today'],
    ['date:>now something else', '>now'],
    ['date:>=now something else', '>=now'],
  ])('tokenizes string dates with operator: %s', (input, expected) => {
    expect(withToken('/^(date:)/', 'T_MY_DATE').tokenize(input)).toEqual({ T_MY_DATE: [expected] });
  });

  it('tokenizes ISO dates', () => {
    expect(withToken('/^(date:)/', 'T_MY_DATE').tokenize('date:<=2016-01-01 something else')).toEqual({ T_MY_DATE: ['<=2016-01-01'] });
  });

  it('tokenizes UTF-8 letters', () => {
    expect(new Lexer().setDefaultToken('myDefaultToken').tokenize('àa éçùe')).toEqual({ myDefaultToken: ['àa éçùe'] });
  });

  it('tokenizes UTF-8 numbers', () => {
    expect(new Lexer().setDefaultToken('myDefaultToken').tokenize('६Δↈ五一')).toEqual({ myDefaultToken: ['६Δↈ五一'] });
  });

  it('tokenizes multiple values of the same token', () => {
    expect(withToken('/^(tag:)/', 'T_TAG').tokenize('tag:"tag 1" tag:tag2')).toEqual({ T_TAG: ['tag 1', 'tag2'] });
  });

  it('tokenizes values with a dash', () => {
    expect(withToken('/^(test:)/', 'T_TEST').tokenize('test:PO-123')).toEqual({ T_TEST: ['PO-123'] });
    expect(new Lexer().setDefaultToken('myDefaultToken').tokenize('PO-123')).toEqual({ myDefaultToken: ['PO-123'] });
  });

  it('tokenizes values with an underscore', () => {
    expect(withToken('/^(test:)/', 'T_TEST').tokenize('test:PO_123')).toEqual({ T_TEST: ['PO_123'] });
    expect(withToken('/^(test:)/', 'T_TEST', 'myDefaultToken').tokenize('test:ABC-123 PO_123')).toEqual({ T_TEST: ['ABC-123'], myDefaultToken: ['PO_123'] });
  });

  it('accepts RegExp tokens, null input and keeps independent clones', () => {
    const lexer = new Lexer().addToken(/^(a:)/, 'T_A');
    expect(lexer.tokenize(null)).toEqual({});
    const copy = lexer.clone().addToken(/^(b:)/, 'T_B');
    expect(lexer.tokenize('b:x')).toEqual({});
    expect(copy.tokenize('b:x')).toEqual({ T_B: ['x'] });
  });

  it('drops the value following a token when it is not a string', () => {
    expect(withToken('/^(a:)/', 'T_A').tokenize('a: x')).toEqual({});
  });
});
