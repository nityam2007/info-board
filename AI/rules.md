# Engineering Rules

> Coding standards and architectural boundaries.

## General Rules

- CHANGELOG.md must be updated at end of every query (append-only)
- All features must be toggleable via `.env`
- No blocking code in async contexts
- No AI modifying source data directly
- Posts are append-only, never modified after creation

## Express.js Rules

- Use async/await for all I/O
- No synchronous file operations
- Minimize middleware chain
- Use streaming for large responses
- Offload CPU work to worker threads if needed

## Database Rules

- SQLite for transactional data (posts, metadata, settings)
- DuckDB for analytics, search, FTS
- Never block event loop with large queries
- Recreate DuckDB FTS indexes when data changes

## Frontend Rules (Svelte)

- No DOM-heavy rendering
- Use Canvas/WebGL for infinite board
- Keep bundle size minimal (<50KB gzipped)
- No UI state inside render loops
- Compile-time optimization preferred

## AI Integration Rules

- All AI calls behind `AI_ENABLED` env flag
- AI never modifies user content
- AI suggestions stored separately from posts
- User must confirm all AI actions
- Graceful fallback when AI disabled

## Data Rules

- Posts = immutable source of truth
- Tasks/Tags = references to Posts (not edits)
- All data stored locally by default
- Export must work without DB knowledge

## Review Checklist

- [ ] Does it follow `architecture.md`?
- [ ] Does it violate any rule in `claude.md`?
- [ ] Is it async/non-blocking?
- [ ] Is CHANGELOG.md updated?
- [ ] Are there any new mistakes to log?
