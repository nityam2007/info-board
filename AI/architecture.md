# Architecture

> Single source of truth for system design. AI must follow, not redesign.

## Overview

```
┌─────────────────────────────────────────────────────┐
│                    Client (Svelte)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Input Home  │  │ Inf. Canvas │  │  AI Chat    │  │
│  │ (capture)   │  │ (browse)    │  │  (search)   │  │
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
                            │  (GPT-OSS-20B)  │
                            │  - tagging      │
                            │  - chat         │
                            └─────────────────┘
```

## Pages/Views

1. **Input Home** - Black screen, single input box, capture + quick search (type `/` or `?` prefix)
2. **Infinite Canvas** - Flat pinboard-style masonry, pan/zoom/keyboard spatial exploration, search = teleport
3. **AI Chat** - Conversational search using user's data with source references

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
    ├── url?: string (for URL posts)
    ├── title?: string (extracted)
    └── description?: string (extracted)

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
