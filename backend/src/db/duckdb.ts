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
    // @duckdb/node-api uses closeSync() not close()
    try {
      connection.closeSync();
    } catch (e) {
      // Ignore close errors
    }
    connection = null;
  }
  if (instance) {
    try {
      instance.closeSync();
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

  // Use prepared statement to safely insert values
  const stmt = await connection.prepare(`
    INSERT OR REPLACE INTO posts_fts (id, content, content_type, created_at)
    VALUES ($1, $2, $3, $4);
  `);
  
  stmt.bindVarchar(1, post.id);
  stmt.bindVarchar(2, post.content);
  stmt.bindVarchar(3, post.content_type);
  stmt.bindVarchar(4, post.created_at);
  
  await stmt.run();
}

// Full-text search using DuckDB
export async function searchPostsFTS(query: string, limit = 50): Promise<string[]> {
  if (!connection) return [];

  // Use prepared statement to safely bind values
  const stmt = await connection.prepare(`
    SELECT id FROM posts_fts
    WHERE content ILIKE '%' || $1 || '%'
    ORDER BY created_at DESC
    LIMIT $2;
  `);
  
  stmt.bindVarchar(1, query);
  stmt.bindInteger(2, limit);
  
  const result = await stmt.runAndReadAll();
  
  const ids: string[] = [];
  const rows = result.getRows();
  
  for (const row of rows) {
    ids.push(row[0] as string);
  }
  
  return ids;
}
