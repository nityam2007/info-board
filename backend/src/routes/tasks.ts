import { Router } from 'express';
import { tasksService } from '../services/tasks.js';
import { postsService } from '../services/posts.js';
import type { CreateTaskRequest, UpdateTaskRequest } from '../types.js';

export const tasksRouter = Router();

// Create task
tasksRouter.post('/', async (req, res) => {
  try {
    const data: CreateTaskRequest = req.body;
    
    if (!data.post_id || !data.description) {
      return res.status(400).json({ success: false, error: 'post_id and description are required' });
    }
    
    // Verify post exists
    const post = postsService.getById(data.post_id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    const task = tasksService.create(data);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// List all tasks
tasksRouter.get('/', async (req, res) => {
  try {
    const completed = req.query.completed === 'true' ? true 
      : req.query.completed === 'false' ? false 
      : undefined;
    
    const tasks = tasksService.listAll({ completed });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Update task
tasksRouter.patch('/:id', async (req, res) => {
  try {
    const data: UpdateTaskRequest = req.body;
    const task = tasksService.update(req.params.id, data);
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Delete task
tasksRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = tasksService.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
