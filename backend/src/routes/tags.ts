import { Router } from 'express';
import { tagsService } from '../services/tags.js';
import { postsService } from '../services/posts.js';
import type { CreateTagRequest } from '../types.js';

export const tagsRouter = Router();

// Create tag
tagsRouter.post('/', async (req, res) => {
  try {
    const data: CreateTagRequest = req.body;
    
    if (!data.post_id || !data.name) {
      return res.status(400).json({ success: false, error: 'post_id and name are required' });
    }
    
    // Verify post exists
    const post = postsService.getById(data.post_id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    const tag = tagsService.create(data);
    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// List all unique tags
tagsRouter.get('/', async (req, res) => {
  try {
    const tags = tagsService.listAll();
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Delete tag
tagsRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = tagsService.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Tag not found' });
    }
    
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
