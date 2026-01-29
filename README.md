# Info Board

> A personal, visual information system where you dump everything and find it later without effort.

## Overview

- **Input Home** - Minimal dark screen, single input box, capture only
- **3D Globe Canvas** - Posts scattered on spherical surface, pan/zoom/fly navigation
- **AI Chat** - Conversational search using your data with source references

## Philosophy

- **Capture first, organize later** - no cognitive load at input time
- **Visual memory** - spatial recall on 3D globe beats text lists
- **Search = Navigation** - teleports to card on globe, doesn't filter to list
- **Content IS the interface** - no menus, no chrome
- **Your data, your server** - self-hosted, single user

## Features

- Capture anything - Text, images, audio, video, URLs, files
- Drag & drop - Drop files anywhere on the home screen
- Clipboard paste - Paste images or text directly
- URL metadata - Auto-extracts title, description, and OG images
- 3D Globe effect - Posts feel like they're on a sphere surface
- Search teleport - Enter cycles through results, camera flies to card
- Keyboard shortcuts - WASD/arrows to pan, +/- zoom, / for search
- Touch support - Pinch to zoom, drag to pan
- AI tagging - Groq AI suggests tags and tasks
- AI Chat - Conversational search with source references
- Smooth animations - Fly-to, momentum scrolling, pulsing highlights

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
├── frontend/              # Svelte 5 + Vite app
│   ├── src/
│   │   ├── main.ts        # App entry
│   │   ├── App.svelte     # Root component
│   │   ├── lib/           # Utilities, API client
│   │   └── views/         # Page components
│   │       ├── InputHome.svelte  # Capture (~350 lines)
│   │       ├── Canvas.svelte     # 3D Globe (~1640 lines)
│   │       └── AIChat.svelte     # Chat (~500 lines)
│   └── package.json
│
├── AI/                    # AI workflow configuration
│   ├── claude.md          # Claude's persistent memory
│   ├── architecture.md    # System design
│   ├── agents.md          # Domain patterns
│   ├── mistakes.md        # Errors to avoid
│   └── ...
│
└── 3rd-party/             # External integrations
    ├── mobile/            # Android share intent app (planned)
    └── chrome/            # Browser extension (planned)
```

## Tech Stack

- **Backend**: Express.js + Node 20 + SQLite + DuckDB (FTS)
- **Frontend**: Svelte 5 (runes) + Vite + DOM tiles with CSS 3D transforms
- **Database**: SQLite (transactional) + DuckDB (analytics/search)
- **AI**: Groq API (llama-3.1-70b-versatile, toggleable via .env)
- **Uploads**: File storage in `data/uploads/YYYY/MM/`

## Three Views

| View | Purpose | Search |
|------|---------|--------|
| **InputHome** | Capture content | Press `/` goes to Canvas |
| **Canvas** | Browse on 3D globe | Enter teleports through results |
| **AIChat** | Conversational search | Via AI responses |

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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/posts` | Create post |
| GET | `/api/posts` | List posts |
| GET | `/api/posts/:id` | Get post with tags/tasks |
| GET | `/api/posts/stats` | Get dashboard stats |
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

## Supported Content Types

| Type | Icon | Examples |
|------|------|----------|
| text | Notes | Notes, thoughts, code snippets |
| image | Images | PNG, JPG, GIF, WebP, SVG |
| audio | Audio | MP3, WAV, OGG, FLAC |
| video | Video | MP4, WebM, MOV |
| url | Links | Any HTTP/HTTPS link |
| file | Files | PDF, ZIP, JSON, etc. |

## AI Workflow

This project uses an MD-based AI workflow. See [AI/](AI/) for details.

**Key Rule:** CHANGELOG.md is append-only and updated at end of every query.

## License

MIT
