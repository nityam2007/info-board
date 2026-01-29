import { randomUUID } from 'crypto';
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { CONFIG } from '../config.js';
import type { FileMetadata } from '../types.js';
import imageSize from 'image-size';

// MIME type to content_type mapping
const MIME_MAPPING: Record<string, string> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/ico': 'image',
  
  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/aac': 'audio',
  'audio/flac': 'audio',
  
  // Video
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  
  // Documents/Files
  'application/pdf': 'file',
  'application/zip': 'file',
  'application/json': 'file',
  'text/plain': 'text',
  'text/html': 'text',
  'text/css': 'text',
  'text/javascript': 'text',
};

// Get content type from MIME type
export function getContentTypeFromMime(mimeType: string): 'text' | 'image' | 'audio' | 'video' | 'url' | 'file' {
  return (MIME_MAPPING[mimeType] || 'file') as any;
}

// Generate unique filename preserving extension
function generateFilename(originalName: string): string {
  const ext = extname(originalName) || '';
  const id = randomUUID().slice(0, 8);
  const timestamp = Date.now();
  return `${timestamp}-${id}${ext}`;
}

// Organize uploads by date folders (YYYY/MM)
function getUploadPath(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const dir = join(CONFIG.UPLOADS_PATH, year, month);
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  return dir;
}

