import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileDriver,
  Logger,
  LogLevel,
  StderrDriver,
  StdoutDriver,
  SyslogDriver,
  SystemDriver,
  createLogger,
  getLevelPriority,
  interpolate,
} from '../../../src/core/log/index.js';

describe('levels', () => {
  it('orders priorities like the PHP logger', () => {
    expect(getLevelPriority('emergency')).toBe(600);
    expect(getLevelPriority('alert')).toBe(550);
    expect(getLevelPriority('critical')).toBe(500);
    expect(getLevelPriority('error')).toBe(400);
    expect(getLevelPriority('warning')).toBe(300);
    expect(getLevelPriority('notice')).toBe(250);
    expect(getLevelPriority('info')).toBe(200);
    expect(getLevelPriority('debug')).toBe(100);
    expect(getLevelPriority('whatever')).toBe(100);
  });
});

describe('interpolate', () => {
  it('replaces placeholders and keeps unknown ones', () => {
    expect(interpolate('hello {name} {missing} {n}', { name: 'bob', n: 3 })).toBe('hello bob {missing} 3');
  });
  it('stringifies objects', () => {
    expect(interpolate('{o}', { o: { a: 1 } })).toContain('a: 1');
  });
});

describe('drivers', () => {
  it('stdout and stderr write formatted lines', () => {
    const out: string[] = [];
    const err: string[] = [];
    new StdoutDriver({ writer: (l) => void out.push(l) }).info('hi {x}', { x: 1 });
    new StderrDriver({ writer: (l) => void err.push(l) }).error('boom');
    expect(out[0]).toMatch(/^\[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\] \[info\] hi 1\n$/);
    expect(err[0]).toMatch(/\[error\] boom\n$/);
  });

  it('system driver prints [level] message', () => {
    const lines: string[] = [];
    new SystemDriver({ writer: (l) => void lines.push(l) }).warning('careful {a}', { a: 'x' });
    expect(lines).toEqual(['[warning] careful x\n']);
  });

  it('supports structured JSON output', () => {
    const lines: string[] = [];
    const driver = new StdoutDriver({ format: 'json', writer: (l) => void lines.push(l) });
    driver.error('failed {id}', { id: 7, err: new Error('bad') });
    const parsed = JSON.parse(lines[0]!) as { level: string; message: string; context: { id: number; err: { message: string } } };
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('failed 7');
    expect(parsed.context.id).toBe(7);
    expect(parsed.context.err.message).toBe('bad');
  });

  it('syslog driver computes priorities', () => {
    const sent: Array<[string, number]> = [];
    const driver = new SyslogDriver({ ident: 'kb', transport: (p, s) => void sent.push([p, s]) });
    driver.error('oops');
    driver.debug('dbg');
    expect(driver.getSyslogPriority('critical')).toBe(2);
    expect(sent[0]![0]).toContain('<11>kb[');
    expect(sent[0]![0]).toContain(']: oops');
    expect(sent[0]![1]).toBe(3);
    expect(sent[1]![1]).toBe(7);
  });

  it('dump logs variables at debug level', () => {
    const lines: string[] = [];
    new StdoutDriver({ writer: (l) => void lines.push(l) }).dump({ a: [1, 2] });
    expect(lines[0]).toContain('[debug]');
    expect(lines[0]).toContain('a:');
  });
});

describe('FileDriver', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'kb-log-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('appends lines to the file', () => {
    const file = path.join(dir, 'debug.log');
    const driver = new FileDriver(file);
    driver.info('one');
    driver.info('two');
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/\[info\] two$/);
  });

  it('throws when the file cannot be written', () => {
    const driver = new FileDriver(path.join(dir, 'missing', 'x.log'));
    expect(() => driver.info('x')).toThrow('Unable to write to the log file.');
  });

  it('createLogger("file") honours DEBUG level', () => {
    const file = path.join(dir, 'a.log');
    const logger = createLogger({ driver: 'file', logFile: file, debug: false });
    logger.debug('hidden');
    logger.info('shown');
    const content = readFileSync(file, 'utf8');
    expect(content).not.toContain('hidden');
    expect(content).toContain('shown');
  });
});

describe('Logger', () => {
  it('forwards to drivers depending on their level', () => {
    const low: string[] = [];
    const high: string[] = [];
    const a = new StdoutDriver({ writer: (l) => void low.push(l) });
    const b = new StdoutDriver({ writer: (l) => void high.push(l) });
    b.setLevel(LogLevel.ERROR);
    const logger = new Logger().setLogger(a).setLogger(b);
    logger.debug('d');
    logger.warning('w');
    logger.critical('c');
    expect(low).toHaveLength(3);
    expect(high).toHaveLength(1);
    expect(high[0]).toContain('[critical] c');
    expect(logger.getLoggers()).toHaveLength(2);
  });

  it('dump only reaches debug level drivers', () => {
    const debugLines: string[] = [];
    const infoLines: string[] = [];
    const debugDriver = new StdoutDriver({ writer: (l) => void debugLines.push(l) });
    const infoDriver = new StdoutDriver({ writer: (l) => void infoLines.push(l) });
    infoDriver.setLevel(LogLevel.INFO);
    new Logger().setLogger(debugDriver).setLogger(infoDriver).dump([1]);
    expect(debugLines).toHaveLength(1);
    expect(infoLines).toHaveLength(0);
  });
});
