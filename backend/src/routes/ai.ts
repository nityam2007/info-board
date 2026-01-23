import { Router, type Router as RouterType } from 'express';
import { CONFIG } from '../config.js';
import { suggestTags, extractTasks, generateDescription, chat } from '../services/ai.js';
import { postsService } from '../services/posts.js';
import { searchService } from '../services/search.js';

export const aiRouter: RouterType = Router();

// Middleware to check AI is enabled
aiRouter.use((req, res, next) => {
  if (!CONFIG.AI_ENABLED) {
    return res.status(503).json({ 
      success: false, 
      error: 'AI features are disabled. Set AI_ENABLED=true in .env' 
    });
  }
  if (!CONFIG.GROQ_API_KEY || CONFIG.GROQ_API_KEY === 'your-groq-api-key') {
    return res.status(503).json({ 
      success: false, 
      error: 'GROQ_API_KEY not configured in .env' 
    });
  }
  next();
});

// Get AI suggestions (tags/tasks/description)
aiRouter.post('/suggest', async (req, res) => {
  try {
    const { content, contentType = 'text', type = 'all' } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    
    const result: { 
      tags?: string[]; 
      tasks?: Array<{ description: string; dueDate?: string }>;
      description?: string;
    } = {};
    
    if (type === 'all' || type === 'tags') {
      result.tags = await suggestTags(content, contentType);
    }
    
    if (type === 'all' || type === 'tasks') {
      result.tasks = await extractTasks(content);
    }
    
    if (type === 'all' || type === 'description') {
      result.description = await generateDescription(content, contentType);
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Suggest for existing post
aiRouter.post('/suggest/:postId', async (req, res) => {
  try {
    const { type = 'all' } = req.body;
    const post = postsService.getById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    const result: { 
      tags?: string[]; 
      tasks?: Array<{ description: string; dueDate?: string }>;
      description?: string;
    } = {};
    
    if (type === 'all' || type === 'tags') {
      result.tags = await suggestTags(post.content, post.content_type);
    }
    
    if (type === 'all' || type === 'tasks') {
      result.tasks = await extractTasks(post.content);
    }
    
    if (type === 'all' || type === 'description') {
      result.description = await generateDescription(post.content, post.content_type);
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// AI chat query
aiRouter.post('/chat', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    // Search for relevant posts to use as context
    let relevantPosts = searchService.search({ q: query, limit: 5 });
    
    // If no search results, get recent posts as context
    if (relevantPosts.length === 0) {
      relevantPosts = postsService.list({ limit: 10, offset: 0 });
    }
    
    const context = relevantPosts.map(p => `[${p.content_type}] ${p.content.slice(0, 500)}`);
    
    const response = await chat(query, context);
    
    res.json({ 
      success: true, 
      data: { 
        response,
        sources: relevantPosts.map(p => ({ id: p.id, preview: p.content.slice(0, 100) }))
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
