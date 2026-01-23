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

**Forbidden:** ❌ Sync operations, ❌ Direct DB in handlers, ❌ Cloud services

---

## Frontend (Svelte 5 + Runes)

**Scope:** UI components, client state, styling

**Tech:**
- Svelte 5 with runes (`$state`, `$derived`, `$props`, `$effect`)
- Plain Svelte + Vite (NOT SvelteKit)
- Tailwind CSS, lucide-svelte icons
- DOM-based tiles (not Canvas API)

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

**Pages:**
1. Input Home - Black screen, capture + quick search (`/` or `?` prefix)
2. Infinite Canvas - Pinboard masonry, pan/zoom, search teleport
3. AI Chat - Conversational search with sources

**Forbidden:** ❌ React/Vue/Angular, ❌ Old Svelte 4 syntax (`export let`)

---

## Canvas (Infinite Flat Board)

**Scope:** DOM-based tile rendering, pan/zoom, spatial navigation

**Vision:**
- Infinite flat plane (no 3D, Z=0)
- Data as tiles on pinboard
- Search = teleport camera + highlight, NOT filter to list
- Pinterest / Google Maps feel

**Coordinates:**
```
World Space: Posts at (x, y), Camera at (cx, cy) + zoom
Screen = (World - Camera) × Zoom
```

**Layout (Masonry):**
- Bin-packing algorithm (not column-based)
- Variable widths: 160px × [1, 1.1, 1.2, 1.3, 1.4, 1.5]
- 24px gap, 2800px grid, random shuffle
- Per-tile jitter: ±2.5° rotation, ±40px horizontal, ±30px vertical

**Tile Types:**
| Type | Height |
|------|--------|
| Image | Real aspect ratio from metadata |
| URL | 300px with preview, 160px without |
| Text | 120-380px based on length |
| Audio | Fixed 100px |
| File | Fixed 140px |

**Interactions:**
- Left-drag anywhere = pan (even over cards)
- Scroll = zoom toward cursor
- Double-click = toggle 1x/1.5x
- WASD/Arrows = pan, +/- = zoom, / = search, ? = help

**Performance:**
- Frustum culling (visible + padding only)
- CSS will-change
- Lazy image loading
- 60fps target

**Forbidden:** ❌ Canvas API for text, ❌ 3D transforms, ❌ Search as list filter

---

## AI Integration (Groq)

**Scope:** LLM API, tag/task extraction, chat

**Tech:**
- Groq API (OpenAI-compatible)
- Model: `openai/gpt-oss-20b`
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

**Safety:** Sanitize inputs, validate JSON outputs, rate limit, 10s timeout

**Forbidden:** ❌ Modify user content, ❌ Auto-apply suggestions, ❌ Expose API key

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

**Forbidden:** ❌ SaaS, ❌ Cloud lock-in, ❌ Secrets in Dockerfile
