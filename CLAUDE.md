# CLAUDE.md - Project Instructions

> This file is automatically loaded by Claude Code at the start of every session.

## MANDATORY: Read These Files First

Before doing ANY work, read these files in order:

1. **`AI/claude.md`** - Project rules, constraints, locked tech stack
2. **`AI/architecture.md`** - System design, data model, API endpoints
3. **`AI/mistakes.md`** - Past errors to AVOID repeating

## Quick Context

**Info Board** - Personal visual information capture system

| Aspect | Detail |
|--------|--------|
| Backend | Express.js + Node 20 |
| DB | SQLite + DuckDB |
| Frontend | **Svelte 5** with runes ($state, $derived, $props) |
| Rendering | **DOM tiles** (NOT Canvas API) |
| AI | Groq API, behind AI_ENABLED toggle |

## Critical Rules

- ✅ Posts are immutable (never edit user content)
- ✅ Search = teleport camera (NOT filter to list)
- ✅ Use Svelte 5 runes (`$state`, `$props`) NOT `export let`
- ✅ Update `/CHANGELOG.md` at END of every query
- ❌ NO React, Vue, Angular
- ❌ NO Canvas API for text (use DOM tiles)
- ❌ NO cloud auth or SaaS

## Reference Files

```
AI/
├── claude.md       ← Main rules (READ FIRST)
├── architecture.md ← System design
├── rules.md        ← Engineering standards
├── mistakes.md     ← Errors to avoid
├── agents.md       ← Domain patterns
├── skills.md       ← How to work
├── prompts.md      ← Task templates
└── prompts/        ← Individual atomic prompts
```

## Workflow

1. Read context files
2. Check `mistakes.md`
3. Use atomic prompts from `AI/prompts.md`
4. Verify changes compile
5. **Update CHANGELOG.md** (NEVER skip)
