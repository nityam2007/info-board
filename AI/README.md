# AI Workflow Directory

> Project-level files (README.md, CHANGELOG.md, CLAUDE.md) are in project root.

## Structure (Simplified)

```
AI/
├── claude.md       # MAIN: Rules, constraints, stack (READ FIRST)
├── architecture.md # System design, data model, API
├── rules.md        # Engineering standards
├── mistakes.md     # Past errors to avoid
├── agents.md       # MERGED: All domain patterns
├── skills.md       # MERGED: How to work
├── prompts.md      # MERGED: All task templates
└── prompts/        # Individual atomic prompts (optional detail)
```

## For New Chats

The project root contains `CLAUDE.md` which Claude Code automatically reads.
It instructs Claude to read `AI/claude.md`, `AI/architecture.md`, and `AI/mistakes.md` first.

## Workflow

1. Read `claude.md`, `architecture.md`, `mistakes.md`
2. Use atomic prompt from `prompts.md`
3. Execute with skills from `skills.md`
4. Verify change, add to mistakes.md if needed
5. **Update /CHANGELOG.md at end (append-only)**

## Principle

- **Small tasks, perfect execution**
- MD files = AI brain
- Code = human-owned
- AI assists, never decides
