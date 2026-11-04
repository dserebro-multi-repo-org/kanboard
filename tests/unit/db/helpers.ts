import { Database } from '../../../src/db/database.js';

/** In-memory SQLite database without schema. */
export function memoryDb(): Database {
  return Database.connect({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:' });
}

/** Small schema used by the query helper tests. */
export async function seededDb(): Promise<Database> {
  const db = memoryDb();
  await db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, age INTEGER, score REAL, role TEXT)');
  await db.exec('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT, owner_id INTEGER, points INTEGER DEFAULT 0)');
  const users = db.table('users');
  await users.insert({ name: 'alice', age: 30, score: 1.5, role: 'admin' });
  await db.table('users').insert({ name: 'bob', age: 20, score: 2.5, role: 'user' });
  await db.table('users').insert({ name: 'Carol', age: 40, score: null, role: null });
  await db.table('tasks').insert({ title: 'one', owner_id: 1, points: 3 });
  await db.table('tasks').insert({ title: 'two', owner_id: 1, points: 5 });
  await db.table('tasks').insert({ title: 'three', owner_id: 2, points: 1 });
  await db.table('tasks').insert({ title: 'orphan', owner_id: 99, points: 0 });
  return db;
}
