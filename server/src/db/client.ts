import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema';

let _client: Client | null = null;

export function getDb(): Client {
  if (_client) return _client;
  _client = createClient({
    url: process.env['TURSO_DATABASE_URL'] ?? 'file:./data/naval-war.db',
    authToken: process.env['TURSO_AUTH_TOKEN'],
  });
  return _client;
}

export async function initDb(): Promise<void> {
  await initSchema(getDb());
}
