# Agents Reference

> Consolidated context for all development domains. Claude reads this for domain-specific patterns.

---

## Backend (Express.js + Node 20)

**Scope:** API endpoints, database operations, file handling

**Tech:**
- Express.js with async/await
- SQLite (better-sqlite3) for transactional
- DuckDB (@duckdb/node-api) for analytics/FTS
- No blocking operations

**Pattern:**
```javascript
router.post('/endpoint', async (req, res) => {
  try {
    const result = await service.operation(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Rules:**
- SQLite for CRUD, DuckDB for search/analytics
- Use parameterized queries always
- Stream large responses
- Target: 1vCPU / 2GB RAM

**Forbidden:** Sync operations, Direct DB in handlers, Cloud services

---

## Frontend (Svelte 5 + Runes)

**Scope:** UI components, client state, styling

**Tech:**
- Svelte 5 with runes (`$state`, `$derived`, `$props`, `$effect`)
- Plain Svelte + Vite (NOT SvelteKit)
- CSS variables for theming, lucide-svelte icons
- DOM-based tiles with CSS 3D transforms

**Pattern:**
```svelte
<script lang="ts">
  interface Props { someProp?: string; }
  let { someProp = '' }: Props = $props();
  let state = $state('');
  let computed = $derived(state.length);
  
  $effect(() => { console.log(state); });
</script>
```

**Four Main Views:**

| View | File | Lines | Purpose |
|------|------|-------|---------|
| InputHome | `views/InputHome.svelte` | ~350 | Minimal capture, no search |
| Canvas | `views/Canvas.svelte` | ~1640 | 3D globe browse, search teleport |
| AIChat | `views/AIChat.svelte` | ~500 | Conversational search |
| Admin | `views/Admin.svelte` | ~900 | Content management |

**Key Components:**

| Component | File | Purpose |
|-----------|------|---------|
| PostDetail | `components/PostDetail.svelte` | Read-only post detail modal |

**Forbidden:** React/Vue/Angular, Old Svelte 4 syntax (`export let`)

---

## Canvas (3D Globe Effect)

**Scope:** DOM-based tile rendering with 3D sphere projection

**Vision:**
- Posts scattered on virtual 3D sphere surface
- Cards shrink and tilt toward edges (like looking at a globe)
- Search = teleport camera + highlight, NOT filter to list
- Obsidian graph view meets Google Earth feel

**Key Constants:**
```javascript
const MIN_ZOOM = 0.6;      // Max 60% zoom out
const MAX_ZOOM = 2.5;      // Max 250% zoom in
const FLY_DURATION = 600;  // ms for fly animation
const FRICTION = 0.92;     // Momentum decay
```

**Globe Transform (`getGlobeTransform`):**
```javascript
// Sphere radius: 80% of viewport
const sphereRadius = Math.min(viewportWidth, viewportHeight) * 0.8;

// Center zone (30%) stays at full size
const centerZone = 0.3;

// Cosine interpolation for smooth falloff
const smoothT = (1 - Math.cos(t * Math.PI)) / 2;

// Min scale: 40% at edges (readable)
const minScale = 0.4 + zoomFactor * 0.1;

// Max tilt: 35-45° at edges
const maxTilt = 35 + (1 - zoomFactor) * 10;
```

**Layout (Spiral Time-based):**
- Golden angle distribution for organic spacing
- Newer posts near center, older spiral outward
- Random jitter for natural feel (±60px)
- Size by type: images 200px, text 180px, URLs 190px, others 160px

**Interactions:**
| Input | Action |
|-------|--------|
| Left-drag | Pan canvas |
| Scroll wheel | Zoom toward cursor |
| Click empty | Fly to location |
| Click card | Open PostDetail modal |
| WASD/Arrows | Pan camera |
| +/- | Zoom |
| / | Focus search |
| Enter (in search) | Teleport to next result |
| H | Go home |
| C | Go to chat |
| 0 | Reset view |

**Search Teleport:**
- Enter cycles through results (camera flies to card)
- Arrow Up/Down also cycle
- Click card opens it
- `highlightedPostId` shows pulsing glow on found card

**Modal Isolation (CRITICAL):**
When `selectedPost` is set, Canvas must:
- Return early from `handlePointerDown`
- Return early from `handlePointerMove`
- Return early from `handleWheel`
- NOT capture pointer events

**Performance:**
- Frustum culling (only render visible cards ± 300px)
- CSS `will-change` for transforms
- Lazy image loading
- 60fps target

**Forbidden:** Canvas API for text, Search as list filter

---

## PostDetail Component

**Scope:** Read-only modal for viewing post details

**File:** `frontend/src/components/PostDetail.svelte`

**Layout:**
```
2-COLUMN (for image/video/url with preview):
┌──────────────────────────────────────────────────────┐
│ Header: TYPE - Date                        Copy   X  │
├──────────────────────┬───────────────────────────────┤
│                      │  Title / Filename             │
│   MEDIA PREVIEW      │  Description                  │
│      (40%)           │  [Open Link] button           │
│                      │  ─────────────────────────    │
│                      │  AI Analysis (if any)         │
│                      │  Tags: [tag1] [tag2] [ai]     │
│                      │  via source                   │
└──────────────────────┴───────────────────────────────┘

