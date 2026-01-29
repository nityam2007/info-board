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

  // ============ ADMIN OPERATIONS ============

  // Hard delete - permanently removes post from database
  hardDelete(id: string): boolean {
    const db = getDatabase();
    
    // First delete related tags and tasks
    db.prepare(`DELETE FROM tags WHERE post_id = ?`).run(id);
    db.prepare(`DELETE FROM tasks WHERE post_id = ?`).run(id);
    
    // Then delete the post
    const result = db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
    return result.changes > 0;
  },

  // Bulk hard delete
  bulkHardDelete(ids: string[]): number {
    const db = getDatabase();
    let deleted = 0;
    
    const deleteTagsStmt = db.prepare(`DELETE FROM tags WHERE post_id = ?`);
    const deleteTasksStmt = db.prepare(`DELETE FROM tasks WHERE post_id = ?`);
    const deletePostStmt = db.prepare(`DELETE FROM posts WHERE id = ?`);
    
    for (const id of ids) {
      deleteTagsStmt.run(id);
      deleteTasksStmt.run(id);
      const result = deletePostStmt.run(id);
      if (result.changes > 0) deleted++;
    }
    
    return deleted;
  },

  // Bulk soft delete
  bulkSoftDelete(ids: string[]): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    let deleted = 0;
    
    const stmt = db.prepare(`UPDATE posts SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`);
    
    for (const id of ids) {
      const result = stmt.run(now, id);
      if (result.changes > 0) deleted++;
    }
    
    return deleted;
  },

  // Edit post content (admin only)
  update(id: string, data: { content?: string; content_type?: string; metadata?: Record<string, unknown> }): Post | null {
    const db = getDatabase();
    const existing = this.getByIdIncludeDeleted(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.content_type !== undefined) {
      updates.push('content_type = ?');
      params.push(data.content_type);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) return existing;

    params.push(id);
    const sql = `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);

    return this.getByIdIncludeDeleted(id);
  },

  // Get post by ID including soft-deleted
  getByIdIncludeDeleted(id: string): Post | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM posts WHERE id = ?`);
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  },

  // List soft-deleted posts
  listDeleted(options: { limit?: number; offset?: number } = {}): Post[] {
    const db = getDatabase();
    const { limit = 50, offset = 0 } = options;
    
    const stmt = db.prepare(`
      SELECT * FROM posts 
      WHERE deleted_at IS NOT NULL 
      ORDER BY deleted_at DESC 
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as any[];
    return rows.map(this.mapRow);
  },

  // Restore soft-deleted post
  restore(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE posts SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  // Bulk restore
  bulkRestore(ids: string[]): number {
    const db = getDatabase();
    let restored = 0;
    
    const stmt = db.prepare(`UPDATE posts SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`);
    
    for (const id of ids) {
      const result = stmt.run(id);
      if (result.changes > 0) restored++;
    }
    
    return restored;
  },

  // List all posts (including deleted) for admin
  listAll(options: { limit?: number; offset?: number; includeDeleted?: boolean; content_type?: string; search?: string } = {}): { posts: Post[]; total: number } {
    const db = getDatabase();
    const { limit = 50, offset = 0, includeDeleted = false, content_type, search } = options;
    
    let whereClauses: string[] = [];
    const params: any[] = [];
    
    if (!includeDeleted) {
      whereClauses.push('deleted_at IS NULL');
    }
    
    if (content_type) {
      whereClauses.push('content_type = ?');
      params.push(content_type);
    }
    
    if (search) {
      whereClauses.push('content LIKE ?');
      params.push(`%${search}%`);
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM posts ${whereClause}`);
    const total = (countStmt.get(...params) as any).count;
    
    // Get posts
    const listParams = [...params, limit, offset];
    const stmt = db.prepare(`SELECT * FROM posts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`);
    const rows = stmt.all(...listParams) as any[];
    
    return { posts: rows.map(this.mapRow), total };
  },

  // Get admin stats
  getAdminStats(): {
    totalPosts: number;
    deletedPosts: number;
    postsByType: Record<string, number>;
    postsBySource: Record<string, number>;
    storageUsed: string;
    oldestPost: string | null;
    newestPost: string | null;
  } {
    const db = getDatabase();
    
    // Total posts (active)
    const totalPosts = (db.prepare(`SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL`).get() as any).count;
    
    // Deleted posts
    const deletedPosts = (db.prepare(`SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NOT NULL`).get() as any).count;
    
    // Posts by type
    const typeRows = db.prepare(`
      SELECT content_type, COUNT(*) as count 
      FROM posts WHERE deleted_at IS NULL 
      GROUP BY content_type
    `).all() as any[];
    const postsByType: Record<string, number> = {};
    typeRows.forEach(row => { postsByType[row.content_type] = row.count; });
    
    // Posts by source
    const sourceRows = db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM posts WHERE deleted_at IS NULL 
      GROUP BY source
    `).all() as any[];
    const postsBySource: Record<string, number> = {};
    sourceRows.forEach(row => { postsBySource[row.source] = row.count; });
    
    // Date range
    const dateRange = db.prepare(`
      SELECT MIN(created_at) as oldest, MAX(created_at) as newest 
      FROM posts WHERE deleted_at IS NULL
    `).get() as any;
    
    // Estimate storage (just count metadata sizes for now)
    const storageResult = db.prepare(`
      SELECT SUM(LENGTH(content) + LENGTH(metadata)) as bytes FROM posts
    `).get() as any;
    const bytes = storageResult?.bytes || 0;
    const storageUsed = bytes < 1024 ? `${bytes} B` 
      : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    
    return {
      totalPosts,
      deletedPosts,
      postsByType,
      postsBySource,
      storageUsed,
      oldestPost: dateRange?.oldest || null,
      newestPost: dateRange?.newest || null,
    };
  },
};
