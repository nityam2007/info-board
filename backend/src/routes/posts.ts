import { Router, type Router as RouterType } from 'express';
import { postsService } from '../services/posts.js';
import { tagsService } from '../services/tags.js';
import { tasksService } from '../services/tasks.js';
import { analyzeText } from '../services/ai.js';
import { CONFIG } from '../config.js';
import type { CreatePostRequest } from '../types.js';

export const postsRouter: RouterType = Router();

// Get stats (before :id route to avoid conflict)
postsRouter.get('/stats', async (req, res) => {
  try {
    const stats = postsService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Create post
postsRouter.post('/', async (req, res) => {
  try {
    const data: CreatePostRequest = req.body;
    
    if (!data.content || data.content.trim() === '') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    
    // Default to text type if not specified
    const contentType = data.content_type || 'text';
    
    // AI analysis for text posts
    let aiAnalysis: { tags?: string[]; summary?: string } = {};
    
    if (contentType === 'text' && CONFIG.AI_ENABLED) {
      try {
        console.log('Analyzing text with AI...');
        const analysis = await analyzeText(data.content);
        aiAnalysis = {
          tags: analysis.tags?.length ? analysis.tags : undefined,
          summary: analysis.summary || undefined,
        };
        console.log('Text analysis complete:', {
          tagCount: aiAnalysis.tags?.length || 0,
          hasSummary: !!aiAnalysis.summary,
        });
      } catch (err) {
        console.error('Text analysis failed (non-fatal):', err);
      }
    }
    
    // Create post with AI summary in metadata
    const post = postsService.create({
      ...data,
      content_type: contentType,
      metadata: {
        ...data.metadata,
        aiSummary: aiAnalysis.summary,
      },
    });
    
    // Auto-add AI-suggested tags
    if (aiAnalysis.tags?.length) {
      for (const tagName of aiAnalysis.tags) {
        try {
          tagsService.create({
            post_id: post.id,
            name: tagName,
            is_ai_suggested: true,
          });
        } catch (err) {
          console.error(`Failed to add tag "${tagName}":`, err);
        }
      }
    }
    
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// List posts
postsRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const content_type = req.query.content_type as string;
    
    const posts = postsService.list({ limit, offset, content_type });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get single post
postsRouter.get('/:id', async (req, res) => {
  try {
    const post = postsService.getById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    // Include related tags and tasks
    const tags = tagsService.getByPostId(post.id);
    const tasks = tasksService.getByPostId(post.id);
    
    res.json({ success: true, data: { ...post, tags, tasks } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Soft delete post
postsRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = postsService.softDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
