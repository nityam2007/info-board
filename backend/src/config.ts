import { config } from 'dotenv';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
config({ path: join(projectRoot, '.env') });

// Ensure data directory exists
const dataDir = join(projectRoot, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = join(dataDir, 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

console.log('Data directory:', dataDir);
console.log('Uploads directory:', uploadsDir);

export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  SQLITE_PATH: process.env.SQLITE_PATH || join(dataDir, 'posts.db'),
  DUCKDB_PATH: process.env.DUCKDB_PATH || join(dataDir, 'analytics.duckdb'),
  
  // Uploads
  UPLOADS_PATH: uploadsDir,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB

  // AI
  AI_ENABLED: process.env.AI_ENABLED === 'true',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  // Security
  PASSWORD: process.env.PASSWORD || '',
} as const;

// Validate required config
export function validateConfig(): void {
  if (CONFIG.NODE_ENV === 'production' && !CONFIG.PASSWORD) {
    console.warn('WARNING: No PASSWORD set in production!');
  }
}
