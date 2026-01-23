import Database from 'better-sqlite3';
import { CONFIG } from '../config.js';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDatabase(): void {
  db = new Database(CONFIG.SQLITE_PATH);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Posts table (immutable source of truth)
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'text',
      source TEXT NOT NULL DEFAULT 'manual',
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT NULL
    );

    -- Tags table (references to posts)
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_ai_suggested INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    -- Tasks table (references to posts)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date TEXT DEFAULT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type);
    CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_tags_post_id ON tags(post_id);
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_tasks_post_id ON tasks(post_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  `);

  console.log('SQLite tables created');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
