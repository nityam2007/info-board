# Info Board

> A personal, visual information system where you dump everything and find it later without effort.

## Overview

- **Input Home** - Minimal dark screen, single input box, capture only
- **3D Globe Canvas** - Posts scattered on spherical surface, pan/zoom/fly navigation
- **AI Chat** - Conversational search using your data with source references
- **Admin Panel** - Manage posts, tags, trash, system (password protected)

## Philosophy

- **Capture first, organize later** - no cognitive load at input time
- **Visual memory** - spatial recall on 3D globe beats text lists
- **Search = Navigation** - teleports to card on globe, doesn't filter to list
- **Content IS the interface** - no menus, no chrome
- **Your data, your server** - self-hosted, single user

## Features

### Capture
- Text, images, audio, video, URLs, files
- Drag & drop anywhere on home screen
- Clipboard paste (images or text)
- URL metadata auto-extraction (title, description, OG images)
- YouTube/Reddit enhanced metadata

### AI Analysis (Groq-powered)
- Image OCR and description
- Auto-tagging for all content types
- Audio transcription
- URL summarization
- Conversational search in AI Chat

### Canvas Navigation
- 3D Globe effect - posts on spherical surface
- Search teleport - Enter cycles through results
- Keyboard shortcuts - WASD/arrows, +/-, /, H, C
- Touch support - pinch zoom, drag pan
- Smooth fly-to animations

### Post Detail Modal
- Wide 2-column layout (40/60) for media
- Read-only tags (edit in Admin)
- Selectable text
- AI metadata display (description, OCR, summary, transcription)
- Download button for files

### Admin Panel
- Password protected
- Posts: search, filter, edit, soft delete, hard delete
- Trash: restore or permanently delete
- Tags: rename, merge, delete
- System: stats, database optimize

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start development (both backend + frontend)
pnpm dev

# Or start individually
pnpm dev:backend   # http://localhost:3000
pnpm dev:frontend  # http://localhost:5173
```

## Project Structure

```
/
├── package.json           # Root monorepo config
├── pnpm-workspace.yaml    # Workspace definition
├── .env.example           # Environment template
├── CHANGELOG.md           # Project change log (append-only)
├── LICENSE                # Proprietary license
│
├── backend/               # Express.js API server
│   ├── src/
│   │   ├── index.ts       # Server entry point
│   │   ├── config.ts      # Environment config
│   │   ├── types.ts       # TypeScript types
│   │   ├── db/            # Database layer (SQLite + DuckDB)
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API endpoints
│   │   └── scripts/       # AI analysis scripts
│   └── package.json
│
├── frontend/              # Svelte 5 + Vite app
│   ├── src/
│   │   ├── main.ts        # App entry
│   │   ├── App.svelte     # Root component
│   │   ├── lib/           # Utilities, API client
│   │   ├── components/    # Reusable components
│   │   │   └── PostDetail.svelte  # Read-only post modal
│   │   └── views/         # Page components
│   │       ├── InputHome.svelte  # Capture (~350 lines)
│   │       ├── Canvas.svelte     # 3D Globe (~1640 lines)
│   │       ├── AIChat.svelte     # Chat (~500 lines)
│   │       └── Admin.svelte      # Admin panel (~900 lines)
│   └── package.json
│
├── AI/                    # AI workflow configuration
│   ├── claude.md          # Claude's persistent memory
│   ├── architecture.md    # System design
│   ├── agents.md          # Domain patterns
│   ├── mistakes.md        # Errors to avoid
│   └── ...
│
├── 3rd-party/             # External integrations
│   ├── mobile/            # Capacitor Android/iOS app
│   └── chrome/            # Browser extension
│
└── data/                  # Runtime data (gitignored)
    ├── posts.db           # SQLite database
    ├── analytics.duckdb   # DuckDB for search
    └── uploads/           # File storage (YYYY/MM/)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Express.js + Node 20 + TypeScript |
| Database | SQLite (transactional) + DuckDB (FTS/analytics) |
| Frontend | Svelte 5 (runes) + Vite + TypeScript |
| Rendering | DOM tiles with CSS 3D transforms |
| AI | Groq API (llama-4-scout vision, gpt-oss-20b text, whisper audio) |
| Uploads | File storage in `data/uploads/YYYY/MM/` |

## Four Views

