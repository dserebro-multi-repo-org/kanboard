import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStorage, ObjectStorageException } from '../../../src/core/object-storage/index.js';

describe('FileStorage', () => {
  let dir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'kb-storage-'));
    storage = await FileStorage.create(dir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects an invalid base folder', async () => {
    await expect(FileStorage.create(path.join(dir, 'nope'))).rejects.toBeInstanceOf(ObjectStorageException);
    const file = path.join(dir, 'file.txt');
    writeFileSync(file, 'x');
    await expect(FileStorage.create(file)).rejects.toThrow(/not a directory/);
  });

  it('puts and gets objects, creating folders', async () => {
    await storage.put('tasks/1/a.txt', 'hello');
    expect(readFileSync(path.join(dir, 'tasks', '1', 'a.txt'), 'utf8')).toBe('hello');
    expect((await storage.get('tasks/1/a.txt')).toString()).toBe('hello');
  });

  it('streams objects', async () => {
    await storage.put('a.bin', Buffer.from([1, 2, 3]));
    const chunks: Buffer[] = [];
    for await (const chunk of await storage.output('a.bin')) {
      chunks.push(chunk as Buffer);
    }
    expect([...Buffer.concat(chunks)]).toEqual([1, 2, 3]);
  });

  it('moves files and uploaded files', async () => {
    const src = path.join(dir, '..', `kb-src-${Date.now()}.txt`);
    writeFileSync(src, 'moved');
    expect(await storage.moveFile(src, 'x/y.txt')).toBe(true);
    expect(existsSync(src)).toBe(false);
    expect((await storage.get('x/y.txt')).toString()).toBe('moved');

    const upload = path.join(dir, 'upload.tmp');
    writeFileSync(upload, 'up');
    expect(await storage.moveUploadedFile(upload, 'z.txt')).toBe(true);
    await expect(storage.moveFile(path.join(dir, 'ghost'), 'k')).rejects.toThrow(/Source file does not exist/);
  });

  it('removes objects and empty parent folders', async () => {
    await storage.put('folder/a.txt', 'a');
    await storage.put('folder/b.txt', 'b');
    expect(await storage.remove('folder/a.txt')).toBe(true);
    expect(existsSync(path.join(dir, 'folder'))).toBe(true);
    expect(await storage.remove('folder/b.txt')).toBe(true);
    expect(existsSync(path.join(dir, 'folder'))).toBe(false);
    expect(existsSync(dir)).toBe(true);
  });

  it('refuses path traversal', async () => {
    await expect(storage.get('../outside')).rejects.toBeInstanceOf(ObjectStorageException);
    await expect(storage.put('../../etc/evil', 'x')).rejects.toThrow(/not in base directory/);
    expect(() => storage.getSanitizedFilePath('')).toThrow(ObjectStorageException);
    expect(storage.getSanitizedFilePath('a/../b.txt')).toBe(path.join(storage.getBaseDir(), 'b.txt'));
  });

  it('rejects reading missing objects', async () => {
    await expect(storage.get('missing.txt')).rejects.toThrow(/Invalid file path/);
  });
});
