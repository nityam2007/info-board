import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/sqlite.js';
import type { Post, CreatePostRequest } from '../types.js';

export const postsService = {
  create(data: CreatePostRequest): Post {
    const db = getDatabase();
    const id = uuid();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO posts (id, content, content_type, source, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.content,
      data.content_type || 'text',
      data.source || 'manual',
      JSON.stringify(data.metadata || {}),
      now
    );
    
    return this.getById(id)!;
  },

  getById(id: string): Post | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL
    `);
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  },

  list(options: { limit?: number; offset?: number; content_type?: string } = {}): Post[] {
    const db = getDatabase();
    const { limit = 50, offset = 0, content_type } = options;
    
    let sql = `SELECT * FROM posts WHERE deleted_at IS NULL`;
    const params: any[] = [];
    
    if (content_type) {
      sql += ` AND content_type = ?`;
      params.push(content_type);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapRow);
  },

  softDelete(id: string): boolean {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE posts SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
    `);
    const result = stmt.run(now, id);
    return result.changes > 0;
  },

  mapRow(row: any): Post {
    return {
      id: row.id,
      content: row.content,
      content_type: row.content_type,
      source: row.source,
      metadata: JSON.parse(row.metadata || '{}'),
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    };
  },
};