| View | Purpose | Search |
|------|---------|--------|
| **InputHome** | Capture content | Press `/` goes to Canvas |
| **Canvas** | Browse on 3D globe | Enter teleports through results |
| **AIChat** | Conversational search | Via AI responses |
| **Admin** | Content management | Built-in search + filters |

## Canvas Controls

### Globe Effect

Cards are projected onto a virtual 3D sphere:
- **Center**: Full size, no rotation
- **Edges**: Shrink to 40-50%, tilt up to 35-45°
- **Zoom range**: 60% - 250%
- **Sphere fills**: 80% of viewport

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **W/A/S/D** or **Arrows** | Pan canvas |
| **+/-** | Zoom in/out |
| **0** or **Home** | Reset view |
| **/** | Focus search box |
| **Enter** (in search) | Teleport to next result |
| **Arrow Up/Down** (in search) | Cycle through results |
| **H** | Go to Home |
| **C** | Go to AI Chat |
| **Esc** | Close modal / clear search |
| **?** | Toggle help overlay |

### Mouse

| Action | Effect |
|--------|--------|
| **Drag** | Pan canvas |
| **Scroll wheel** | Zoom toward cursor |
| **Click empty space** | Fly to location |
| **Click card** | Open post detail |

### Touch

| Gesture | Effect |
|---------|--------|
| **Drag** | Pan canvas |
| **Pinch** | Zoom in/out |
| **Tap card** | Open post |

## Post Detail Modal

Wide 2-column layout for posts with media:

```
┌──────────────────────────────────────────────────────┐
│ IMAGE - Jan 29, 2026                      [Copy] [X] │
├──────────────────────┬───────────────────────────────┤
│                      │  filename.jpg                  │
│    [IMAGE PREVIEW]   │  image/jpeg                    │
│        40%           │  ────────────────────────────  │
│                      │  AI Analysis                   │
│                      │  Tags: [tag1] [tag2] [ai-tag]  │
│                      │  via web                       │
└──────────────────────┴───────────────────────────────┘
```

- **Read-only** - No tag editing (use Admin panel)
- **Selectable text** - Copy any content
- **Working buttons** - Copy, close, open URL, download

## AI Analysis Scripts

Run AI analysis on existing posts:

```bash
cd backend

# Dry run to see what would be processed
npx tsx src/scripts/analyze-all.ts --dry-run

# Process with cost estimate
npx tsx src/scripts/analyze-all.ts --limit 10

# Force re-analyze everything
npx tsx src/scripts/analyze-all.ts --force

# Individual scripts
npx tsx src/scripts/analyze-images.ts
npx tsx src/scripts/analyze-text.ts
npx tsx src/scripts/analyze-urls.ts
npx tsx src/scripts/analyze-audio.ts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/posts` | Create post |
| GET | `/api/posts` | List posts |
| GET | `/api/posts/:id` | Get post with tags |
| GET | `/api/posts/stats` | Dashboard stats |
| DELETE | `/api/posts/:id` | Soft delete post |
| POST | `/api/upload` | Upload file (base64) |
| POST | `/api/upload/url` | Upload URL with metadata |
| GET | `/api/upload/file/:year/:month/:filename` | Serve file |
| GET | `/api/search?q=` | Full-text search |
| POST | `/api/tags` | Add tag to post |
| DELETE | `/api/tags/:id` | Remove tag |
| POST | `/api/ai/suggest` | AI suggestions |
| POST | `/api/ai/chat` | AI chat query |
| GET | `/api/admin/*` | Admin endpoints (auth required) |

## Supported Content Types

| Type | Examples |
|------|----------|
| text | Notes, thoughts, code snippets |
| image | PNG, JPG, GIF, WebP, SVG, AVIF |
| audio | MP3, WAV, OGG, FLAC |
| video | MP4, WebM, MOV |
| url | Any HTTP/HTTPS link |
| file | PDF, ZIP, JSON, etc. |

## Environment Variables

```env
PORT=3000
SQLITE_PATH=./data/posts.db
DUCKDB_PATH=./data/analytics.duckdb
AI_ENABLED=true
GROQ_API_KEY=your-key
PASSWORD=your-password
ADMIN_PASSWORD=optional-separate-admin-password
```

## AI Workflow

This project uses an MD-based AI workflow. See [AI/](AI/) for details.

**Key Rule:** CHANGELOG.md is append-only and updated at end of every query.

## License

**Proprietary** - Source viewable for evaluation only. See [LICENSE](LICENSE) for details.
