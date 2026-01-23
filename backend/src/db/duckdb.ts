import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { CONFIG } from '../config.js';

let instance: DuckDBInstance | null = null;
let connection: DuckDBConnection | null = null;

export async function initDuckDB(): Promise<void> {
  instance = await DuckDBInstance.create(CONFIG.DUCKDB_PATH);
  connection = await instance.connect();

  // Create FTS virtual table for posts
  await connection.run(`
    CREATE TABLE IF NOT EXISTS posts_fts (
      id VARCHAR PRIMARY KEY,
      content VARCHAR,
      content_type VARCHAR,
      created_at TIMESTAMP
    );
  `);

  console.log('DuckDB initialized');
}

export function getDuckDB(): DuckDBConnection {
  if (!connection) {
    throw new Error('DuckDB not initialized');
  }
  return connection;
}

export async function closeDuckDB(): Promise<void> {
  if (connection) {
    // @duckdb/node-api uses disconnect() not close()
    try {
      await connection.disconnect();
    } catch (e) {
      // Ignore close errors
    }
    connection = null;
  }
  if (instance) {
    try {
      await instance.close();
    } catch (e) {
      // Ignore close errors
    }
    instance = null;
  }
}

// Sync posts from SQLite to DuckDB for FTS
export async function syncPostToDuckDB(post: {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
}): Promise<void> {
  if (!connection) return;

  await connection.run(`
    INSERT OR REPLACE INTO posts_fts (id, content, content_type, created_at)
    VALUES (?, ?, ?, ?);
  `, post.id, post.content, post.content_type, post.created_at);
}

// Full-text search using DuckDB
export async function searchPostsFTS(query: string, limit = 50): Promise<string[]> {
  if (!connection) return [];

  const result = await connection.run(`
    SELECT id FROM posts_fts
    WHERE content ILIKE '%' || ? || '%'
    ORDER BY created_at DESC
    LIMIT ?;
  `, query, limit);

  const ids: string[] = [];
  const reader = result.getReader();
  
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    for (let i = 0; i < chunk.value.rowCount; i++) {
      ids.push(chunk.value.getChild(0)?.getValue(i) as string);
    }
  }
  
  return ids;
}
