/**
 * Master script to analyze ALL content types with AI
 * 
 * Runs all analysis scripts in sequence: images, text, urls, audio
 * 
 * Usage: npx tsx src/scripts/analyze-all.ts [--force] [--limit N] [--batch N] [--dry-run]
 * 
 * Options:
 *   --force   Re-analyze content that already has AI metadata
 *   --limit N Only process N items per content type (for testing)
 *   --batch N Process N items in parallel (default varies by type)
 *   --dry-run Show what would be analyzed without making changes
 */

import { getDatabase, initDatabase } from '../db/sqlite.js';
import { analyzeImage, analyzeText, analyzeUrl, analyzeAudio } from '../services/ai.js';
import { tagsService } from '../services/tags.js';
import { CONFIG } from '../config.js';
import { join } from 'path';
import { existsSync, statSync } from 'fs';

// Cost estimates (Groq pricing approximations)
const COSTS = {
  // Vision model
  IMAGE_INPUT_PER_1K: 0.00010,
  IMAGE_OUTPUT_PER_1K: 0.00020,
  AVG_IMAGE_TOKENS: 1000,
  
  // Text model
  TEXT_INPUT_PER_1K: 0.00005,
  TEXT_OUTPUT_PER_1K: 0.00010,
  AVG_TEXT_TOKENS: 500,
  AVG_TEXT_OUTPUT: 100,
  
  // URL (text + optional vision)
  AVG_URL_TOKENS: 300,
  
  // Audio (Whisper)
  AUDIO_PER_MINUTE: 0.00006,
  AVG_AUDIO_MINUTES: 2,
  AVG_TRANSCRIPTION_TOKENS: 300,
};

// Parse CLI args
const args = process.argv.slice(2);
const forceReanalyze = args.includes('--force');
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;
const batchIndex = args.indexOf('--batch');
const customBatchSize = batchIndex !== -1 ? parseInt(args[batchIndex + 1]) : undefined;

// Default batch sizes per content type
const BATCH_SIZES = {
  images: customBatchSize || 2,
  text: customBatchSize || 3,
  urls: customBatchSize || 2,
  audio: customBatchSize || 2,
};

interface AnalysisResult {
  processed: number;
  skipped: number;
  failed: number;
}

interface PostRow {
  id: string;
  content: string;
  metadata: string;
  created_at: string;
}

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number,
  delayMs: number = 500
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

function findFile(filename: string): string | null {
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear().toString();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const testPath = join(CONFIG.UPLOADS_PATH, year, month, filename);
    if (existsSync(testPath)) {
      return testPath;
    }
  }
  return null;
}

