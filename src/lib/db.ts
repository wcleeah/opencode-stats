import 'server-only';
import {
  createClient,
  type InArgs,
  type Client,
  type InStatement,
  type ResultSet,
} from '@libsql/client/web';

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error(
        'TURSO_DATABASE_URL is required. ' +
        'See README.md for Turso setup instructions.',
      );
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export type Params = InArgs;

function rowToObject<T>(
  columns: string[],
  row: Record<string, unknown>,
): T {
  const obj: Record<string, unknown> = {};
  for (const col of columns) {
    obj[col] = row[col];
  }
  return obj as T;
}

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
    const rows = result.rows.map((row) =>
      rowToObject<T>(result.columns, row as unknown as Record<string, unknown>),
    );
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
    return {
      data: rowToObject<T>(
        result.columns,
        row as unknown as Record<string, unknown>,
      ),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.queryOne] ${message}`, { sql, params });
    return { data: null, error: message };
  }
}

export async function execute(
  sql: string,
  params?: Params,
): Promise<QueryResult<ResultSet>> {
  try {
    const db = getClient();
    const result = await db.execute(
      params ? { sql, args: params } : sql,
    );
    return { data: result, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.execute] ${message}`, { sql, params });
    return { data: null, error: message };
  }
}

export async function executeBatch(
  statements: InStatement[],
): Promise<QueryResult<ResultSet[]>> {
  try {
    const db = getClient();
    const results = await db.batch(statements, 'write');
    return { data: results, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db.executeBatch] ${message}`, {
      statementCount: statements.length,
    });
    return { data: null, error: message };
  }
}