export const uploadService = {
  // Save file from buffer
  saveFile(buffer: Buffer, originalName: string, mimeType: string): FileMetadata {
    const filename = generateFilename(originalName);
    const uploadDir = getUploadPath();
    const filepath = join(uploadDir, filename);
    
    writeFileSync(filepath, buffer);
    
    // Get relative path from uploads root
    const relativePath = filepath.replace(CONFIG.UPLOADS_PATH, '').replace(/^\//, '');
    
    // Extract image dimensions if it's an image
    let width: number | undefined;
    let height: number | undefined;
    
    if (mimeType.startsWith('image/')) {
      try {
        const dimensions = imageSize(buffer);
        width = dimensions.width;
        height = dimensions.height;
      } catch (e) {
        console.warn('Could not extract image dimensions:', e);
      }
    }
    
    return {
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      width,
      height,
    };
  },
  
  // Save file from base64
  saveBase64(base64Data: string, originalName: string, mimeType: string): FileMetadata {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    return this.saveFile(buffer, originalName, mimeType);
  },
  
  // Get file path
  getFilePath(filename: string, year?: string, month?: string): string | null {
    if (year && month) {
      const path = join(CONFIG.UPLOADS_PATH, year, month, filename);
      return existsSync(path) ? path : null;
    }
    
    // Search in recent months if year/month not provided
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear().toString();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const path = join(CONFIG.UPLOADS_PATH, year, month, filename);
      if (existsSync(path)) {
        return path;
      }
    }
    
    return null;
  },
  
  // Read file
  readFile(filepath: string): Buffer | null {
    if (!existsSync(filepath)) return null;
    return readFileSync(filepath);
  },
  
  // Delete file
  deleteFile(filepath: string): boolean {
    if (!existsSync(filepath)) return false;
    unlinkSync(filepath);
    return true;
  },
  
  // Detect content type from input
  detectContentType(content: string): { type: 'text' | 'url', url?: string } {
    // URL detection
    const urlRegex = /^(https?:\/\/[^\s]+)$/i;
    const match = content.trim().match(urlRegex);
    
    if (match) {
      return { type: 'url', url: match[1] };
    }
    
    // Check if content contains URLs
    const urlInText = /(https?:\/\/[^\s]+)/gi;
    const urls = content.match(urlInText);
    
    if (urls && urls.length === 1 && content.trim() === urls[0]) {
      return { type: 'url', url: urls[0] };
    }
    
    return { type: 'text' };
  },
  
  // Generate a readable title from URL as fallback
  generateTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      const pathname = urlObj.pathname;
      
      // Special handling for known sites
      if (hostname.includes('github.com')) {
        // github.com/user/repo -> user/repo
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          return `${parts[0]}/${parts[1]} - GitHub`;
        } else if (parts.length === 1) {
          return `${parts[0]} - GitHub`;
        }
        return 'GitHub';
      }
      
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return 'YouTube Video';
      }
      
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 1) {
          return `@${parts[0]} - Twitter/X`;
        }
        return 'Twitter/X';
      }
      
      // Generic: use domain + cleaned path
      if (pathname && pathname !== '/') {
        // Clean up path: /blog/my-post -> Blog - My Post
        const pathParts = pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1]
            .replace(/[-_]/g, ' ')
            .replace(/\.[^.]+$/, '') // Remove file extension
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          return `${lastPart} - ${hostname}`;
        }
      }
      
      // Just the domain
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch {
      return url;
    }
  },
  
  // Extract URL metadata with OG image caching
  async extractUrlMetadata(url: string): Promise<{ 
    title?: string; 
    description?: string; 
    ogImage?: string;
    ogImageLocal?: string;
    favicon?: string;
    siteName?: string;
  }> {
    // Generate fallback title from URL first
    const fallbackTitle = this.generateTitleFromUrl(url);
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        console.warn(`URL fetch returned ${response.status} for ${url}`);
        return { title: fallbackTitle };
      }
      
      const html = await response.text();
      
      // Extract title - try multiple patterns
      let title: string | undefined;
      
      // 1. Try og:title first (most reliable)
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitleMatch) {
        title = ogTitleMatch[1].trim();
      }
      
      // 2. Try twitter:title
      if (!title) {
        const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:title["']/i);
        if (twitterTitleMatch) {
          title = twitterTitleMatch[1].trim();
        }
      }
      
      // 3. Try <title> tag
      if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
      }
      
      // 4. Use fallback if still no title
      if (!title || title.length === 0) {
        title = fallbackTitle;
      }
      
      // Extract meta description - try multiple patterns
      let description: string | undefined;
      
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
      if (ogDescMatch) {
        description = ogDescMatch[1].trim();
      }
      
      if (!description) {
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      }
      
      // Extract OG image
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      let ogImage = ogImageMatch ? ogImageMatch[1].trim() : undefined;
      
      // Make relative URLs absolute
      if (ogImage && !ogImage.startsWith('http')) {
        const urlObj = new URL(url);
        ogImage = ogImage.startsWith('/') 
          ? `${urlObj.protocol}//${urlObj.host}${ogImage}`
          : `${urlObj.protocol}//${urlObj.host}/${ogImage}`;
      }
      
      // Extract site name
      const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
      const siteName = siteNameMatch ? siteNameMatch[1].trim() : undefined;
      
      // Extract favicon - try multiple patterns
      let favicon: string | undefined;
      const faviconPatterns = [
        /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
        /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["']/i,
        /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
      ];
      
      for (const pattern of faviconPatterns) {
        const match = html.match(pattern);
        if (match) {
          favicon = match[1].trim();
          break;
        }
      }
      
      if (favicon && !favicon.startsWith('http')) {
        const urlObj = new URL(url);
        favicon = favicon.startsWith('/') 
          ? `${urlObj.protocol}//${urlObj.host}${favicon}`
          : `${urlObj.protocol}//${urlObj.host}/${favicon}`;
      }
      if (!favicon) {
        const urlObj = new URL(url);
        favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
      }
      
      // Cache OG image locally
      let ogImageLocal: string | undefined;
      if (ogImage) {
        try {
          ogImageLocal = await this.cacheRemoteImage(ogImage);
        } catch (e) {
          console.error('Failed to cache OG image:', e);
        }
      }
      
      return { title, description, ogImage, ogImageLocal, favicon, siteName };
    } catch (error) {
      console.error('Failed to extract URL metadata:', error);
      // Always return at least a fallback title
      return { title: fallbackTitle };
    }
  },
  
  // Cache remote image locally
  async cacheRemoteImage(imageUrl: string): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; InfoBoard/1.0)',
        },
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) return undefined;
      
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) return undefined;
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Generate filename from URL hash
      const hash = imageUrl.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      const ext = contentType.includes('png') ? '.png' 
        : contentType.includes('gif') ? '.gif' 
        : contentType.includes('webp') ? '.webp' 
        : '.jpg';
      const filename = `og_${Math.abs(hash).toString(16)}${ext}`;
      
      const fileMetadata = this.saveFile(buffer, filename, contentType);
      return fileMetadata.filename;
    } catch (error) {
      console.error('Failed to cache remote image:', error);
      return undefined;
    }
  },
};