1-COLUMN (for text/audio/file):
┌──────────────────────────────────────────────────────┐
│ Header: TYPE - Date                        Copy   X  │
├──────────────────────────────────────────────────────┤
│  Text content / Audio player / File info             │
│  ──────────────────────────────────────────────────  │
│  AI Analysis (if any)                                │
│  Tags: [tag1] [tag2]                                │
│  via source                                          │
└──────────────────────────────────────────────────────┘
```

**Layout by Content Type:**

| Type | Layout | Media Column |
|------|--------|--------------|
| Image | 2-col (40/60) | Image preview |
| Video | 2-col (40/60) | Video player |
| URL | 2-col (40/60) | OG image preview |
| Text | 1-col | Paper background |
| Audio | 1-col | Audio player icon |
| File | 1-col | File icon + download |

**Key CSS (z-index & event isolation):**
```css
.overlay {
  z-index: 9999;
  touch-action: auto !important;
  user-select: text !important;
  pointer-events: auto !important;
}
```

**Event Handling:**
```svelte
<div class="overlay"
  onpointerdown={(e) => e.stopPropagation()}
  onpointermove={(e) => e.stopPropagation()}
  onpointerup={(e) => e.stopPropagation()}
  onwheel={(e) => e.stopPropagation()}
>
```

**Features:**
- Read-only (no tag editing - use Admin panel)
- Text selectable
- Buttons work (copy, close, open link, download)
- Smooth scrolling for long content
- Mobile responsive (stacks vertically < 640px)

**Forbidden:** Editing tags (Admin only), Tasks display (tasks are separate posts)

---

## AI Integration (Groq)

**Scope:** LLM API, tag/task extraction, chat, image analysis

**Tech:**
- Groq API (OpenAI-compatible)
- Text Model: `openai/gpt-oss-20b` (tagging, chat)
- Vision Model: `meta-llama/llama-4-scout-17b-16e-instruct` (image OCR, descriptions)
- Audio Model: `whisper-large-v3-turbo` (transcription)
- ~1000 tokens/sec, behind `AI_ENABLED` toggle

**Pattern:**
```javascript
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function suggest(content) {
  if (!process.env.AI_ENABLED) return null;
  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [{ role: 'system', content: PROMPT }, { role: 'user', content }],
    max_tokens: 200
  });
  return response.choices[0].message.content;
}
```

**Image Analysis (Vision):**
```javascript
async function analyzeImage(imageUrl) {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: VISION_PROMPT },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }],
    max_tokens: 1000
  });
  // Returns: { description, ocrText, suggestedTags }
}
```

**AI Metadata Fields:**
- `metadata.aiDescription` - AI-generated description of image content
- `metadata.ocrText` - Extracted text from image (receipts, screenshots, documents)
- `metadata.aiSummary` - AI summary of text/URL/audio content
- `metadata.transcription` - Audio transcription
- `tags.is_ai_suggested` - Boolean flag for AI-generated tags

**Safety:** Sanitize inputs, validate JSON outputs, rate limit, 10s timeout

**Forbidden:** Modify user content, Auto-apply suggestions, Expose API key

---

## Search (DuckDB FTS)

**Scope:** Full-text search, teleport navigation

**Tech:**
- DuckDB FTS extension
- BM25 ranking

**Pattern:**
```sql
PRAGMA create_fts_index('posts', 'id', 'content');
SELECT *, fts_main_posts.match_bm25(id, ?) AS score
FROM posts WHERE score IS NOT NULL
ORDER BY score DESC LIMIT 20;
```

**Behavior:** Search returns coordinates → camera teleports → highlights matches

---

## Admin Panel

**Scope:** Content management, tag management, system maintenance

**File:** `frontend/src/views/Admin.svelte`

**Tabs:**
1. **Posts** - Search, filter, edit, delete posts
2. **Trash** - Restore or permanently delete
3. **Tags** - Rename, merge, delete tags
4. **System** - Stats, database optimize, export

**Features:**
- Password protected (ADMIN_PASSWORD or PASSWORD env)
- Mobile responsive (card layout on small screens)
- Bulk operations (select multiple posts)
- Tag editing (only place to add/remove tags)

---

## Infrastructure

**Target:** 1 vCPU / 2GB RAM VPS, self-hosted, single-user

**Docker:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

**Dev vs Prod:**
| Aspect | Dev | Prod |
|--------|-----|------|
| Runtime | Bun | Node 20 |
| Install | bun install | pnpm |
| Build | typecheck | full build |

**Forbidden:** SaaS, Cloud lock-in, Secrets in Dockerfile
