/**
 * Script to analyze existing images with AI (OCR + description + tags)
 * 
 * Usage: npx tsx src/scripts/analyze-images.ts [--force] [--limit N] [--batch N] [--dry-run]
 * 
 * Options:
 *   --force   Re-analyze images that already have AI metadata
 *   --limit N Only process N images (for testing)
 *   --batch N Process N images in parallel (default: 2)
 *   --dry-run Show what would be analyzed without making changes
 */

import { getDatabase, initDatabase } from '../db/sqlite.js';
import { analyzeImage } from '../services/ai.js';
import { tagsService } from '../services/tags.js';
import { CONFIG } from '../config.js';
import { join } from 'path';
import { existsSync } from 'fs';

// Cost estimates (Groq vision pricing approximations)
const COST_PER_1K_INPUT_VISION = 0.00010;  // Vision is ~2x text
const COST_PER_1K_OUTPUT_VISION = 0.00020;
const AVG_IMAGE_TOKENS = 1000;  // Image analysis uses more tokens
const AVG_OUTPUT_TOKENS = 150;  // OCR + description + tags

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
    // Delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function main() {
  console.log('IMAGE ANALYSIS SCRIPT');
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

  // Initialize database
  initDatabase();
  const db = getDatabase();

  // Get all image posts
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'image' 
      AND deleted_at IS NULL
  `;

  if (!forceReanalyze) {
    // Skip images that already have AI analysis
    query += ` AND (
      json_extract(metadata, '$.ocrText') IS NULL 
      AND json_extract(metadata, '$.aiDescription') IS NULL
    )`;
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

  console.log(`Found ${posts.length} images to analyze\n`);

  if (posts.length === 0) {
    console.log('No images need analysis');
    process.exit(0);
  }

  // Cost estimate
  const estimatedCost = posts.length * (
    (AVG_IMAGE_TOKENS / 1000) * COST_PER_1K_INPUT_VISION +
    (AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT_VISION
  );
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(4)}\n`);

  if (dryRun) {
    console.log('DRY RUN - Would process these images:');
    for (const post of posts.slice(0, 10)) {
      const metadata = JSON.parse(post.metadata || '{}');
      console.log(`  [${post.id.slice(0, 8)}] ${metadata.filename || post.content}`);
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
    const filename = metadata.filename || post.content;
    
    // Build file path - search recent months for the file
    let imagePath: string | null = null;
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear().toString();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const testPath = join(CONFIG.UPLOADS_PATH, year, month, filename);
      if (existsSync(testPath)) {
        imagePath = testPath;
        break;
      }
    }

    if (!imagePath) {
      console.log(`[${post.id.slice(0, 8)}] Skipped - file not found: ${filename}`);
      skipped++;
      return;
    }

    console.log(`[${post.id.slice(0, 8)}] Analyzing: ${filename}`);

    try {
      // Analyze the image
      const analysis = await analyzeImage(imagePath);

      if (!analysis.description && !analysis.ocrText) {
        console.log(`   Skipped - no analysis results`);
        skipped++;
        return;
      }

      // Update metadata
      const newMetadata = {
        ...metadata,
        ocrText: analysis.ocrText || undefined,
        aiDescription: analysis.description || undefined,
      };

      // Update post in database
      const updateStmt = db.prepare(`
        UPDATE posts 
        SET metadata = ?
        WHERE id = ?
      `);
      updateStmt.run(JSON.stringify(newMetadata), post.id);

      // Add AI-suggested tags
      if (analysis.tags?.length) {
        for (const tagName of analysis.tags) {
          try {
            // Check if tag already exists for this post
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
      }

      console.log(`   Done - OCR: ${analysis.ocrText ? 'yes' : 'no'}, Desc: ${analysis.description ? 'yes' : 'no'}, Tags: ${analysis.tags?.length || 0}`);
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
