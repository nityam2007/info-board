# Mistakes Log

> Log real AI mistakes here. Claude must read this and avoid repeats.

## Format

```
- [DATE] Description of mistake
```

## Logged Mistakes

- [2026-01-23] Documentation claimed "InputHome = capture-only, NO search" but code had search (type `/` or `?` prefix)
- [2026-01-23] Documentation claimed "Canvas/WebGL" but we use DOM-based tiles
- [2026-01-23] Documentation said "Svelte 4" but we use Svelte 5 with runes ($state, $derived, $props)
- [2026-01-23] canvas.md said "~1000 lines" but Canvas.svelte was 1600+ lines
- [2026-01-23] frontend.md showed old Svelte 4 syntax (export let) instead of Svelte 5 runes
- [2026-01-29] Over-engineered card aspect ratio when user only asked for zoom limit change
- [2026-01-29] Set sphere radius too small (55%) - should be 80% to fill more screen
- [2026-01-29] Documentation still said "flat masonry" after implementing 3D globe effect

## Key Learnings

1. **Listen carefully** - When user says "just X", don't add Y and Z
2. **Update docs immediately** - After major feature changes, sync all MD files
3. **Globe sphere radius** - Use 80% of viewport for good coverage
4. **Min zoom** - 60% is a good limit (cards stay readable)
5. **Search lives on Canvas** - InputHome is capture-only, no search
