# Claude Rules

> **READ THIS FIRST.** Persistent memory and hard constraints for Info Board project.

## Quick Reference Files

| File | Purpose |
|------|---------|
| `AI/claude.md` | THIS FILE - rules, constraints, stack |
| `AI/architecture.md` | System design, data model, API |
| `AI/rules.md` | Engineering standards |
| `AI/mistakes.md` | Past errors to avoid |
| `AI/agents.md` | Domain patterns (backend, frontend, canvas, AI) |
| `AI/skills.md` | HOW to work (read, write, verify) |
| `AI/prompts.md` | Atomic task templates |

---

## Project Summary

**Info Board** - A personal visual information system.
- **Input Home** - Minimal dark screen, single input box, capture only (no search)
- All content becomes immutable **Posts** (source of truth)
- **3D Globe Canvas** - Posts scattered on spherical surface, pan/zoom/fly navigation
- **Search = Teleport** - Press `/` to go to Canvas, Enter cycles through results
- **AI Chat** - Conversational search with source references
- AI suggests, never edits

## Core Philosophy

- **Input > Structure** - capture first, organize later
- **Raw data is sacred** - never modified by AI
- **Visual memory over lists** - spatial recall on 3D globe
- **No cognitive load at capture** - frictionless input
- **Content IS the interface** - no menus, no chrome

---

## Tech Stack (LOCKED - DO NOT CHANGE)

| Layer | Technology |
|-------|------------|
| Backend | Express.js (Node 20) |
| Database | SQLite (transactional) + DuckDB (FTS/analytics) |
| Frontend | Svelte 5 (runes: $state, $derived, $props, $effect) |
| Rendering | DOM tiles with CSS 3D transforms (NOT Canvas API) |
| AI API | Groq (llama-3.1-70b-versatile), behind AI_ENABLED toggle |
| Package Manager | pnpm |
| Dev Runtime | Bun (local only) |
| Production | Docker (node:20-alpine) |

## Target Environment

- 1 vCPU / 2GB RAM VPS
- Self-hosted, single-user (password only)
- Local-first, offline-capable
- No SaaS, no cloud dependencies

---

## MUST DO (Every Query)

1. Read `mistakes.md` before starting
2. Follow `architecture.md` exactly
3. Use Svelte 5 runes (NOT `export let`)
4. Keep code async/non-blocking
5. **Update /CHANGELOG.md at end** (append-only, NEVER skip)

## MUST NOT DO

- Suggest React, Angular, Vue
- Use Canvas API for text (blurry)
- Use old Svelte 4 syntax
- Suggest any DB other than SQLite/DuckDB
- Add cloud auth (OAuth, Firebase)
- Edit user content (AI can only suggest)
- Add blocking/sync operations
- Break immutability of Posts
- Make search filter to a list (search = teleport on globe)
- Skip updating CHANGELOG.md

---

## Three Views

| View | Purpose | Search |
|------|---------|--------|
| **InputHome** | Capture content | NO - press `/` goes to Canvas |
| **Canvas** | Browse on 3D globe | YES - teleport navigation |
| **AIChat** | Conversational search | Via AI responses |

## Workflow

```
1. Read context (claude.md, architecture.md, mistakes.md)
2. Use atomic prompt from prompts.md
3. Execute with skills from skills.md
4. Verify change compiles
5. Update CHANGELOG.md
```

## Known Mistakes

See `mistakes.md` - CHECK BEFORE EVERY TASK.
