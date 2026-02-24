import { createClient, type Client } from '@libsql/client/web';

let _client: Client | null = null;

export function getTursoClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error('TURSO_DATABASE_URL environment variable is not set');
    }

    _client = createClient({
      url,
      authToken: authToken || undefined,
    });
  }
  return _client;
}

export async function execSql(query: string, args: unknown[] = []) {
  const client = getTursoClient();
  const result = await client.execute({ sql: query, args: args as any });
  return result.rows.map(row => {
    const obj: Record<string, unknown> = {};
    for (const col of result.columns) {
      obj[col] = row[col as any];
    }
    return obj;
  });
}
