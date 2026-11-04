import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Csv } from '../../../src/core/csv.js';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'kb-csv-'));
  file = path.join(dir, 'file.csv');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function roundTrip(row: Array<string | number | null>): Promise<string[]> {
  const csv = new Csv();
  await csv.write(file, [row]);
  const content = readFileSync(file, 'utf8');
  return [...(csv as unknown as { parse(c: string): Iterable<string[]> }).parse(content)][0] ?? [];
}

describe('Csv', () => {
  it('parses boolean values', () => {
    for (const v of ['1', 'True', 't', 'TRUE', 'true', 'T', 'Y', 'y', 'yes', 'Yes']) expect(Csv.getBooleanValue(v)).toBe(1);
    for (const v of ['0', '123', 'anything', '', null, undefined]) expect(Csv.getBooleanValue(v)).toBe(0);
  });

  it('lists enclosures and delimiters', () => {
    expect(Object.keys(Csv.getEnclosures())).toHaveLength(3);
    expect(Object.keys(Csv.getDelimiters())).toHaveLength(4);
  });

  it('reads and writes', async () => {
    const rows = [
      ['Column A', 'Column B'],
      ['value a', 'value b'],
    ];
    const csv = new Csv();
    await csv.write(file, rows);
    expect(readFileSync(file, 'utf8')).toBe('"Column A","Column B"\n"value a","value b"\n');

    const seen: Array<[Record<string, string>, number]> = [];
    await csv.setColumnMapping(['A', 'B', 'C']).read(file, (row, line) => {
      seen.push([row, line]);
    });
    expect(seen).toEqual([[{ 0: 'value a', 1: 'value b', 2: '' }, 1]]);
  });

  it('maps SQL column names and ignores empty/"0" cells like array_filter', async () => {
    writeFileSync(file, 'h1,h2,h3\nfoo,0,bar\n\n,,\n"a ""q"" b",\n');
    const seen: Array<[Record<string, string>, number]> = [];
    await new Csv().setColumnMapping({ x: 'X', y: 'Y', z: 'Z' }).read(file, (row, line) => {
      seen.push([row, line]);
    });
    expect(seen).toEqual([
      [{ x: 'foo', y: '', z: 'bar' }, 1],
      [{ x: 'a "q" b', y: '', z: '' }, 4],
    ]);
  });

  it('supports other delimiters, multiline cells and awaits async callbacks', async () => {
    writeFileSync(file, 'h;h\r\n"multi\nline";x\r\n');
    const seen: string[] = [];
    await new Csv(';').setColumnMapping({ a: 'A', b: 'B' }).read(file, async (row) => {
      await Promise.resolve();
      seen.push(`${row.a}|${row.b}`);
    });
    expect(seen).toEqual(['multi\nline|x']);
  });

  it('outputs with an optional BOM', () => {
    const chunks: string[] = [];
    Csv.output([['Column A', 'Column B'], ['value a', 'value b']], false, { write: (c) => chunks.push(c) });
    expect(chunks.join('')).toBe('"Column A","Column B"\n"value a","value b"\n');
    const bom: string[] = [];
    Csv.output([['a']], true, { write: (c) => bom.push(c) });
    expect(bom.join('')).toBe('﻿a\n');
  });

  it('neutralizes formula injection', async () => {
    const input = ['=1+1', '+1+1', '-1+1', '@SUM(A1:A2)', '\t=1+1', '\r=1+1', '\n=1+1'];
    expect(await roundTrip(input)).toEqual(input.map((v) => `'${v}`));
  });

  it('preserves safe values', async () => {
    const row = await roundTrip(['Text', '1=1', '', 123, -123, 1.5, null, '-2', '+2', '-1.5', '-2e3']);
    expect(row).toEqual(['Text', '1=1', '', '123', '-123', '1.5', '', '-2', '+2', '-1.5', '-2e3']);
  });
});
