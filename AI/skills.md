# Skills Reference

> Atomic capabilities Claude uses during execution. Read this for HOW to work.

---

## Read Context

Before ANY implementation:
1. Read relevant existing code
2. Check `architecture.md` and `mistakes.md`
3. Ask if unclear

**Output:** Summary bullets, key findings, blockers

---

## Break Down Task

For tasks bigger than a single function:
1. List all parts needed
2. Find dependencies
3. Order smallest → largest
4. Execute ONE at a time

**Output:** Numbered steps (max 5-7), each atomic

---

## Write Code

1. ONE function at a time
2. Match existing style (Svelte 5 runes, async/await)
3. Add TypeScript types
4. Handle edge cases
5. Brief comments if complex

**Output:** Single function/component ready to use

---

## Verify Change

After ANY code change:
1. Check for TypeScript errors
2. Ensure it compiles/runs
3. Check `rules.md` compliance
4. **Update CHANGELOG.md** (MANDATORY)

---

## Fix Error

1. Read FULL error message
2. Find exact line/cause
3. Apply SMALLEST fix
4. Verify it's fixed
5. Log to `mistakes.md` if AI-caused

---

## Update Changelog (MANDATORY)

At END of every query:
```markdown
## [YYYY-MM-DD] - Brief Title

### Added
- New feature X

### Changed
- Modified Y

### Fixed
- Bug in Z
```

**NEVER SKIP THIS.**
