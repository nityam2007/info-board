# Info Board

> A personal, visual information system where you dump everything and find it later without effort.

## Overview

- **Input Home** - Black screen, single input box, capture + quick search (type `/` or `?`)
- **Infinite Canvas** - Pinboard-style masonry, pan/zoom/keyboard navigation
- **AI Chat** - Conversational search using your data with source references

## Philosophy

- **Capture first, organize later** - no cognitive load at input time
- **Visual memory** - spatial recall beats text lists
- **Search = Navigation** - teleports to region, doesn't filter
- **Content IS the interface** - no menus, no chrome
- **Your data, your server** - self-hosted, single user

## Features

- 📝 **Capture anything** - Text, images, audio, video, URLs, files
- 🖱️ **Drag & drop** - Drop files anywhere on the home screen
- 📋 **Clipboard paste** - Paste images or text directly
- 🔗 **URL metadata** - Auto-extracts title and description from URLs
- 🔍 **Search teleport** - Search finds and teleports to matching content
- ⌨️ **Keyboard shortcuts** - WASD/arrows to pan, +/- zoom, ? for help
- 🖐️ **Touch support** - Pinch to zoom, drag to pan
- 🏷️ **AI tagging** - Groq AI suggests tags and tasks
- 💬 **AI Chat** - Conversational search with source references
- 🎨 **Infinite canvas** - Pinboard-style masonry, pan/zoom anywhere
- 📐 **Smart sizing** - Image tiles use real aspect ratios
- 🔀 **Random layout** - Posts shuffled for variety each load

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
│
├── backend/               # Express.js API server
│   ├── src/
│   │   ├── index.ts       # Server entry point
│   │   ├── config.ts      # Environment config
│   │   ├── types.ts       # TypeScript types
│   │   ├── db/            # Database layer
│   │   ├── services/      # Business logic
│   │   └── routes/        # API endpoints
│   └── package.json
│
├── frontend/              # Svelte + Vite app
│   ├── src/
│   │   ├── main.ts        # App entry
│   │   ├── App.svelte     # Root component
│   │   ├── lib/           # Utilities
│   │   └── views/         # Page components
│   └── package.json
│
└── AI/                    # AI workflow configuration
    ├── claude.md          # Claude's persistent memory
    ├── rules.md           # Engineering standards
    ├── architecture.md    # System design
    └── ...
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/posts` | Create post |
| GET | `/api/posts` | List posts |
| GET | `/api/posts/:id` | Get post with tags/tasks |
| DELETE | `/api/posts/:id` | Soft delete post |
| POST | `/api/upload` | Upload file (base64) |
| POST | `/api/upload/url` | Upload URL with metadata |
| GET | `/api/upload/file/:year/:month/:filename` | Serve uploaded file |
| GET | `/api/search?q=` | Full-text search |
| POST | `/api/tags` | Add tag to post |
| DELETE | `/api/tags/:id` | Remove tag |
| POST | `/api/tasks` | Create task from post |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/ai/suggest` | AI tag/task suggestions |
| POST | `/api/ai/suggest/:id` | AI suggestions for post |
| POST | `/api/ai/chat` | AI chat query |

## Tech Stack

- **Backend**: Express.js + Node 20 + SQLite + DuckDB (FTS)
- **Frontend**: Svelte 5 (runes) + Vite + DOM-based infinite board
- **Database**: SQLite (transactional) + DuckDB (analytics/search)
- **AI**: Groq API (openai/gpt-oss-20b, toggleable via .env)
- **Uploads**: File storage in `data/uploads/YYYY/MM/`

## Canvas Controls

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **W/A/S/D** or **Arrows** | Pan canvas |
| **+/-** | Zoom in/out |
| **1-5** | Quick zoom levels (30%, 60%, 100%, 150%, 200%) |
| **Home** or **0** | Reset view |
| **R** | Random teleport to a post |
| **/** | Focus search box |
| **Esc** | Close modal/help |
| **?** | Toggle help overlay |

### Mouse

| Action | Effect |
|--------|--------|
| **Drag** | Pan canvas (from anywhere) |
| **Scroll wheel** | Zoom toward cursor |
| **Double-click** | Toggle zoom (1x ↔ 1.5x) |
| **Click tile** | Open post detail |

### Touch

| Gesture | Effect |
|---------|--------|
| **Drag** | Pan canvas |
| **Pinch** | Zoom in/out |
| **Tap** | Open post |

## Supported Content Types

| Type | Icon | Examples |
|------|------|----------|
| text | 📝 | Notes, thoughts, code snippets |
| image | 🖼️ | PNG, JPG, GIF, WebP, SVG |
| audio | 🎵 | MP3, WAV, OGG, FLAC |
| video | 🎬 | MP4, WebM, MOV |
| url | 🔗 | Any HTTP/HTTPS link |
| file | 📎 | PDF, ZIP, JSON, etc. |

## AI Workflow

This project uses an MD-based AI workflow. See [AI/](AI/) for details.

**Key Rule:** CHANGELOG.md is append-only and updated at end of every query.

## License

MIT
