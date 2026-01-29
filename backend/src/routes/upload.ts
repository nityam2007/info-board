import { Router, type Router as RouterType } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { uploadService, getContentTypeFromMime } from '../services/upload.js';
import { postsService } from '../services/posts.js';
import { tagsService } from '../services/tags.js';
import { analyzeImageBase64, transcribeAudio } from '../services/ai.js';
import { CONFIG } from '../config.js';

export const uploadRouter: RouterType = Router();

// Upload file (multipart/form-data with base64 in JSON body)
uploadRouter.post('/', async (req, res) => {
  try {
    const { file, filename, mimeType, source } = req.body;
    
    if (!file || !filename || !mimeType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: file (base64), filename, mimeType' 
      });
    }
    
    // Save file
    const fileMetadata = uploadService.saveBase64(file, filename, mimeType);
    
    // Determine content type - first try mimeType, then fallback to filename
    let contentType = getContentTypeFromMime(mimeType);
    
    // Fallback: if mimeType didn't map to image but filename looks like an image
    if (contentType === 'file') {
      const lowerFilename = filename.toLowerCase();
      if (lowerFilename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/)) {
        contentType = 'image';
      } else if (lowerFilename.match(/\.(mp3|wav|ogg|aac|flac|m4a)$/)) {
        contentType = 'audio';
      } else if (lowerFilename.match(/\.(mp4|webm|mov|avi|mkv)$/)) {
        contentType = 'video';
      }
    }
    
    // Initialize AI analysis results
    let aiAnalysis: { ocrText?: string; description?: string; tags?: string[] } = {};
    
    // Auto-analyze images with AI (OCR + description + tags)
    if (contentType === 'image' && CONFIG.AI_ENABLED) {
      try {
        console.log('Analyzing image with AI...');
        const analysis = await analyzeImageBase64(file, mimeType);
        aiAnalysis = {
          ocrText: analysis.ocrText || undefined,
          description: analysis.description || undefined,
          tags: analysis.tags?.length ? analysis.tags : undefined,
        };
        console.log('Image analysis complete:', {
          hasOcr: !!aiAnalysis.ocrText,
          hasDescription: !!aiAnalysis.description,
          tagCount: aiAnalysis.tags?.length || 0,
        });
      } catch (err) {
        console.error('Image analysis failed (non-fatal):', err);
      }
    }
    
    // Create post with file reference and AI analysis
    const post = postsService.create({
      content: filename,
      content_type: contentType,
      source: source || 'upload',
      metadata: {
        ...fileMetadata,
        // AI-generated fields
        ocrText: aiAnalysis.ocrText,
        aiDescription: aiAnalysis.description,
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
    
    res.status(201).json({ 
      success: true, 
      data: {
        post,
        file: fileMetadata,
        aiAnalysis: aiAnalysis.description ? aiAnalysis : undefined,
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Upload URL (extract metadata and create post)
uploadRouter.post('/url', async (req, res) => {
  try {
    const { url, source } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    // Extract metadata with OG image caching
    const metadata = await uploadService.extractUrlMetadata(url);
    
    // Create post
    const post = postsService.create({
      content: url,
      content_type: 'url',
      source: source || 'manual',
      metadata: {
        url,
        title: metadata.title,
        description: metadata.description,
        ogImage: metadata.ogImage,
        ogImageLocal: metadata.ogImageLocal,
        favicon: metadata.favicon,
        siteName: metadata.siteName,
      },
    });
    
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Serve uploaded files
uploadRouter.get('/file/:year/:month/:filename', (req, res) => {
  try {
    const { year, month, filename } = req.params;
    const filepath = join(CONFIG.UPLOADS_PATH, year, month, filename);
    
    if (!existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const file = readFileSync(filepath);
    
    // Set content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'pdf': 'application/pdf',
      'json': 'application/json',
      'txt': 'text/plain',
    };
    
    res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.send(file);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
