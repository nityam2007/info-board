import { getDatabase } from '../db/sqlite.js';
import { postsService } from './posts.js';
import { tagsService } from './tags.js';
import { tasksService } from './tasks.js';
import type { Post, Tag, Task } from '../types.js';
import { CONFIG } from '../config.js';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';

export interface ExportData {
  version: string;
  exportedAt: string;
  posts: Post[];
  tags: Tag[];
  tasks: Task[];
  files: { path: string; base64: string }[];
}

export interface ImportResult {
  postsImported: number;
  tagsImported: number;
  tasksImported: number;
  filesImported: number;
  errors: string[];
}

export const exportService = {
  // Export all data as JSON
  exportAll(includeFiles: boolean = true): ExportData {
    const db = getDatabase();
    
    // Get all posts (including soft-deleted for full backup)
    const postsStmt = db.prepare(`SELECT * FROM posts ORDER BY created_at ASC`);
    const posts = (postsStmt.all() as any[]).map(postsService.mapRow);
    
    // Get all tags
    const tagsStmt = db.prepare(`SELECT * FROM tags ORDER BY created_at ASC`);
    const tags = tagsStmt.all() as Tag[];
    
    // Get all tasks
    const tasksStmt = db.prepare(`SELECT * FROM tasks ORDER BY created_at ASC`);
    const tasks = tasksStmt.all() as Task[];
    
    // Optionally include file contents
    const files: { path: string; base64: string }[] = [];
    if (includeFiles) {
      const uploadsDir = CONFIG.UPLOADS_PATH;
      if (existsSync(uploadsDir)) {
        this.collectFiles(uploadsDir, uploadsDir, files);
      }
    }
    
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      posts,
      tags,
      tasks,
      files,
    };
  },

  // Recursively collect files
  collectFiles(dir: string, baseDir: string, files: { path: string; base64: string }[]): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        this.collectFiles(fullPath, baseDir, files);
      } else if (stat.isFile()) {
        const relativePath = fullPath.replace(baseDir, '').replace(/^[/\\]/, '');
        const content = readFileSync(fullPath);
        files.push({
          path: relativePath,
          base64: content.toString('base64'),
        });
      }
    }
  },

  // Import data from export
  importAll(data: ExportData, overwrite: boolean = false): ImportResult {
    const db = getDatabase();
    const result: ImportResult = {
      postsImported: 0,
      tagsImported: 0,
      tasksImported: 0,
      filesImported: 0,
      errors: [],
    };

    // Start transaction
    db.exec('BEGIN TRANSACTION');

    try {
      // Import posts
      for (const post of data.posts) {
        try {
          // Check if post exists
          const existing = db.prepare(`SELECT id FROM posts WHERE id = ?`).get(post.id);
          
          if (existing && !overwrite) {
            continue; // Skip existing
          }
          
          if (existing) {
            // Update existing
            db.prepare(`
              UPDATE posts SET content = ?, content_type = ?, source = ?, 
              metadata = ?, created_at = ?, deleted_at = ?
              WHERE id = ?
            `).run(
              post.content,
              post.content_type,
              post.source,
              JSON.stringify(post.metadata),
              post.created_at,
              post.deleted_at,
              post.id
            );
          } else {
            // Insert new
            db.prepare(`
              INSERT INTO posts (id, content, content_type, source, metadata, created_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              post.id,
              post.content,
              post.content_type,
              post.source,
              JSON.stringify(post.metadata),
              post.created_at,
              post.deleted_at
            );
          }
          result.postsImported++;
        } catch (err) {
          result.errors.push(`Post ${post.id}: ${(err as Error).message}`);
        }
      }

      // Import tags
      for (const tag of data.tags) {
        try {
          const existing = db.prepare(`SELECT id FROM tags WHERE id = ?`).get(tag.id);
          if (!existing) {
            db.prepare(`
              INSERT INTO tags (id, post_id, name, is_ai_suggested, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).run(tag.id, tag.post_id, tag.name, tag.is_ai_suggested ? 1 : 0, tag.created_at);
            result.tagsImported++;
          }
        } catch (err) {
          result.errors.push(`Tag ${tag.id}: ${(err as Error).message}`);
        }
      }

      // Import tasks
      for (const task of data.tasks) {
        try {
          const existing = db.prepare(`SELECT id FROM tasks WHERE id = ?`).get(task.id);
          if (!existing) {
            db.prepare(`
              INSERT INTO tasks (id, post_id, description, due_date, completed, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              task.id, 
              task.post_id, 
              task.description, 
              task.due_date, 
              task.completed ? 1 : 0, 
              task.created_at
            );
            result.tasksImported++;
          }
        } catch (err) {
          result.errors.push(`Task ${task.id}: ${(err as Error).message}`);
        }
      }

      // Import files
      for (const file of data.files) {
        try {
          const targetPath = join(CONFIG.UPLOADS_PATH, file.path);
          const targetDir = dirname(targetPath);
          
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }
          
          if (!existsSync(targetPath) || overwrite) {
            const content = Buffer.from(file.base64, 'base64');
            writeFileSync(targetPath, content);
            result.filesImported++;
          }
        } catch (err) {
          result.errors.push(`File ${file.path}: ${(err as Error).message}`);
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return result;
  },
};
