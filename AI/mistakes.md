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
- [2026-01-29] PostDetail modal inside Canvas inherited `user-select: none` and `touch-action: none` - buttons didn't work
- [2026-01-29] Canvas pointer handlers kept capturing events even when modal was open - background scrolled while modal displayed
- [2026-01-29] Modal z-index 1000 wasn't enough when nested inside Canvas - needed 9999 + `!important` overrides
- [2026-01-29] Download button was created with no onclick handler - completely non-functional

## Key Learnings

1. **Listen carefully** - When user says "just X", don't add Y and Z
2. **Update docs immediately** - After major feature changes, sync all MD files
3. **Globe sphere radius** - Use 80% of viewport for good coverage
4. **Min zoom** - 60% is a good limit (cards stay readable)
5. **Search lives on Canvas** - InputHome is capture-only, no search
6. **Modal isolation** - When modal is inside a container with restricted events:
   - Use `z-index: 9999` with `!important`
   - Add `touch-action: auto !important`
   - Add `user-select: text !important`
   - Add `pointer-events: auto !important`
   - Stop propagation on pointer/wheel events
   - Parent handlers must check if modal is open before processing
7. **Always test buttons** - Every button must have an onclick handler
8. **Tags are read-only in PostDetail** - Editing happens in Admin panel
