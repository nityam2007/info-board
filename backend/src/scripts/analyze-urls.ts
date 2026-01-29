/**
 * Script to analyze existing URL posts with AI (tags + summary + image analysis for YT/Reddit)
 * 
 * Usage: npx tsx src/scripts/analyze-urls.ts [--force] [--limit N] [--batch N] [--dry-run]
 * 
 * Options:
 *   --force   Re-analyze URLs that already have AI metadata
 *   --limit N Only process N posts (for testing)
 *   --batch N Process N posts in parallel (default: 2)
 *   --dry-run Show what would be analyzed without making changes
 */

import { getDatabase, initDatabase } from '../db/sqlite.js';
import { analyzeUrl, analyzeImage } from '../services/ai.js';
import { tagsService } from '../services/tags.js';
import { CONFIG } from '../config.js';
import { join } from 'path';
import { existsSync } from 'fs';

// Cost estimates (Groq pricing approximations)
const COST_PER_1K_INPUT_TEXT = 0.00005;
const COST_PER_1K_OUTPUT_TEXT = 0.00010;
const COST_PER_1K_INPUT_VISION = 0.00010;  // Vision is 2x text
const COST_PER_1K_OUTPUT_VISION = 0.00020;
const AVG_INPUT_TOKENS = 300;
const AVG_OUTPUT_TOKENS = 100;
const AVG_IMAGE_TOKENS = 1000; // Image analysis uses more tokens

// Parse CLI args
const args = process.argv.slice(2);
const forceReanalyze = args.includes('--force');
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;
const batchIndex = args.indexOf('--batch');
const batchSize = batchIndex !== -1 ? parseInt(args[batchIndex + 1]) : 2;

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function main() {
  console.log('URL ANALYSIS SCRIPT');
  console.log('========================');
  console.log(`AI Enabled: ${CONFIG.AI_ENABLED}`);
  console.log(`Force re-analyze: ${forceReanalyze}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log('');

  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    console.error('AI is not enabled. Set AI_ENABLED=true and GROQ_API_KEY in .env');
    process.exit(1);
  }

  initDatabase();
  const db = getDatabase();

  // Get all URL posts
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'url' 
      AND deleted_at IS NULL
  `;

  if (!forceReanalyze) {
    query += ` AND json_extract(metadata, '$.aiSummary') IS NULL`;
  }

  query += ` ORDER BY created_at DESC`;

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const posts = db.prepare(query).all() as Array<{
    id: string;
    content: string;
    metadata: string;
    created_at: string;
  }>;

  console.log(`Found ${posts.length} URL posts to analyze\n`);

  if (posts.length === 0) {
    console.log('No URL posts need analysis');
    process.exit(0);
  }

  // Count posts with images for cost estimate
  let postsWithImages = 0;
  for (const post of posts) {
    const metadata = JSON.parse(post.metadata || '{}');
    if (metadata.ogImageLocal && (metadata.platform === 'youtube' || metadata.platform === 'reddit')) {
      postsWithImages++;
    }
  }

  const textCost = posts.length * (
    (AVG_INPUT_TOKENS / 1000) * COST_PER_1K_INPUT_TEXT +
    (AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT_TEXT
  );
  const imageCost = postsWithImages * (
    (AVG_IMAGE_TOKENS / 1000) * COST_PER_1K_INPUT_VISION +
    (AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT_VISION
  );
  console.log(`Estimated cost: ~$${(textCost + imageCost).toFixed(4)} (${posts.length} URLs, ${postsWithImages} with image analysis)\n`);

  if (dryRun) {
    console.log('DRY RUN - Would process these URLs:');
    for (const post of posts.slice(0, 10)) {
      const metadata = JSON.parse(post.metadata || '{}');
      const hasImage = metadata.ogImageLocal && (metadata.platform === 'youtube' || metadata.platform === 'reddit');
      console.log(`  [${post.id.slice(0, 8)}] ${post.content.slice(0, 50)}${hasImage ? ' [+image]' : ''}`);
    }
    if (posts.length > 10) {
      console.log(`  ... and ${posts.length - 10} more`);
    }
    process.exit(0);
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  const processPost = async (post: typeof posts[0]) => {
    const metadata = JSON.parse(post.metadata || '{}');
    const url = post.content;

    console.log(`[${post.id.slice(0, 8)}] Analyzing: ${url.slice(0, 60)}...`);

    try {
      // Analyze URL metadata with AI
      const analysis = await analyzeUrl(
        metadata.title || '',
        metadata.description || '',
        url
      );

      let imageAnalysis: { ocrText?: string; description?: string; tags?: string[] } = {};

      // For YouTube/Reddit: also analyze the cached thumbnail
      const platform = metadata.platform;
      if ((platform === 'youtube' || platform === 'reddit') && metadata.ogImageLocal) {
        // Find the image file
        let imagePath: string | null = null;
        const now = new Date();
        for (let i = 0; i < 24; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = d.getFullYear().toString();
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          const testPath = join(CONFIG.UPLOADS_PATH, year, month, metadata.ogImageLocal);
          if (existsSync(testPath)) {
            imagePath = testPath;
            break;
          }
        }

        if (imagePath) {
          console.log(`   Analyzing ${platform} thumbnail...`);
          try {
            imageAnalysis = await analyzeImage(imagePath);
          } catch (imgErr) {
            console.log(`   Image analysis failed: ${(imgErr as Error).message}`);
          }
        }
      }

      // Merge tags
      const allTags = new Set<string>();
      if (analysis.tags?.length) {
        analysis.tags.forEach(t => allTags.add(t));
      }
      if (imageAnalysis.tags?.length) {
        imageAnalysis.tags.forEach(t => allTags.add(t));
      }

      if (!analysis.summary && !allTags.size && !imageAnalysis.ocrText) {
        console.log(`   Skipped - no analysis results`);
        skipped++;
        return;
      }

      // Update metadata
      const newMetadata = {
        ...metadata,
        aiSummary: analysis.summary || undefined,
        ocrText: imageAnalysis.ocrText || undefined,
        aiDescription: imageAnalysis.description || undefined,
      };

      const updateStmt = db.prepare(`
        UPDATE posts 
        SET metadata = ?
        WHERE id = ?
      `);
      updateStmt.run(JSON.stringify(newMetadata), post.id);

      // Add AI-suggested tags
      for (const tagName of allTags) {
        try {
          const existingTag = db.prepare(`
            SELECT id FROM tags WHERE post_id = ? AND name = ?
          `).get(post.id, tagName.toLowerCase());

          if (!existingTag) {
            tagsService.create({
              post_id: post.id,
              name: tagName,
              is_ai_suggested: true,
            });
          }
        } catch (err) {
          // Ignore duplicate tag errors
        }
      }

      console.log(`   Done - Summary: ${analysis.summary ? 'yes' : 'no'}, Tags: ${allTags.size}, OCR: ${imageAnalysis.ocrText ? 'yes' : 'no'}`);
      processed++;

    } catch (error) {
      console.log(`   Failed: ${(error as Error).message}`);
      failed++;
    }
  };

  await processBatch(posts, processPost, batchSize);

  console.log('\n========================');
  console.log('Summary:');
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Failed:    ${failed}`);
  console.log('========================');
}

main().catch(console.error);
