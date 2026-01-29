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
│                         │                           │
│                         ▼                           │
│                  ┌─────────────┐                    │
│                  │ PostDetail  │                    │
│                  │  (modal)    │                    │
│                  │ read-only   │                    │
│                  └─────────────┘                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              Admin Panel                     │   │
│  │  Posts | Trash | Tags | System              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Express.js API (Node 20)               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │Posts │ │Search│ │Tasks │ │Tags  │ │AI Suggest│  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │                Admin Routes                   │  │
│  └──────────────────────────────────────────────┘  │
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
                            │ Text: gpt-oss-20b│
                            │ Vision: llama-4 │
                            │ Audio: whisper  │
                            │  - tagging      │
                            │  - chat         │
                            │  - image OCR    │
                            │  - transcription│
                            └─────────────────┘
```

## Pages/Views

| View | Purpose | Features |
|------|---------|----------|
| **Input Home** | Capture content | Minimal dark UI, single input, drag/drop, paste. NO search. Press `/` → Canvas |
| **3D Globe Canvas** | Browse posts | Spherical projection, pan/zoom/fly, search teleport, PostDetail modal |
| **AI Chat** | Conversational search | Chat interface with source references |
| **Admin** | Content management | Password-protected, CRUD, tag management |

## Globe Canvas Details

- **Sphere projection**: Cards shrink/tilt toward edges like on a ball surface
- **Zoom range**: 60% - 250% (MIN_ZOOM = 0.6, MAX_ZOOM = 2.5)
- **Sphere radius**: 80% of viewport (fills most of screen)
- **Center zone**: 30% radius at full size, then cosine falloff
- **Edge scale**: Minimum 40-50% size (still readable)
- **Max tilt**: 35-45° at edges
- **Search**: Enter key cycles through results (teleport), click opens PostDetail

## PostDetail Modal

Wide 2-column layout for media, read-only:

| Type | Layout | Max Width |
|------|--------|-----------|
| Image | 2-col (40/60) | 900px |
| Video | 2-col (40/60) | 900px |
| URL | 2-col (40/60) | 900px |
| Text | 1-col | 520px |
| Audio | 1-col | 520px |
| File | 1-col | 520px |

**Features:**
- Read-only tags (no add/remove - use Admin)
- Selectable text
- Working buttons (copy, close, open URL, download)
- AI metadata display (description, OCR, summary, transcription)
- Mobile responsive (stacks on < 640px)

## Data Model

```
Post (immutable)
├── id: uuid
├── content: blob (text/image/audio/video/url/file)
├── contentType: 'text' | 'image' | 'audio' | 'video' | 'url' | 'file'
├── source: 'manual' | 'clipboard' | 'upload' | 'api' | 'extension' | 'mobile'
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
    ├── ogImageLocal?: string (cached OG image)
    ├── favicon?: string (site favicon)
    ├── siteName?: string (site name)
    ├── author?: string (YouTube/Reddit author)
    ├── platform?: string (youtube/reddit/twitter)
    ├── aiDescription?: string (AI-generated image description)
    ├── ocrText?: string (extracted text from image via OCR)
    ├── aiSummary?: string (AI summary of text/URL/audio)
    └── transcription?: string (audio transcription)

Tag (reference)
├── id: uuid
├── postId: uuid (FK)
├── name: string
├── isAISuggested: boolean (true for AI-generated tags)
└── createdAt: timestamp

Task (its own post type, NOT metadata)
├── id: uuid
├── content: string (task description)
├── contentType: 'task'
├── metadata: json
│   ├── dueDate?: timestamp
│   └── completed: boolean
└── createdAt: timestamp
```

## API Endpoints

```
POST   /api/posts          - Create post (capture)
GET    /api/posts          - List posts (with filters)
GET    /api/posts/:id      - Get single post with tags
GET    /api/posts/stats    - Get dashboard stats (total, streak, by type)
DELETE /api/posts/:id      - Soft delete post

POST   /api/upload         - Upload file (base64)
POST   /api/upload/url     - Upload URL with metadata extraction
GET    /api/upload/file/:year/:month/:filename - Serve uploaded files

GET    /api/search?q=      - Full-text search (DuckDB FTS)

POST   /api/tags           - Add tag to post
DELETE /api/tags/:id       - Remove tag

POST   /api/ai/suggest     - Get AI suggestions (tags/tasks)
POST   /api/ai/suggest/:id - Get suggestions for existing post
POST   /api/ai/chat        - AI chat query

# Admin (password protected)
GET    /api/admin/auth-status - Check if auth required
GET    /api/admin/stats    - Admin statistics
GET    /api/admin/posts    - List with filters (includes deleted)
PUT    /api/admin/posts/:id - Edit post
DELETE /api/admin/posts/:id/hard - Permanent delete
POST   /api/admin/posts/:id/restore - Restore deleted
POST   /api/admin/posts/bulk-* - Bulk operations
GET    /api/admin/tags     - List tags with counts
POST   /api/admin/tags/rename - Rename tag
POST   /api/admin/tags/merge - Merge tags
DELETE /api/admin/tags/name/:name - Delete tag
POST   /api/admin/database/vacuum - Optimize DB
```

## Environment Config

```env
PORT=3000
SQLITE_PATH=./data/posts.db
DUCKDB_PATH=./data/analytics.duckdb
AI_ENABLED=true
GROQ_API_KEY=your-key
PASSWORD=your-password
ADMIN_PASSWORD=optional-separate-admin-password
```

## AI Isolation Rules

- AI reads from designated context files only
- AI does not have direct DB write access
- AI suggestions go through human review
- All AI features behind env toggle
- AI metadata displayed read-only in PostDetail

## Key Component Relationships

```
Canvas.svelte
    ├── renders WorldPost cards
    ├── handles camera/navigation
    ├── handles search teleport
    └── opens PostDetail when card clicked
            │
            ▼
    PostDetail.svelte (modal)
        ├── displays post content
        ├── shows AI metadata (read-only)
        ├── shows tags (read-only)
        └── close returns to Canvas

Admin.svelte (separate view)
    ├── manages posts (edit, delete)
    ├── manages tags (add, remove, rename, merge)
    └── manages trash (restore, permanent delete)
```
