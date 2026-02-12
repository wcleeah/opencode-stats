import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';

type Params = SQLQueryBindings[];

function getDbPath(): string {
  if (process.env.OPENCODE_USAGE_DB) {
    return process.env.OPENCODE_USAGE_DB;
  }
  return join(homedir(), '.local', 'share', 'opencode', 'usage.db');
}

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath, { readonly: true });
    db.exec('PRAGMA journal_mode = WAL');
  }
  return db;
}

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export function queryAll<T>(sql: string, params?: Params): QueryResult<T[]> {
  try {
    const database = getDb();
    const stmt = database.prepare(sql);
    const rows = params ? stmt.all(...params) : stmt.all();
    return { data: rows as T[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.queryAll] ${message}`, { sql, params });
    return { data: null, error: message };
  }
}

export function queryOne<T>(sql: string, params?: Params): QueryResult<T> {
  try {
    const database = getDb();
    const stmt = database.prepare(sql);
    const row = params ? stmt.get(...params) : stmt.get();
    return { data: (row as T) ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.queryOne] ${message}`, { sql, params });
    return { data: null, error: message };
  }
}
