import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from 'express';
import { postsService } from '../services/posts.js';
import { tagsService } from '../services/tags.js';
import { getDatabase } from '../db/sqlite.js';

export const adminRouter: RouterType = Router();

// Admin authentication middleware
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.PASSWORD || '';

function adminAuth(req: Request, res: Response, next: NextFunction) {
  // Check X-Admin-Password header
  const providedPassword = req.headers['x-admin-password'] as string;
  
  // If no admin password is configured, allow access (for development)
  if (!ADMIN_PASSWORD) {
    return next();
  }
  
  if (!providedPassword || providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ 
      success: false, 
      error: 'Admin authentication required',
      requiresAuth: true 
    });
  }
  
  next();
}

// Check if admin auth is required (public endpoint)
adminRouter.get('/auth-status', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      requiresAuth: !!ADMIN_PASSWORD 
    } 
  });
});

// Apply admin auth to all other routes
adminRouter.use(adminAuth);

// ============ POSTS ADMIN ============

// Get admin stats
adminRouter.get('/stats', async (req, res) => {
  try {
    const stats = postsService.getAdminStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// List all posts (with filters, including deleted option)
adminRouter.get('/posts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const includeDeleted = req.query.includeDeleted === 'true';
    const content_type = req.query.content_type as string;
    const search = req.query.search as string;
    
    const result = postsService.listAll({ limit, offset, includeDeleted, content_type, search });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// List deleted posts
adminRouter.get('/posts/deleted', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const posts = postsService.listDeleted({ limit, offset });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Edit post
adminRouter.put('/posts/:id', async (req, res) => {
  try {
    const { content, content_type, metadata } = req.body;
    
    const post = postsService.update(req.params.id, { content, content_type, metadata });
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Hard delete post (permanent)
adminRouter.delete('/posts/:id/hard', async (req, res) => {
  try {
    const deleted = postsService.hardDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: { deleted: true, permanent: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Restore soft-deleted post
adminRouter.post('/posts/:id/restore', async (req, res) => {
  try {
    const restored = postsService.restore(req.params.id);
    
    if (!restored) {
      return res.status(404).json({ success: false, error: 'Post not found or not deleted' });
    }
    
    res.json({ success: true, data: { restored: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Bulk soft delete
adminRouter.post('/posts/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }
    
    const deleted = postsService.bulkSoftDelete(ids);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Bulk hard delete (permanent)
adminRouter.post('/posts/bulk-hard-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }
    
    const deleted = postsService.bulkHardDelete(ids);
    res.json({ success: true, data: { deleted, permanent: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Bulk restore
adminRouter.post('/posts/bulk-restore', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }
    
    const restored = postsService.bulkRestore(ids);
    res.json({ success: true, data: { restored } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============ TAGS ADMIN ============

// Rename tag (all occurrences)
adminRouter.post('/tags/rename', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: 'oldName and newName are required' });
    }
    
    const db = getDatabase();
    const result = db.prepare(`UPDATE tags SET name = ? WHERE name = ?`).run(newName.trim(), oldName.trim());
    
    res.json({ success: true, data: { renamed: result.changes } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Merge tags (rename all of one tag to another)
adminRouter.post('/tags/merge', async (req, res) => {
  try {
    const { sourceTag, targetTag } = req.body;
    
    if (!sourceTag || !targetTag) {
      return res.status(400).json({ success: false, error: 'sourceTag and targetTag are required' });
    }
    
    const db = getDatabase();
    
    // Get all posts with source tag
    const postsWithSource = db.prepare(`SELECT DISTINCT post_id FROM tags WHERE name = ?`).all(sourceTag) as any[];
    
    // For each post, check if it already has target tag
    let merged = 0;
    for (const { post_id } of postsWithSource) {
      const hasTarget = db.prepare(`SELECT 1 FROM tags WHERE post_id = ? AND name = ?`).get(post_id, targetTag);
      
      if (hasTarget) {
        // Already has target tag, just delete source
        db.prepare(`DELETE FROM tags WHERE post_id = ? AND name = ?`).run(post_id, sourceTag);
      } else {
        // Rename source to target
        db.prepare(`UPDATE tags SET name = ? WHERE post_id = ? AND name = ?`).run(targetTag, post_id, sourceTag);
      }
      merged++;
    }
    
    res.json({ success: true, data: { merged } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Delete all occurrences of a tag
adminRouter.delete('/tags/name/:name', async (req, res) => {
  try {
    const tagName = decodeURIComponent(req.params.name);
    const db = getDatabase();
    const result = db.prepare(`DELETE FROM tags WHERE name = ?`).run(tagName);
    
    res.json({ success: true, data: { deleted: result.changes } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get all tags with counts
adminRouter.get('/tags', async (req, res) => {
  try {
    const db = getDatabase();
    const tags = db.prepare(`
      SELECT name, COUNT(*) as count, 
             SUM(CASE WHEN is_ai_suggested = 1 THEN 1 ELSE 0 END) as ai_count
      FROM tags 
      GROUP BY name 
      ORDER BY count DESC
    `).all() as { name: string; count: number; ai_count: number }[];
    
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============ DATABASE ADMIN ============

// Get database info
adminRouter.get('/database', async (req, res) => {
  try {
    const db = getDatabase();
    
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all() as { name: string }[];
    
    const tableStats: Record<string, number> = {};
    for (const { name } of tables) {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get() as any).count;
      tableStats[name] = count;
    }
    
    res.json({ 
      success: true, 
      data: { 
        tables: tables.map(t => t.name),
        counts: tableStats,
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Vacuum database (optimize)
adminRouter.post('/database/vacuum', async (req, res) => {
  try {
    const db = getDatabase();
    db.exec('VACUUM');
    res.json({ success: true, data: { message: 'Database vacuumed successfully' } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Empty trash (hard delete all soft-deleted posts)
adminRouter.post('/posts/empty-trash', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get all deleted post IDs first
    const deletedPosts = db.prepare(`SELECT id FROM posts WHERE deleted_at IS NOT NULL`).all() as { id: string }[];
    const ids = deletedPosts.map(p => p.id);
    
    if (ids.length === 0) {
      return res.json({ success: true, data: { deleted: 0 } });
    }
    
    const deleted = postsService.bulkHardDelete(ids);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
