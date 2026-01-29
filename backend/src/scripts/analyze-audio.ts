/**
 * Script to analyze existing audio posts with AI (transcription + tags + summary)
 * 
 * Usage: npx tsx src/scripts/analyze-audio.ts [--force] [--limit N] [--batch N] [--dry-run]
 * 
 * Options:
 *   --force   Re-analyze audio that already has transcription
 *   --limit N Only process N posts (for testing)
 *   --batch N Process N posts in parallel (default: 2, audio is slow)
 *   --dry-run Show what would be analyzed without making changes
 */

import { getDatabase, initDatabase } from '../db/sqlite.js';
import { analyzeAudio } from '../services/ai.js';
import { tagsService } from '../services/tags.js';
import { CONFIG } from '../config.js';
import { join } from 'path';
import { existsSync, statSync } from 'fs';

// Cost estimates (Groq Whisper pricing)
const COST_PER_MINUTE_AUDIO = 0.00006;  // $0.06 per 1000 minutes
const COST_PER_1K_INPUT_TEXT = 0.00005;
const COST_PER_1K_OUTPUT_TEXT = 0.00010;
const AVG_AUDIO_MINUTES = 2;
const AVG_TRANSCRIPTION_TOKENS = 300;
const AVG_OUTPUT_TOKENS = 100;

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
      await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay for audio
    }
  }
}

async function main() {
  console.log('AUDIO ANALYSIS SCRIPT');
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

  // Get all audio posts
  let query = `
    SELECT id, content, metadata, created_at 
    FROM posts 
    WHERE content_type = 'audio' 
      AND deleted_at IS NULL
  `;

  if (!forceReanalyze) {
    query += ` AND json_extract(metadata, '$.transcription') IS NULL`;
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

  console.log(`Found ${posts.length} audio posts to analyze\n`);

  if (posts.length === 0) {
    console.log('No audio posts need analysis');
    process.exit(0);
  }

  // Cost estimate
  const audioCost = posts.length * AVG_AUDIO_MINUTES * COST_PER_MINUTE_AUDIO;
  const textCost = posts.length * (
    (AVG_TRANSCRIPTION_TOKENS / 1000) * COST_PER_1K_INPUT_TEXT +
    (AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT_TEXT
  );
  console.log(`Estimated cost: ~$${(audioCost + textCost).toFixed(4)} (assuming ~${AVG_AUDIO_MINUTES}min avg)\n`);

  if (dryRun) {
    console.log('DRY RUN - Would process these audio files:');
    for (const post of posts.slice(0, 10)) {
      const metadata = JSON.parse(post.metadata || '{}');
      console.log(`  [${post.id.slice(0, 8)}] ${metadata.originalName || post.content}`);
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

    console.log(`[${post.id.slice(0, 8)}] Analyzing: ${metadata.originalName || filename}`);

    // Find the audio file
    let audioPath: string | null = null;
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear().toString();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const testPath = join(CONFIG.UPLOADS_PATH, year, month, filename);
      if (existsSync(testPath)) {
        audioPath = testPath;
        break;
      }
    }

    if (!audioPath) {
      console.log(`   Skipped - file not found: ${filename}`);
      skipped++;
      return;
    }

    // Get file size for info
    const stats = statSync(audioPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   File size: ${sizeMB}MB`);

    try {
      const analysis = await analyzeAudio(audioPath);

      if (!analysis.transcription) {
        console.log(`   Skipped - no transcription`);
        skipped++;
        return;
      }

      // Update metadata
      const newMetadata = {
        ...metadata,
        transcription: analysis.transcription,
        aiSummary: analysis.summary || undefined,
      };

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

      const transcriptPreview = analysis.transcription.slice(0, 60).replace(/\n/g, ' ');
      console.log(`   Done - "${transcriptPreview}..." Tags: ${analysis.tags?.length || 0}`);
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
