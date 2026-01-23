import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/sqlite.js';
import type { Tag, CreateTagRequest } from '../types.js';

export const tagsService = {
  create(data: CreateTagRequest): Tag {
    const db = getDatabase();
    const id = uuid();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO tags (id, post_id, name, is_ai_suggested, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.post_id, data.name.toLowerCase().trim(), data.is_ai_suggested ? 1 : 0, now);
    
    return this.getById(id)!;
  },

  getById(id: string): Tag | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM tags WHERE id = ?`);
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  },

  getByPostId(postId: string): Tag[] {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM tags WHERE post_id = ? ORDER BY created_at`);
    const rows = stmt.all(postId) as any[];
    return rows.map(this.mapRow);
  },

  delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare(`DELETE FROM tags WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  listAll(): Tag[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT DISTINCT name, COUNT(*) as count 
      FROM tags 
      GROUP BY name 
      ORDER BY count DESC
    `);
    return stmt.all() as Tag[];
  },

  mapRow(row: any): Tag {
    return {
      id: row.id,
      post_id: row.post_id,
      name: row.name,
      is_ai_suggested: Boolean(row.is_ai_suggested),
      created_at: row.created_at,
    };
  },
};
