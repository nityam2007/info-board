import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { uploadService, getContentTypeFromMime } from '../services/upload.js';
import { postsService } from '../services/posts.js';
import { CONFIG } from '../config.js';

export const uploadRouter = Router();

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
    
    // Determine content type
    const contentType = getContentTypeFromMime(mimeType);
    
    // Create post with file reference
    const post = postsService.create({
      content: filename,
      content_type: contentType,
      source: source || 'upload',
      metadata: {
        ...fileMetadata,
      },
    });
    
    res.status(201).json({ 
      success: true, 
      data: {
        post,
        file: fileMetadata,
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
