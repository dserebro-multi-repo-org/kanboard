import { describe, expect, it } from 'vitest';
import { Request, isIpInNetworks, ipToBytes, type HttpRequestLike, type RequestOptions } from '../../../../src/core/http/index.js';

function make(partial: Partial<HttpRequestLike> = {}, options: RequestOptions = {}): Request {
  return new Request({ method: 'GET', url: '/', headers: {}, ip: '203.0.113.9', ...partial }, options);
}

describe('Request basics', () => {
  it('reads query params', () => {
    const r = make({ query: { name: 'x', id: '42', bad: '4a', neg: '-1' } });
    expect(r.getStringParam('name')).toBe('x');
    expect(r.getStringParam('missing', 'dflt')).toBe('dflt');
    expect(r.getIntegerParam('id')).toBe(42);
    expect(r.getIntegerParam('bad', 7)).toBe(7);
    expect(r.getIntegerParam('neg', 7)).toBe(7);
    expect(r.getIntegerParam('missing')).toBe(0);
  });

  it('merges route params', () => {
    const r = make({ query: { a: '1' } });
    r.setParams({ project_id: '5' });
    expect(r.getIntegerParam('project_id')).toBe(5);
    expect(r.getIntegerParam('a')).toBe(1);
  });

  it('handles headers case-insensitively and ajax detection', () => {
    const r = make({ headers: { 'x-requested-with': 'XMLHttpRequest', 'user-agent': 'UA/1.0', 'x-multi': ['a', 'b'] } });
    expect(r.getHeader('X-Requested-With')).toBe('XMLHttpRequest');
    expect(r.getHeader('HTTP_USER_AGENT')).toBe('UA/1.0');
    expect(r.getHeader('X-Multi')).toBe('a');
    expect(r.getHeader('Nope')).toBe('');
    expect(r.isAjax()).toBe(true);
    expect(r.getUserAgent()).toBe('UA/1.0');
    expect(make().getUserAgent()).toBe('Unknown');
    expect(make().isAjax()).toBe(false);
  });

  it('exposes method, uri, query string, cookies', () => {
    const r = make({ method: 'post', url: '/board/1?a=b&c=d', cookies: { sid: 'abc' } });
    expect(r.getMethod()).toBe('POST');
    expect(r.isPost()).toBe(true);
    expect(r.getUri()).toBe('/board/1?a=b&c=d');
    expect(r.getQueryString()).toBe('a=b&c=d');
    expect(make().getQueryString()).toBe('');
    expect(r.getCookie('sid')).toBe('abc');
    expect(r.getCookie('none')).toBe('');
  });

  it('detects https and JSON content types', () => {
    expect(make({ protocol: 'https' }).isHTTPS()).toBe(true);
    expect(make({ headers: { 'x-forwarded-proto': 'https' } }).isHTTPS()).toBe(true);
    expect(make().isHTTPS()).toBe(false);
    expect(make({ headers: { 'content-type': 'Application/JSON; charset=utf-8' } }).isJsonContentType()).toBe(true);
    expect(make({ headers: { 'content-type': 'text/html' } }).isJsonContentType()).toBe(false);
  });

  it('parses JSON bodies', () => {
    const json = { 'content-type': 'application/json' };
    expect(make({ headers: json, body: { a: 1 } }).getJson()).toEqual({ a: 1 });
    expect(make({ headers: json, body: '{"b":2}' }).getJson()).toEqual({ b: 2 });
    expect(make({ headers: json, body: 'not json' }).getJson()).toEqual({});
    expect(make({ body: { a: 1 } }).getJson()).toEqual({});
    expect(make({ body: { a: 1 } }).getJson(false)).toEqual({ a: 1 });
    expect(make({ rawBody: Buffer.from('raw') }).getBody()).toBe('raw');
  });

  it('returns form values only with a valid CSRF token', () => {
    const body = { csrf_token: 'good', title: 'T', '-----------------------------123': 'junk' };
    const validator = (t: string): boolean => t === 'good';
    const r = make({ body }, { csrfValidator: validator });
    expect(r.getValues()).toEqual({ title: 'T' });
    expect(r.getValue('title')).toBe('T');
    expect(r.getValue('x')).toBeNull();
    expect(r.getRawFormValues()).toEqual(body);
    expect(r.getRawValue('title')).toBe('T');
    expect(make({ body: { csrf_token: 'bad', title: 'T' } }, { csrfValidator: validator }).getValues()).toEqual({});
    expect(make({ body: { title: 'T' } }).getValues()).toEqual({});
    expect(make({ body: { csrf_token: 'anything', title: 'T' } }).getValues()).toEqual({});
  });

  it('validates safe redirect URIs', () => {
    const r = make();
    expect(r.isSafeRedirectUri('/board/1?x=y')).toBe(true);
    for (const bad of ['', 'http://evil.com', '//evil.com', 'evil.com', '/\\evil.com', '/\t/evil.com', 'javascript:alert(1)']) {
      expect(r.isSafeRedirectUri(bad)).toBe(false);
    }
  });
});

