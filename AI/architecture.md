# Architecture

> Single source of truth for system design. AI must follow, not redesign.

## Overview

```
┌─────────────────────────────────────────────────────┐
│                    Client (Svelte 5)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Input Home  │  │ 3D Globe    │  │  AI Chat    │  │
│  │ (capture)   │  │ Canvas      │  │  (search)   │  │
│  │ NO search   │  │ (browse)    │  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Express.js API (Node 20)               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │Posts │ │Search│ │Tasks │ │Tags  │ │AI Suggest│  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘  │
└─────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│     SQLite      │           │     DuckDB      │
│  (transactional)│           │   (analytics)   │
│  - posts        │           │   - FTS index   │
│  - metadata     │           │   - search      │
│  - settings     │           │   - aggregations│
└─────────────────┘           └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │   Groq API      │
                            │ (llama-3.1-70b) │
                            │  - tagging      │
                            │  - chat         │
                            └─────────────────┘
```

## Pages/Views

| View | Purpose | Features |
|------|---------|----------|
| **Input Home** | Capture content | Minimal dark UI, single input, drag/drop, paste. NO search. Press `/` → Canvas |
| **3D Globe Canvas** | Browse posts | Spherical projection, pan/zoom/fly, search teleport, 60% min zoom |
| **AI Chat** | Conversational search | Chat interface with source references |

## Globe Canvas Details

- **Sphere projection**: Cards shrink/tilt toward edges like on a ball surface
- **Zoom range**: 60% - 250% (MIN_ZOOM = 0.6, MAX_ZOOM = 2.5)
- **Sphere radius**: 80% of viewport (fills most of screen)
- **Center zone**: 30% radius at full size, then cosine falloff
- **Edge scale**: Minimum 40-50% size (still readable)
- **Max tilt**: 35-45° at edges
- **Search**: Enter key cycles through results (teleport), click opens post

## Data Model

```
Post (immutable)
├── id: uuid
├── content: blob (text/image/audio/video/url/file)
├── contentType: 'text' | 'image' | 'audio' | 'video' | 'url' | 'file'
├── source: 'manual' | 'clipboard' | 'upload' | 'api' | 'extension'
├── createdAt: timestamp
├── deletedAt: timestamp? (soft delete)
└── metadata: json
    ├── filename?: string
    ├── originalName?: string
    ├── mimeType?: string
    ├── size?: number
    ├── width?: number (images)
    ├── height?: number (images)
    ├── url?: string (for URL posts)
    ├── title?: string (extracted)
    ├── description?: string (extracted)
    ├── ogImage?: string (OG image URL)
    └── ogImageLocal?: string (cached OG image)

Tag (reference)
├── id: uuid
├── postId: uuid (FK)
├── name: string
├── isAISuggested: boolean
└── createdAt: timestamp

Task (reference)
├── id: uuid
├── postId: uuid (FK)
├── description: string
├── dueDate: timestamp?
├── completed: boolean
└── createdAt: timestamp
```

## API Endpoints

```
POST   /api/posts          - Create post (capture)
GET    /api/posts          - List posts (with filters)
GET    /api/posts/:id      - Get single post
GET    /api/posts/stats    - Get dashboard stats (total, streak, by type)
DELETE /api/posts/:id      - Soft delete post

POST   /api/upload         - Upload file (base64)
POST   /api/upload/url     - Upload URL with metadata extraction
GET    /api/upload/file/:year/:month/:filename - Serve uploaded files

GET    /api/search?q=      - Full-text search (DuckDB FTS)

POST   /api/tags           - Add tag to post
DELETE /api/tags/:id       - Remove tag

POST   /api/tasks          - Create task from post
PATCH  /api/tasks/:id      - Update task status
DELETE /api/tasks/:id      - Delete task

POST   /api/ai/suggest     - Get AI suggestions (tags/tasks)
POST   /api/ai/suggest/:id - Get suggestions for existing post
POST   /api/ai/chat        - AI chat query
```

## Environment Config

```env
PORT=3000
SQLITE_PATH=./data/posts.db
DUCKDB_PATH=./data/analytics.duckdb
AI_ENABLED=true
GROQ_API_KEY=your-key
PASSWORD=your-password
```

## AI Isolation Rules

- AI reads from designated context files only
- AI does not have direct DB write access
- AI suggestions go through human review
- All AI features behind env toggle
