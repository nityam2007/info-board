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

  getStats(): {
    totalPosts: number;
    postsByType: Record<string, number>;
    postsToday: number;
    postsThisWeek: number;
    streak: number;
    recentTags: { name: string; count: number }[];
  } {
    const db = getDatabase();
    
    // Total posts
    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL`);
    const totalPosts = (totalStmt.get() as any).count;
    
    // Posts by type
    const typeStmt = db.prepare(`
      SELECT content_type, COUNT(*) as count 
      FROM posts WHERE deleted_at IS NULL 
      GROUP BY content_type
    `);
    const typeRows = typeStmt.all() as any[];
    const postsByType: Record<string, number> = {};
    typeRows.forEach(row => { postsByType[row.content_type] = row.count; });
    
    // Posts today
    const todayStmt = db.prepare(`
      SELECT COUNT(*) as count FROM posts 
      WHERE deleted_at IS NULL AND date(created_at) = date('now')
    `);
    const postsToday = (todayStmt.get() as any).count;
    
    // Posts this week
    const weekStmt = db.prepare(`
      SELECT COUNT(*) as count FROM posts 
      WHERE deleted_at IS NULL AND created_at >= datetime('now', '-7 days')
    `);
    const postsThisWeek = (weekStmt.get() as any).count;
    
    // Calculate streak (consecutive days with at least one post)
    const streakStmt = db.prepare(`
      SELECT DISTINCT date(created_at) as post_date 
      FROM posts WHERE deleted_at IS NULL 
      ORDER BY post_date DESC 
      LIMIT 30
    `);
    const dates = streakStmt.all() as any[];
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < dates.length; i++) {
      const postDate = new Date(dates[i].post_date);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);
      
      if (postDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (i === 0 && postDate.getTime() === new Date(today.getTime() - 86400000).getTime()) {
        // Allow streak to continue if last post was yesterday
        streak++;
      } else {
        break;
      }
    }
    
    // Recent tags
    const tagsStmt = db.prepare(`
      SELECT name, COUNT(*) as count FROM tags 
      WHERE post_id IN (SELECT id FROM posts WHERE deleted_at IS NULL)
      GROUP BY name ORDER BY count DESC LIMIT 5
    `);
    const recentTags = tagsStmt.all() as { name: string; count: number }[];
    
    return {
      totalPosts,
      postsByType,
      postsToday,
      postsThisWeek,
      streak,
      recentTags,
    };
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