// ============================================
// IMAGE ANALYSIS
// ============================================
async function analyzeImages(db: ReturnType<typeof getDatabase>): Promise<AnalysisResult> {
  console.log('\n--- IMAGES ---');
  
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'image' AND deleted_at IS NULL
  `;
  if (!forceReanalyze) {
    query += ` AND (json_extract(metadata, '$.ocrText') IS NULL AND json_extract(metadata, '$.aiDescription') IS NULL)`;
  }
  query += ` ORDER BY created_at DESC`;
  if (limit) query += ` LIMIT ${limit}`;

  const posts = db.prepare(query).all() as PostRow[];
  console.log(`Found ${posts.length} images to analyze`);

  if (posts.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  const result: AnalysisResult = { processed: 0, skipped: 0, failed: 0 };

  if (dryRun) {
    for (const post of posts.slice(0, 5)) {
      const metadata = JSON.parse(post.metadata || '{}');
      console.log(`  [${post.id.slice(0, 8)}] ${metadata.filename || post.content}`);
    }
    if (posts.length > 5) console.log(`  ... and ${posts.length - 5} more`);
    return result;
  }

  await processBatch(posts, async (post) => {
    const metadata = JSON.parse(post.metadata || '{}');
    const filename = metadata.filename || post.content;
    const imagePath = findFile(filename);

    if (!imagePath) {
      result.skipped++;
      return;
    }

    try {
      const analysis = await analyzeImage(imagePath);
      if (!analysis.description && !analysis.ocrText) {
        result.skipped++;
        return;
      }

      const newMetadata = { ...metadata, ocrText: analysis.ocrText, aiDescription: analysis.description };
      db.prepare(`UPDATE posts SET metadata = ? WHERE id = ?`).run(JSON.stringify(newMetadata), post.id);

      if (analysis.tags?.length) {
        for (const tagName of analysis.tags) {
          try {
            const existing = db.prepare(`SELECT id FROM tags WHERE post_id = ? AND name = ?`).get(post.id, tagName.toLowerCase());
            if (!existing) tagsService.create({ post_id: post.id, name: tagName, is_ai_suggested: true });
          } catch {}
        }
      }

      console.log(`  [${post.id.slice(0, 8)}] Done - Tags: ${analysis.tags?.length || 0}`);
      result.processed++;
    } catch (error) {
      console.log(`  [${post.id.slice(0, 8)}] Failed: ${(error as Error).message}`);
      result.failed++;
    }
  }, BATCH_SIZES.images);

  return result;
}

// ============================================
// TEXT ANALYSIS
// ============================================
async function analyzeTexts(db: ReturnType<typeof getDatabase>): Promise<AnalysisResult> {
  console.log('\n--- TEXT ---');
  
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'text' AND deleted_at IS NULL AND content IS NOT NULL AND length(content) > 10
  `;
  if (!forceReanalyze) {
    query += ` AND json_extract(metadata, '$.aiSummary') IS NULL`;
  }
  query += ` ORDER BY created_at DESC`;
  if (limit) query += ` LIMIT ${limit}`;

  const posts = db.prepare(query).all() as PostRow[];
  console.log(`Found ${posts.length} text posts to analyze`);

  if (posts.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  const result: AnalysisResult = { processed: 0, skipped: 0, failed: 0 };

  if (dryRun) {
    for (const post of posts.slice(0, 5)) {
      console.log(`  [${post.id.slice(0, 8)}] ${post.content.slice(0, 40)}...`);
    }
    if (posts.length > 5) console.log(`  ... and ${posts.length - 5} more`);
    return result;
  }

  await processBatch(posts, async (post) => {
    const metadata = JSON.parse(post.metadata || '{}');

    try {
      const analysis = await analyzeText(post.content);
      if (!analysis.summary && !analysis.tags?.length) {
        result.skipped++;
        return;
      }

      const newMetadata = { ...metadata, aiSummary: analysis.summary };
      db.prepare(`UPDATE posts SET metadata = ? WHERE id = ?`).run(JSON.stringify(newMetadata), post.id);

      if (analysis.tags?.length) {
        for (const tagName of analysis.tags) {
          try {
            const existing = db.prepare(`SELECT id FROM tags WHERE post_id = ? AND name = ?`).get(post.id, tagName.toLowerCase());
            if (!existing) tagsService.create({ post_id: post.id, name: tagName, is_ai_suggested: true });
          } catch {}
        }
      }

      console.log(`  [${post.id.slice(0, 8)}] Done - Tags: ${analysis.tags?.length || 0}`);
      result.processed++;
    } catch (error) {
      console.log(`  [${post.id.slice(0, 8)}] Failed: ${(error as Error).message}`);
      result.failed++;
    }
  }, BATCH_SIZES.text);

  return result;
}

// ============================================
// URL ANALYSIS
// ============================================
async function analyzeUrls(db: ReturnType<typeof getDatabase>): Promise<AnalysisResult> {
  console.log('\n--- URLS ---');
  
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'url' AND deleted_at IS NULL
  `;
  if (!forceReanalyze) {
    query += ` AND json_extract(metadata, '$.aiSummary') IS NULL`;
  }
  query += ` ORDER BY created_at DESC`;
  if (limit) query += ` LIMIT ${limit}`;

  const posts = db.prepare(query).all() as PostRow[];
  console.log(`Found ${posts.length} URL posts to analyze`);

  if (posts.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  const result: AnalysisResult = { processed: 0, skipped: 0, failed: 0 };

  if (dryRun) {
    for (const post of posts.slice(0, 5)) {
      console.log(`  [${post.id.slice(0, 8)}] ${post.content.slice(0, 50)}...`);
    }
    if (posts.length > 5) console.log(`  ... and ${posts.length - 5} more`);
    return result;
  }

  await processBatch(posts, async (post) => {
    const metadata = JSON.parse(post.metadata || '{}');
    const url = post.content;

    try {
      const analysis = await analyzeUrl(metadata.title || '', metadata.description || '', url);
      
      let imageAnalysis: { ocrText?: string; description?: string; tags?: string[] } = {};
      const platform = metadata.platform;
      if ((platform === 'youtube' || platform === 'reddit') && metadata.ogImageLocal) {
        const imagePath = findFile(metadata.ogImageLocal);
        if (imagePath) {
          try {
            imageAnalysis = await analyzeImage(imagePath);
          } catch {}
        }
      }

      const allTags = new Set<string>();
      analysis.tags?.forEach(t => allTags.add(t));
      imageAnalysis.tags?.forEach(t => allTags.add(t));

      if (!analysis.summary && !allTags.size && !imageAnalysis.ocrText) {
        result.skipped++;
        return;
      }

      const newMetadata = {
        ...metadata,
        aiSummary: analysis.summary,
        ocrText: imageAnalysis.ocrText,
        aiDescription: imageAnalysis.description,
      };
      db.prepare(`UPDATE posts SET metadata = ? WHERE id = ?`).run(JSON.stringify(newMetadata), post.id);

      for (const tagName of allTags) {
        try {
          const existing = db.prepare(`SELECT id FROM tags WHERE post_id = ? AND name = ?`).get(post.id, tagName.toLowerCase());
          if (!existing) tagsService.create({ post_id: post.id, name: tagName, is_ai_suggested: true });
        } catch {}
      }

      console.log(`  [${post.id.slice(0, 8)}] Done - Tags: ${allTags.size}`);
      result.processed++;
    } catch (error) {
      console.log(`  [${post.id.slice(0, 8)}] Failed: ${(error as Error).message}`);
      result.failed++;
    }
  }, BATCH_SIZES.urls);

  return result;
}

// ============================================
// AUDIO ANALYSIS
// ============================================
async function analyzeAudios(db: ReturnType<typeof getDatabase>): Promise<AnalysisResult> {
  console.log('\n--- AUDIO ---');
  
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'audio' AND deleted_at IS NULL
  `;
  if (!forceReanalyze) {
    query += ` AND json_extract(metadata, '$.transcription') IS NULL`;
  }
  query += ` ORDER BY created_at DESC`;
  if (limit) query += ` LIMIT ${limit}`;

  const posts = db.prepare(query).all() as PostRow[];
  console.log(`Found ${posts.length} audio posts to analyze`);

  if (posts.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  const result: AnalysisResult = { processed: 0, skipped: 0, failed: 0 };

  if (dryRun) {
    for (const post of posts.slice(0, 5)) {
      const metadata = JSON.parse(post.metadata || '{}');
      console.log(`  [${post.id.slice(0, 8)}] ${metadata.originalName || post.content}`);
    }
    if (posts.length > 5) console.log(`  ... and ${posts.length - 5} more`);
    return result;
  }

  await processBatch(posts, async (post) => {
    const metadata = JSON.parse(post.metadata || '{}');
    const filename = metadata.filename || post.content;
    const audioPath = findFile(filename);

    if (!audioPath) {
      result.skipped++;
      return;
    }

    try {
      const analysis = await analyzeAudio(audioPath);
      if (!analysis.transcription) {
        result.skipped++;
        return;
      }

      const newMetadata = { ...metadata, transcription: analysis.transcription, aiSummary: analysis.summary };
      db.prepare(`UPDATE posts SET metadata = ? WHERE id = ?`).run(JSON.stringify(newMetadata), post.id);

      if (analysis.tags?.length) {
        for (const tagName of analysis.tags) {
          try {
            const existing = db.prepare(`SELECT id FROM tags WHERE post_id = ? AND name = ?`).get(post.id, tagName.toLowerCase());
            if (!existing) tagsService.create({ post_id: post.id, name: tagName, is_ai_suggested: true });
          } catch {}
        }
      }

      console.log(`  [${post.id.slice(0, 8)}] Done - Tags: ${analysis.tags?.length || 0}`);
      result.processed++;
    } catch (error) {
      console.log(`  [${post.id.slice(0, 8)}] Failed: ${(error as Error).message}`);
      result.failed++;
    }
  }, BATCH_SIZES.audio, 1000); // Longer delay for audio

  return result;
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('========================================');
  console.log('    ANALYZE ALL - AI Content Analysis   ');
  console.log('========================================');
  console.log(`AI Enabled: ${CONFIG.AI_ENABLED}`);
  console.log(`Force re-analyze: ${forceReanalyze}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit per type: ${limit || 'none'}`);
  console.log(`Batch sizes: images=${BATCH_SIZES.images}, text=${BATCH_SIZES.text}, urls=${BATCH_SIZES.urls}, audio=${BATCH_SIZES.audio}`);

  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    console.error('\nAI is not enabled. Set AI_ENABLED=true and GROQ_API_KEY in .env');
    process.exit(1);
  }

  // Initialize database
  initDatabase();
  const db = getDatabase();

  // Count posts to estimate cost
  const counts = {
    images: (db.prepare(`SELECT COUNT(*) as count FROM posts WHERE content_type = 'image' AND deleted_at IS NULL ${!forceReanalyze ? "AND json_extract(metadata, '$.ocrText') IS NULL AND json_extract(metadata, '$.aiDescription') IS NULL" : ''}`).get() as { count: number }).count,
    text: (db.prepare(`SELECT COUNT(*) as count FROM posts WHERE content_type = 'text' AND deleted_at IS NULL AND content IS NOT NULL AND length(content) > 10 ${!forceReanalyze ? "AND json_extract(metadata, '$.aiSummary') IS NULL" : ''}`).get() as { count: number }).count,
    urls: (db.prepare(`SELECT COUNT(*) as count FROM posts WHERE content_type = 'url' AND deleted_at IS NULL ${!forceReanalyze ? "AND json_extract(metadata, '$.aiSummary') IS NULL" : ''}`).get() as { count: number }).count,
    audio: (db.prepare(`SELECT COUNT(*) as count FROM posts WHERE content_type = 'audio' AND deleted_at IS NULL ${!forceReanalyze ? "AND json_extract(metadata, '$.transcription') IS NULL" : ''}`).get() as { count: number }).count,
  };

  // Apply limit
  const actualCounts = {
    images: limit ? Math.min(counts.images, limit) : counts.images,
    text: limit ? Math.min(counts.text, limit) : counts.text,
    urls: limit ? Math.min(counts.urls, limit) : counts.urls,
    audio: limit ? Math.min(counts.audio, limit) : counts.audio,
  };

  // Cost estimates
  const imageCost = actualCounts.images * ((COSTS.AVG_IMAGE_TOKENS / 1000) * COSTS.IMAGE_INPUT_PER_1K + (COSTS.AVG_TEXT_OUTPUT / 1000) * COSTS.IMAGE_OUTPUT_PER_1K);
  const textCost = actualCounts.text * ((COSTS.AVG_TEXT_TOKENS / 1000) * COSTS.TEXT_INPUT_PER_1K + (COSTS.AVG_TEXT_OUTPUT / 1000) * COSTS.TEXT_OUTPUT_PER_1K);
  const urlCost = actualCounts.urls * ((COSTS.AVG_URL_TOKENS / 1000) * COSTS.TEXT_INPUT_PER_1K + (COSTS.AVG_TEXT_OUTPUT / 1000) * COSTS.TEXT_OUTPUT_PER_1K);
  const audioCost = actualCounts.audio * (COSTS.AVG_AUDIO_MINUTES * COSTS.AUDIO_PER_MINUTE + (COSTS.AVG_TRANSCRIPTION_TOKENS / 1000) * COSTS.TEXT_INPUT_PER_1K);
  const totalCost = imageCost + textCost + urlCost + audioCost;

  console.log('\n--- COST ESTIMATE ---');
  console.log(`Images: ${actualCounts.images} items, ~$${imageCost.toFixed(4)}`);
  console.log(`Text:   ${actualCounts.text} items, ~$${textCost.toFixed(4)}`);
  console.log(`URLs:   ${actualCounts.urls} items, ~$${urlCost.toFixed(4)}`);
  console.log(`Audio:  ${actualCounts.audio} items, ~$${audioCost.toFixed(4)}`);
  console.log(`TOTAL:  ${actualCounts.images + actualCounts.text + actualCounts.urls + actualCounts.audio} items, ~$${totalCost.toFixed(4)}`);

  if (dryRun) {
    console.log('\n--- DRY RUN MODE ---');
  }

  // Run all analyzers
  const results = {
    images: await analyzeImages(db),
    text: await analyzeTexts(db),
    urls: await analyzeUrls(db),
    audio: await analyzeAudios(db),
  };

  // Combined summary
  console.log('\n========================================');
  console.log('           COMBINED SUMMARY             ');
  console.log('========================================');
  console.log('');
  console.log('          Processed  Skipped  Failed');
  console.log(`Images:   ${String(results.images.processed).padStart(9)}  ${String(results.images.skipped).padStart(7)}  ${String(results.images.failed).padStart(6)}`);
  console.log(`Text:     ${String(results.text.processed).padStart(9)}  ${String(results.text.skipped).padStart(7)}  ${String(results.text.failed).padStart(6)}`);
  console.log(`URLs:     ${String(results.urls.processed).padStart(9)}  ${String(results.urls.skipped).padStart(7)}  ${String(results.urls.failed).padStart(6)}`);
  console.log(`Audio:    ${String(results.audio.processed).padStart(9)}  ${String(results.audio.skipped).padStart(7)}  ${String(results.audio.failed).padStart(6)}`);
  console.log('----------------------------------------');
  const total = {
    processed: results.images.processed + results.text.processed + results.urls.processed + results.audio.processed,
    skipped: results.images.skipped + results.text.skipped + results.urls.skipped + results.audio.skipped,
    failed: results.images.failed + results.text.failed + results.urls.failed + results.audio.failed,
  };
  console.log(`TOTAL:    ${String(total.processed).padStart(9)}  ${String(total.skipped).padStart(7)}  ${String(total.failed).padStart(6)}`);
  console.log('========================================');
}

main().catch(console.error);
