import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/sqlite.js';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../types.js';

export const tasksService = {
  create(data: CreateTaskRequest): Task {
    const db = getDatabase();
    const id = uuid();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO tasks (id, post_id, description, due_date, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.post_id, data.description, data.due_date || null, now);
    
    return this.getById(id)!;
  },

  getById(id: string): Task | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM tasks WHERE id = ?`);
    const row = stmt.get(id) as any;
    return row ? this.mapRow(row) : null;
  },

  getByPostId(postId: string): Task[] {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM tasks WHERE post_id = ? ORDER BY created_at`);
    const rows = stmt.all(postId) as any[];
    return rows.map(this.mapRow);
  },

  update(id: string, data: UpdateTaskRequest): Task | null {
    const db = getDatabase();
    const existing = this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }
    if (data.completed !== undefined) {
      updates.push('completed = ?');
      params.push(data.completed ? 1 : 0);
    }

    if (updates.length === 0) return existing;

    params.push(id);
    const stmt = db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.getById(id);
  },

  delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare(`DELETE FROM tasks WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  listAll(options: { completed?: boolean } = {}): Task[] {
    const db = getDatabase();
    let sql = `SELECT * FROM tasks`;
    const params: any[] = [];

    if (options.completed !== undefined) {
      sql += ` WHERE completed = ?`;
      params.push(options.completed ? 1 : 0);
    }

    sql += ` ORDER BY due_date ASC NULLS LAST, created_at DESC`;
    const stmt = db.prepare(sql);
    return (stmt.all(...params) as any[]).map(this.mapRow);
  },

  mapRow(row: any): Task {
    return {
      id: row.id,
      post_id: row.post_id,
      description: row.description,
      due_date: row.due_date,
      completed: Boolean(row.completed),
      created_at: row.created_at,
    };
  },
};
