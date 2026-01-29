import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { CONFIG, validateConfig } from './config.js';
import { initDatabase, closeDatabase } from './db/sqlite.js';
import { initDuckDB, closeDuckDB } from './db/duckdb.js';
import { postsRouter } from './routes/posts.js';
import { tagsRouter } from './routes/tags.js';
import { tasksRouter } from './routes/tasks.js';
import { searchRouter } from './routes/search.js';
import { aiRouter } from './routes/ai.js';
import { uploadRouter } from './routes/upload.js';
import { adminRouter } from './routes/admin.js';
import exportRouter from './routes/export.js';

// Validate config on startup
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Support large file uploads
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (auth disabled for now)
app.use('/api/posts', postsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);
app.use('/api/export', exportRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  closeDatabase();
  await closeDuckDB();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
  try {
    // Initialize databases
    initDatabase();
    console.log('✓ SQLite initialized');
    
    await initDuckDB();
    console.log('✓ DuckDB initialized');

    app.listen(CONFIG.PORT, () => {
      console.log(`✓ Server running on http://localhost:${CONFIG.PORT}`);
      console.log(`  Environment: ${CONFIG.NODE_ENV}`);
      console.log(`  AI Enabled: ${CONFIG.AI_ENABLED}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