describe('IP helpers', () => {
  it('converts addresses to bytes', () => {
    expect([...ipToBytes('10.1.2.3')!]).toEqual([10, 1, 2, 3]);
    expect(ipToBytes('::1')!.length).toBe(16);
    expect([...ipToBytes('::ffff:10.1.2.3')!]).toEqual([10, 1, 2, 3]);
    expect(ipToBytes('nope')).toBeNull();
    expect(ipToBytes('fe80::1%eth0')).toBeNull();
  });

  it('matches networks', () => {
    expect(isIpInNetworks('192.168.1.5', ['192.168.0.0/16'])).toBe(true);
    expect(isIpInNetworks('192.169.1.5', ['192.168.0.0/16'])).toBe(false);
    expect(isIpInNetworks('10.0.0.1', ['10.0.0.1'])).toBe(true);
    expect(isIpInNetworks('10.0.0.2', ['10.0.0.1'])).toBe(false);
    expect(isIpInNetworks('10.0.0.130', ['10.0.0.128/25'])).toBe(true);
    expect(isIpInNetworks('10.0.0.5', ['10.0.0.128/25'])).toBe(false);
    expect(isIpInNetworks('1.2.3.4', ['0.0.0.0/0'])).toBe(true);
    expect(isIpInNetworks('fd00::5', ['fd00::/8'])).toBe(true);
    expect(isIpInNetworks('fe00::5', ['fd00::/8'])).toBe(false);
    expect(isIpInNetworks('::ffff:10.0.0.1', ['10.0.0.0/8'])).toBe(true);
    expect(isIpInNetworks('10.0.0.1', ['fd00::/8', '', 'garbage'])).toBe(false);
    expect(isIpInNetworks('bad', ['10.0.0.0/8'])).toBe(false);
  });
});

describe('client IP resolution', () => {
  const options: RequestOptions = {
    trustedProxyHeaders: 'HTTP_X_FORWARDED_FOR, HTTP_X_REAL_IP',
    trustedProxyNetworks: '10.0.0.0/8,172.16.0.0/12',
  };

  it('returns the socket address without configuration', () => {
    expect(make({ headers: { 'x-forwarded-for': '1.1.1.1' } }).getIpAddress()).toBe('203.0.113.9');
    expect(make({ ip: undefined }).getClientIpAddress()).toBe('');
  });

  it('ignores forwarded headers from untrusted peers', () => {
    const r = make({ ip: '198.51.100.7', headers: { 'x-forwarded-for': '1.1.1.1' } }, options);
    expect(r.isTrustedProxy()).toBe(false);
    expect(r.getIpAddress()).toBe('198.51.100.7');
  });

  it('uses the rightmost untrusted hop of X-Forwarded-For', () => {
    const r = make({ ip: '10.0.0.2', headers: { 'x-forwarded-for': '6.6.6.6, 1.1.1.1, 172.16.0.9, 10.0.0.3' } }, options);
    expect(r.isTrustedProxy()).toBe(true);
    expect(r.getIpAddress()).toBe('1.1.1.1');
  });

  it('trusts single value headers even when they are proxy addresses', () => {
    const r = make({ ip: '10.0.0.2', headers: { 'x-forwarded-for': '10.0.0.77' } }, options);
    expect(r.getIpAddress()).toBe('10.0.0.77');
  });

  it('skips invalid addresses and falls back to later headers or the socket', () => {
    const r1 = make({ ip: '10.0.0.2', headers: { 'x-forwarded-for': 'garbage', 'x-real-ip': '8.8.8.8' } }, options);
    expect(r1.getIpAddress()).toBe('8.8.8.8');
    const r2 = make({ ip: '10.0.0.2', headers: { 'x-forwarded-for': 'a, b' } }, options);
    expect(r2.getIpAddress()).toBe('10.0.0.2');
    const r3 = make({ ip: '10.0.0.2', headers: { 'x-forwarded-for': '10.0.0.5, 10.0.0.6' } }, options);
    expect(r3.getIpAddress()).toBe('10.0.0.2');
  });

  it('accepts explicit headers and networks as arguments', () => {
    const r = make({ ip: '192.168.0.1', headers: { 'x-client': '9.9.9.9' } });
    expect(r.getIpAddress(['X-Client'], ['192.168.0.0/24'])).toBe('9.9.9.9');
  });

  it('exposes reverse proxy authentication headers only for trusted proxies', () => {
    const headers = { 'remote-user': 'bob', 'remote-email': 'b@x.io', 'remote-fullname': 'Bob B' };
    const trusted = make({ ip: '10.0.0.2', headers }, options);
    expect(trusted.getRemoteUser()).toBe('bob');
    expect(trusted.getRemoteEmail()).toBe('b@x.io');
    expect(trusted.getRemoteName()).toBe('Bob B');
    const untrusted = make({ ip: '1.2.3.4', headers }, options);
    expect(untrusted.getRemoteUser()).toBe('');
    expect(untrusted.getRemoteEmail()).toBe('');
    expect(untrusted.getRemoteName()).toBe('');
  });
});
