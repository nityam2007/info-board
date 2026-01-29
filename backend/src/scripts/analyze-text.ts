/**
 * Script to analyze existing text posts with AI (tags + summary)
 * 
 * Usage: npx tsx src/scripts/analyze-text.ts [--force] [--limit N] [--batch N] [--dry-run]
 * 
 * Options:
 *   --force   Re-analyze texts that already have AI metadata
 *   --limit N Only process N posts (for testing)
 *   --batch N Process N posts in parallel (default: 3)
 *   --dry-run Show what would be analyzed without making changes
 */

import { getDatabase, initDatabase } from '../db/sqlite.js';
import { analyzeText } from '../services/ai.js';
import { tagsService } from '../services/tags.js';
import { CONFIG } from '../config.js';

// Cost estimates (Groq pricing approximations)
const COST_PER_1K_INPUT = 0.00005;  // $0.05 per 1M tokens
const COST_PER_1K_OUTPUT = 0.00010; // $0.10 per 1M tokens
const AVG_INPUT_TOKENS = 500;  // Average text post size
const AVG_OUTPUT_TOKENS = 100; // Tags + summary response

// Parse CLI args
const args = process.argv.slice(2);
const forceReanalyze = args.includes('--force');
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;
const batchIndex = args.indexOf('--batch');
const batchSize = batchIndex !== -1 ? parseInt(args[batchIndex + 1]) : 3;

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    // Small delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}

async function main() {
  console.log('TEXT ANALYSIS SCRIPT');
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

  // Get all text posts
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'text' 
      AND deleted_at IS NULL
      AND content IS NOT NULL
      AND length(content) > 10
  `;

  if (!forceReanalyze) {
    // Skip texts that already have AI analysis
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

  console.log(`Found ${posts.length} text posts to analyze\n`);

  if (posts.length === 0) {
    console.log('No text posts need analysis');
    process.exit(0);
  }

  // Cost estimate
  const estimatedCost = posts.length * (
    (AVG_INPUT_TOKENS / 1000) * COST_PER_1K_INPUT +
    (AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT
  );
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(4)}\n`);

  if (dryRun) {
    console.log('DRY RUN - Would process these posts:');
    for (const post of posts.slice(0, 10)) {
      console.log(`  [${post.id.slice(0, 8)}] ${post.content.slice(0, 50)}...`);
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
    const preview = post.content.slice(0, 40).replace(/\n/g, ' ');

    console.log(`[${post.id.slice(0, 8)}] Analyzing: "${preview}..."`);

    try {
      const analysis = await analyzeText(post.content);

      if (!analysis.summary && !analysis.tags?.length) {
        console.log(`   Skipped - no analysis results`);
        skipped++;
        return;
      }

      // Update metadata
      const newMetadata = {
        ...metadata,
        aiSummary: analysis.summary || undefined,
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

      console.log(`   Done - Summary: ${analysis.summary ? 'yes' : 'no'}, Tags: ${analysis.tags?.length || 0}`);
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
