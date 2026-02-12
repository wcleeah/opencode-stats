import 'server-only';
import { createClient, type InArgs, type Client } from '@libsql/client';
import { homedir } from 'os';
import { join } from 'path';

function getDbPath(): string {
  if (process.env.OPENCODE_USAGE_DB) {
    return process.env.OPENCODE_USAGE_DB;
  }
  return join(homedir(), '.local', 'share', 'opencode', 'usage.db');
}

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const dbPath = getDbPath();
    client = createClient({ url: `file:${dbPath}` });
  }
  return client;
}

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export type Params = InArgs;

export async function queryAll<T>(
  sql: string,
  params?: Params,
): Promise<QueryResult<T[]>> {
  try {
    const db = getClient();
    const result = await db.execute(
      params ? { sql, args: params } : sql,
    );
    // Row objects have named properties matching column names.
    // Spread into plain objects so they match our TypeScript interfaces.
    const rows = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const col of result.columns) {
        obj[col] = row[col];
      }
      return obj as T;
    });
    return { data: rows, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.queryAll] ${message}`, { sql, params });
    return { data: null, error: message };
  }
}

export async function queryOne<T>(
  sql: string,
  params?: Params,
): Promise<QueryResult<T>> {
  try {
    const db = getClient();
    const result = await db.execute(
      params ? { sql, args: params } : sql,
    );
    if (result.rows.length === 0) {
      return { data: null, error: null };
    }
    const row = result.rows[0];
    const obj: Record<string, unknown> = {};
    for (const col of result.columns) {
      obj[col] = row[col];
    }
    return { data: obj as T, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.queryOne] ${message}`, { sql, params });
    return { data: null, error: message };
  }
}
