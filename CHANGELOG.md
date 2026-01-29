# CHANGELOG

> **RULE: This file is APPEND-ONLY. Always update at end of every query.**

---

## [2026-01-29] - Zoom Limit & Larger Globe Area

### Changed

**Zoom Limit**
- Maximum zoom out capped at 60% (was 30%)
- `MIN_ZOOM = 0.6`

**Globe Visible Area Expanded**
- Sphere radius increased from 55% to 80% of viewport
- Cards now spread across more of the screen (less dark edges)
- zoomFactor minimum updated to 0.6 to match MIN_ZOOM

**Documentation Sync**
- Updated AI/claude.md - 3D globe, minimal home, search on canvas only
- Updated AI/architecture.md - Globe details, view descriptions
- Updated AI/agents.md - Canvas section with globe transform code
- Updated AI/mistakes.md - Added new learnings
- Updated README.md - Globe effect, three views, updated controls

### Files Modified
- `frontend/src/views/Canvas.svelte` - MIN_ZOOM, sphereRadius, zoomFactor
- `AI/claude.md`, `AI/architecture.md`, `AI/agents.md`, `AI/mistakes.md`, `README.md`

---

## [2026-01-29] - Improved Globe Effect - Smoother & More Readable

### Improved

**Globe Transform - Less Aggressive, More Elegant**
- Center zone (30% radius): Cards stay at full size, no shrinking
- Minimum scale: 40-50% (was 15-30%) - edge cards now readable
- Maximum tilt: 35-45° (was 60-75°) - cards stay legible at edges
- Cosine interpolation: Smooth S-curve transition (not harsh exponential)
- Circular sphere: Uses min(width, height) for consistent circular feel

### Visual Result
- Center cards: Full size, no rotation
- Mid-range cards: Gradual size reduction, gentle tilt
- Edge cards: ~40% size, readable text, subtle perspective
- Smoother overall appearance, less chaotic

### Files Modified
- `frontend/src/views/Canvas.svelte` - Rewrote `getGlobeTransform()`

---

## [2026-01-29] - Home Page Redesign & Search Consolidation

### Changed

**Home Page (InputHome) - Complete Redesign**
- Removed search functionality from home (search now ONLY on Canvas)
- Clean, minimal design matching Canvas aesthetic
- Dark glassmorphism style with dot pattern background
- Simplified stats display (just captures count + streak)
- Compact input card with upload and submit buttons
- Smaller nav buttons in top-right corner

**Search Consolidated to Canvas**
- Pressing `/` on home navigates to Canvas with search focused
- All search happens on Canvas with teleport navigation
- Removed redundant search mode, search results section from home

### Technical Changes
- InputHome.svelte rewritten from ~1600 lines to ~350 lines
- CSS bundle reduced from 59.49 KB to 46.58 KB
- Added `searchInputEl` ref to Canvas for auto-focus
- App.svelte updated to pass search param (including empty string for focus mode)

### Files Modified
- `frontend/src/views/InputHome.svelte` - Complete rewrite
- `frontend/src/views/Canvas.svelte` - Added search input ref and auto-focus
- `frontend/src/App.svelte` - Updated navigation handler for search param

---

## [2026-01-29] - Search = Teleport & Improved Globe Scaling

### Added

**Search Teleport Navigation**
- Enter key cycles through search results (teleports camera, doesn't open modal)
- Arrow Up/Down also cycle through results
- Clicking a card opens it (unchanged)
- Search dropdown shows result numbers (1, 2, 3...) and hint text
- Current result highlighted in dropdown with purple accent
- Highlighted card on globe has pulsing glow animation

### Improved

**Globe 3D Effect - Continuous Scaling**
- Cards now shrink continuously from center to edges (no more "cutoff" zone)
- Uses viewport diagonal as reference for smooth scaling across whole screen
- Zoom-dependent shrinking power: 30% zoom = aggressive (power 2.4), 100% = gentle
- Cards stay visible longer (opacity fades only at extreme edges, not with scale)
- Scale range: 1.0 at center → 0.2 at edges (at 30% zoom)

### Technical Changes
- Added `currentResultIndex` and `highlightedPostId` state for search navigation
- `flyToResult(index)` - teleports without opening modal
- `handleSearchKeydown` - handles Enter/Arrow keys for cycling
- `.world-post.highlighted` - pulsing glow animation for found card
- `.search-result.active` - visual highlight for current result in dropdown

### Files Modified
- `frontend/src/views/Canvas.svelte`

---

## [2026-01-29] - True 3D Sphere Effect for Canvas

### Fixed

**Cards Now Shrink at Edges Like a Real 3D Ball**
- Completely rewrote `getGlobeTransform()` to use proper spherical projection
- Cards at center: Full size (scale = 1.0), full opacity
- Cards at edges: Dramatically smaller (scale down to 0.2), fade out
- Uses mathematical sphere formula: `z = sqrt(1 - x² - y²)`

**Spherical Projection Math**
- Normalized screen coordinates to -1 to 1 range
- Calculate Z position on virtual sphere surface
- Scale factor = `0.2 + sphereZ * 0.8` (20% at edge, 100% at center)
- Opacity = `sphereZ²` (quadratic fade for smooth edges)
- Tilt = cards rotate away from viewer at edges (up to 70°)

**Zoom Affects Sphere Tightness**
- At 30% zoom: Smaller visible sphere (tighter ball effect)
- At 100% zoom: Larger sphere radius (more cards visible at full size)
- `sphereRadius = 0.8 + zoomFactor * 0.4`

### Technical Changes
- Removed yOffset (was causing vertical drift)
- Fixed double-scaling bug (width had scale AND transform had scale)
- Increased perspective distance to 1000px (reduces distortion)
- Added `transform-style: preserve-3d` for proper 3D rendering

### Visual Result
- Center: Cards at full size, facing viewer
- Edges: Cards shrink dramatically and tilt away (like on curved ball surface)
- Creates illusion of posts scattered on a 3D sphere

### Files Modified
- `frontend/src/views/Canvas.svelte` - Complete rewrite of `getGlobeTransform()`

---

## [2026-01-29] - Canvas Click & Globe Perspective Fixes

### Fixed

**Header/UI Buttons Not Clickable**
- `handleCanvasClick` now checks if click target is inside floating UI elements
- Uses `target.closest()` to detect clicks on `.floating-header`, `.floating-controls`, `.zoom-indicator`
- Home, Search, AI Chat buttons in header now work correctly

**Cards Not Opening (Sliding Instead)**
- Root cause: `setPointerCapture` was capturing pointer events even when clicking on cards
- `handlePointerDown` now checks if target is a UI element or card before starting drag
- Cards now open modal on click instead of triggering canvas pan

**Globe Perspective Effect More Dramatic**
- Increased `distortionIntensity` multiplier from 1.5 to 2.5
- Increased base rotation from 6° to 12°
- Increased zoom rotation bonus from 4° to 10°
- Reduced perspective distance from 800px to 500px (closer = more dramatic)
- Cards at edges now visibly tilt toward center when zoomed out
- Removed scaleX/scaleY stretch (was causing visual issues), using clean perspective rotation instead

### Technical Changes
- `handlePointerDown`: Added early return for UI elements and cards
- `handleCanvasClick`: Added target checks for floating UI and world-post elements
- `getGlobeTransform`: Simplified to use perspective rotation only (removed stretch)
- Card transform: Now uses `scale({globe.scale})` instead of separate scaleX/scaleY

### Files Modified
- `frontend/src/views/Canvas.svelte` - Click handling, pointer capture, globe transform

---

## [2026-01-29] - Canvas Globe Distortion & Click Fix (superseded)

### Complete Canvas Rewrite - Globe Experience

Replaced the grid-based V3 canvas with an immersive 2.5D globe-style spatial canvas, inspired by Obsidian's graph view but with a spherical/globe feel.

**Layout System:**
- **Time-based spiral layout** - Newer posts near center, older posts spiral outward
- Uses golden angle distribution for organic, even spacing
- Random jitter adds natural feel (not rigid grid)
- Posts sized by content type (images larger, files smaller)

**Globe Distortion Effect:**
- **Edge fade** - Posts at edges of viewport fade out (globe horizon)
- **Perspective curve** - Posts scale down and tilt as they approach edges
- **Y-offset** - Simulates looking down at a curved surface
- **3D rotation** - Subtle rotateX/rotateY based on position

**Parallax Background:**
- 3 layers moving at different speeds (0.1x, 0.2x, 0.3x camera movement)
- Layer 1: Subtle color gradients
- Layer 2: Dot grid (60px spacing)
- Layer 3: Larger dot grid (120px spacing)
- Globe vignette overlay (darker at edges)

**Navigation - All Modes:**
- **Drag to pan** - Left-click and drag anywhere
- **Swipe momentum** - Flick to throw, velocity decays with friction (0.92)
- **Scroll to zoom** - Mouse wheel zooms toward cursor position
- **Click to fly** - Click empty space to smoothly animate camera there
- **Pinch to zoom** - Touch gesture support for mobile
- **Keyboard**: WASD/Arrows to move, +/- to zoom, 0 to reset, H for home, C for chat

**Search = Teleport:**
- Search finds posts, clicking result flies camera to that post
- Post opens after flight animation completes

**UI:**
- Floating header with search bar (glassmorphism)
- Floating zoom controls (bottom-right)
- Zoom indicator (bottom-left)
- Help modal with all shortcuts

### Files Modified
- `frontend/src/views/Canvas.svelte` - Complete rewrite (~850 lines)

### Why
User requested Obsidian-style 2.5D globe canvas where posts feel like they're scattered on a spherical surface, swipable/scrollable with immersive spatial navigation.

---

## [2026-01-29] - Canvas V3 & AI Chat V3 Redesign Complete

### Fixed
- **AIChat.svelte** - Button nesting accessibility error:
  - Changed conversation-item from `<button>` to `<div>` with `role="button"`
  - Added keyboard support (`onkeydown` for Enter key)
  - Added `tabindex="0"` for focus management
  - Fixed: `<button>` cannot be a child of `<button>` build error

### Summary of V3 Redesign (completed earlier this session)

**Canvas.svelte - Complete Rewrite:**
- Clean CSS grid masonry layout (replaced confusing infinite wrapping/torus)
- Filter bar with content type chips (Notes, Images, Links, Audio, Video, Files)
- Sort options (Newest, Oldest, By Type)
- Grid/List view toggle
- Search results panel as sidebar (click to highlight post in grid)
- Clean card designs with proper type distinction
- Keyboard shortcuts (/, Escape, H, C, G)
- Removed random jitter/rotation (was messy)

**AIChat.svelte - Complete Rewrite:**
- Conversation history persisted to localStorage
- Sidebar with conversation list (create/delete conversations)
- Quick action suggestions for empty state
- Better source references with type icons and colors
- Context badge showing post count and streak
- Collapsible sidebar for mobile

### Build Status
- Backend: Compiles cleanly
- Frontend: Builds successfully (warnings only - Svelte 5 deprecation notices for `<svelte:component>`)

### Files Modified
- `frontend/src/views/AIChat.svelte` - Fixed button nesting, complete V3 rewrite
- `frontend/src/views/Canvas.svelte` - Complete V3 rewrite

---

## [2026-01-29] - Build Fixes: TypeScript & Accessibility

### Fixed

**Backend TypeScript Errors**
- **DuckDB API compatibility** (`backend/src/db/duckdb.ts`):
  - Fixed `connection.disconnect()` → `connection.closeSync()` (method renamed in @duckdb/node-api 1.4.x)
  - Fixed `instance.close()` → `instance.closeSync()`
  - Fixed `connection.run()` with positional args → use prepared statements with `bindVarchar()`/`bindInteger()`
  - Fixed `result.getReader()` → use `runAndReadAll()` then `result.getRows()`

- **Express Router type annotations** (all route files):
  - Added explicit `RouterType` type annotation to fix portable type inference error
  - Files fixed: `posts.ts`, `search.ts`, `tags.ts`, `tasks.ts`, `upload.ts`

- **FileMetadata interface** (`backend/src/types.ts`):
  - Added missing `width?: number` and `height?: number` properties for image dimensions

**Frontend Accessibility (a11y) Warnings**
- **InputHome.svelte** - Shortcuts modal:
  - Added ARIA roles (`dialog`, `presentation`), `aria-modal`, `tabindex`, keyboard handlers
  
- **Canvas.svelte** - Help modal & post detail modal:
  - Added ARIA roles, `tabindex`, keyboard handlers for Escape key
  - Added `svelte-ignore` comments for intentional non-interactive element handlers
  - Added caption ignore for video element (user-uploaded content has no captions)
  - Added ignore for canvas container's tabindex (needed for keyboard navigation)

### Files Modified
- `backend/src/db/duckdb.ts` - DuckDB API compatibility rewrite
- `backend/src/types.ts` - Added width/height to FileMetadata
- `backend/src/routes/posts.ts` - Router type annotation
- `backend/src/routes/search.ts` - Router type annotation
- `backend/src/routes/tags.ts` - Router type annotation
- `backend/src/routes/tasks.ts` - Router type annotation
- `backend/src/routes/upload.ts` - Router type annotation
- `frontend/src/views/InputHome.svelte` - Accessibility fixes
- `frontend/src/views/Canvas.svelte` - Accessibility fixes

### Why
- Build was failing due to @duckdb/node-api breaking changes (API method renames)
- Express router type inference errors prevented backend compilation
- Accessibility warnings cluttered build output and indicated missing ARIA support

---

## [2026-01-29] - Info Board V2: Premium UI Experience

### Theme: "Make users WANT to use it"

A comprehensive UI overhaul focused on creating an engaging, sticky experience that users
want to return to. Inspired by premium apps like Notion, Linear, and Arc Browser.

### Added

**Enhanced Design System (app.css)**
- New CSS variables for richer color palette with depth:
  - `--color-bg-elevated`, `--color-surface-hover`, `--color-primary-glow`
  - Success, warning, info accent colors with dim variants
- Premium gradient system: `--gradient-primary`, `--gradient-glow`, `--gradient-shine`
- Layered shadow system: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
- Smooth timing functions: `--ease-out-expo`, `--ease-out-back`, `--ease-spring`

**New Animations**
- `@keyframes float` - Ambient floating for orbs
- `@keyframes pulse-glow` - Attention-grabbing pulse
- `@keyframes breathe` - Subtle background breathing
- `@keyframes shimmer` - Loading state shimmer
- `@keyframes confetti-fall` - Celebration confetti
- `@keyframes bounce-in`, `slide-up-fade` - Entry animations
- `@keyframes gradient-shift`, `ripple` - Interactive effects
- Utility classes: `.animate-float`, `.animate-pulse-glow`, `.animate-bounce-in`
- Stagger delay helpers: `.stagger-1` through `.stagger-5`

**Stats API Endpoint**
- `GET /api/posts/stats` - Returns dashboard statistics:
  - `totalPosts`, `postsToday`, `postsThisWeek`
  - `postsByType` - Breakdown by content type
  - `streak` - Consecutive days with captures
  - `recentTags` - Top 5 tags by count
- Added `getStats()` method to `postsService` (backend)
- Added `api.posts.stats()` to frontend API client

**InputHome.svelte - Complete Transformation**
- Animated background:
  - Gradient layer with breathing animation
  - Grid overlay with radial mask
  - Three floating orbs with different colors and animation delays
- Stats dashboard (for returning users):
  - Total captures, day streak (with fire icon), weekly count
  - Top topic tag display
  - Animated card hover states with gradient backgrounds
- Empty state for new users:
  - Brain icon with gradient background
  - "Start your knowledge journey" messaging
  - Feature chips showing what users can capture
- Confetti celebration on successful capture:
  - 50 randomized pieces with varied colors, sizes, delays
  - Smooth falling animation
- Motivational messages:
  - Rotating hints when idle ("Your ideas deserve a home", etc.)
  - Streak-specific messages when on a streak
- Enhanced input container:
  - Zap icon for capture mode
  - Larger, more prominent submit button with gradient
  - Better focus states with glow effect
- Improved drag-and-drop overlay:
  - Centered content with icon, title, subtitle
  - Pulsing border animation
- All quick actions and buttons with lift-on-hover effect
- Success toast with icon wrapper and bounce animation

**Canvas.svelte Improvements**
- Loading state:
  - Centered spinner with pulsing fade animation
  - "Loading your knowledge..." message
- Empty state:
  - Large gradient icon with sparkles
  - "Your canvas awaits" heading
  - CTA button to navigate to capture view

**App.svelte View Transitions**
- Fade transition between views (150ms out, 50ms in)
- Prevents jarring instant switches

### Changed
- Updated `--color-bg` to slightly darker `#07070b` for more contrast
- Stats dashboard uses 120px minimum column width, auto-fit grid
- All buttons use new shadow and timing function variables
- Keyboard shortcuts modal has larger padding and better animations

### Files Modified
- `frontend/src/app.css` - Enhanced design system
- `frontend/src/lib/api.ts` - Added Stats interface and API method
- `frontend/src/App.svelte` - Added view transitions
- `frontend/src/views/InputHome.svelte` - Complete rewrite with new features
- `frontend/src/views/Canvas.svelte` - Added loading/empty states
- `backend/src/services/posts.ts` - Added getStats() method
- `backend/src/routes/posts.ts` - Added /stats endpoint

### Why
User feedback: "When I open it I don't feel like using it" - the app needed
personality, delight, and visual hooks to create engagement. Premium apps
succeed by making users feel good about using them. This update adds:
- Visual satisfaction (animations, celebrations)
- Progress tracking (stats, streaks)
- Emotional connection (motivational messages)
- Professional polish (smooth transitions, consistent styling)

---

## [2026-01-23] - AI Chat Markdown Rendering & Styling

### Added
- **frontend/src/views/AIChat.svelte** - Markdown rendering for AI responses:
  - Added `marked` library for parsing markdown
  - AI responses now render tables, lists, code blocks, links properly
  - Full prose styling for rich content display

### Changed
- **frontend/src/views/AIChat.svelte** - Complete color standardization:
  - All colors now use CSS variables (--color-bg, --color-primary, etc.)
  - AI response bubbles use light paper background (cream gradient)
  - User messages use primary color
  - Proper table styling with borders, header backgrounds
  - Code blocks with syntax-friendly dark background
  - Typing indicator matches paper theme
  - Input area, buttons, suggestions all use standardized colors

### Why
- AI responses were showing raw markdown text instead of rendered content
- Tables, code blocks, links were not displaying properly
- Consistent with site-wide color standardization

---

## [2026-01-23] - Canvas Text Modal Fix

### Fixed
- **frontend/src/views/Canvas.svelte** - Text post modal now uses light paper background:
  - Added unified `modal-paper` class for all non-media content types
  - Text, URL, audio, file modals all use cream paper gradient
  - Fixed modal-body background overriding parent paper gradient
  - Simplified CSS by removing duplicate modal-text/modal-url rules

### Why
- Text modal was showing dark background instead of light paper
- Inconsistent with other preview types

---

## [2026-01-23] - Canvas Search Bar & PostDetail Card Improvements

### Improved
- **frontend/src/views/Canvas.svelte** - Enhanced search bar:
  - Wider input (180px), better padding and focus states
  - Focus ring with indigo glow effect
  - Border transition on focus
  - Proper spinner animation for loading state

- **frontend/src/components/PostDetail.svelte** - Complete card redesign:
  - Modal: Larger max-width (600px), subtle glow shadow, better border radius (24px)
  - Close button: Backdrop blur, scale animation on hover
  - Text preview: Gradient background, larger font (17px), improved line height
  - Type badge: Gradient background with purple accent
  - Meta row: Better spacing, source badge styling
  - Tags: Indigo gradient theme, hover states, AI tag distinction
  - Tasks: Card-style with background, improved checkbox with gradient fill
  - Inputs: Better focus states with indigo ring, gradient add button
  - AI section: Purple gradient theme, larger button, better suggestion cards

### Why
- Search bar was too small and lacked visual feedback
- PostDetail needed modern, professional styling
- Consistent indigo/purple color theme across all elements

---

## [2026-01-23] - Responsive Redesign & Spring Movement Fix

### Fixed
- **frontend/src/views/Canvas.svelte** - Fixed keyboard "spring" movement issue:
  - Keys were setting velocity but `targetX/Y` wasn't updated, causing camera to spring back
  - Now directly modifies `camera.x/y` AND syncs `camera.targetX/Y` to prevent rubber-banding
  - WASD/Arrow keys now work smoothly without bouncing back on release

### Improved
- **frontend/src/views/InputHome.svelte** - Complete responsive redesign:
  - Vertically centered layout (not stuck at top)
  - Mobile-first responsive design with breakpoints at 480px and 640px
  - Safe area insets support for notched devices
  - Mobile nav buttons hide text, show only icons
  - Quick actions wrap to 2-column grid on mobile
  - Touch device optimizations (no hover transform on touch)
  - High contrast mode support
  - Reduced motion preference support
  - Updated background glow for subtler professional look

- **frontend/src/components/PostDetail.svelte** - Empty content handling:
  - Added fallback message when `post.content` is empty
  - Improved text preview font size and word-break handling
  - Better empty state styling

### Why
- Keyboard movement was using velocity which got dampened, while targetX/Y pulled camera back
- Home page was stuck at top instead of centered
- Needed full mobile responsiveness and device compatibility
- Posts with empty content showed blank modal

---

## [2026-01-23] - Enhanced Keyboard Shortcuts & Home Page UX

### Improved
- **frontend/src/views/Canvas.svelte** - Keyboard navigation overhaul:
  - Continuous movement with held keys (60fps loop via setInterval)
  - Added `H` shortcut to go home, `C` to open chat
  - Updated help modal with new "Views" section showing H/C shortcuts
  - Smooth pan/zoom with configurable PAN_SPEED=20, ZOOM_STEP=0.15

- **frontend/src/views/InputHome.svelte** - Complete UX refresh:
  - Auto-focus input on mount for immediate typing
  - Global keyboard shortcuts: `G` (canvas), `C` (chat), `/` (start search), `?` (help)
  - Dynamic greeting based on time of day
  - Shortcuts modal overlay with `?` toggle
  - Quick action buttons for common tasks
  - Subtle grid background pattern
  - Improved visual design with gradient accents
  - Better animations (fade-in, slide-in with stagger delays)
  - Enhanced button hover states and transitions
  - Search mode visual distinction

### Why
- Keyboard shortcuts previously stopped on first press (no continuous movement)
- Home page was plain and lacked discoverable features
- Users needed visual guidance for available actions

---

## [2026-01-23] - Critical Bug Fixes & Svelte 5 Compliance

### Fixed
- **frontend/src/views/InputHome.svelte** - Fixed old Svelte 4 syntax:
  - Changed `on:paste` to `onpaste` (Svelte 5 event handler syntax)

- **frontend/src/views/Canvas.svelte** - Added missing handler functions:
  - **handleKeyDown**: WASD/Arrow navigation, +/- zoom, 1-5 quick zoom levels, Home/0 reset, R random teleport, / focus search, ? toggle help, Escape close modals
  - **handleKeyUp**: Releases key tracking
  - **handleDoubleClick**: Toggle zoom between 1x and 1.5x at cursor position
  - **handleTouchStart**: Single finger pan, two-finger pinch-to-zoom setup
  - **handleTouchMove**: Touch pan and pinch-zoom implementation
  - **handleTouchEnd**: Reset drag state

- **frontend/src/views/AIChat.svelte** - Fixed navigation:
  - Updated Props interface to include `view` parameter
  - Back button now explicitly navigates to 'input' view

- **backend/src/routes/ai.ts** - Fixed TypeScript error:
  - Added explicit `RouterType` type annotation for router export

### Why
- Canvas keyboard/touch handlers were referenced in template but not defined (runtime errors)
- Old Svelte 4 `on:event` syntax breaks in Svelte 5 strict mode
- AIChat back navigation was ambiguous, could cause unexpected behavior
- TypeScript inference issue caused build warnings

---

## [2026-01-23] - Merged AI Configuration Files

### Added
- **CLAUDE.md** (project root) - Master instruction file that Claude Code reads automatically
- **AI/agents.md** - Consolidated all agents (backend, frontend, canvas, AI, search, infra)
- **AI/skills.md** - Consolidated all skills (read, write, verify, fix, changelog)
- **AI/prompts.md** - Consolidated all atomic prompt templates

### Changed
- **AI/claude.md** - Enhanced with quick reference table, clearer structure
- **AI/README.md** - Updated to reflect merged file structure

### Removed
- **AI/agents/** directory - Merged into single `agents.md`
- **AI/skills/** directory - Merged into single `skills.md`
- Kept **AI/prompts/** for granular individual prompts (optional use)

### Why
- Simpler structure: fewer files to read
- Prompts stay atomic (small task = perfect execution)
- Agents/skills are context, not tasks - better as single reference
- `CLAUDE.md` in root forces new chats to read instructions

---

## [2026-01-23] - Documentation Sync & Keyboard Controls

### Added
- **frontend/src/views/Canvas.svelte** - Full keyboard/touch support:
  - **Keyboard shortcuts**: WASD/Arrows to pan, +/- zoom, 1-5 quick zoom, Home/0 reset, R random, / search, ? help
  - **Touch gestures**: Pinch to zoom, single finger drag to pan
  - **Double-click**: Toggle between 1x and 1.5x zoom
  - **Help modal**: Press ? or click ? button to see all shortcuts

### Changed
- **frontend/src/views/Canvas.svelte** - Layout refinements:
  - Smaller cards (160px base unit, was 200px)
  - Larger gaps (24px, was 16px)
  - More position jitter (+/-40px H, +/-30px V)
  - Posts shuffled randomly on each load
  - URL modal now light background (matches text modal)

### Updated Documentation (brutal honesty sync)
- **AI/claude.md** - Fixed: InputHome HAS search (type `/` or `?`), not "capture-only"
- **AI/architecture.md** - Fixed pages description to match reality
- **AI/agents/frontend.md** - Updated to Svelte 5 runes syntax, DOM tiles (not Canvas API)
- **AI/agents/canvas.md** - Updated line count (~1600), added keyboard shortcuts, fixed styling info
- **README.md** - Added keyboard shortcuts section, fixed tech stack (Svelte 5, not 4)

### Fixed
- Documentation no longer claims "capture-only" for InputHome (it has search)
- Documentation no longer says "Canvas/WebGL" (we use DOM tiles)
- Tech stack correctly says "Svelte 5" not "Svelte 4"

---

## [2026-01-23] - Pinboard Canvas & UX Improvements

### Changed
- **frontend/src/views/Canvas.svelte** - Major pinboard-style update:
  - **Pinboard Look**: Tiles now have slight random rotation (+/- 2°) like papers pinned to a board
  - **Variable Widths**: True freeform masonry with varying tile widths (not just heights)
  - **Jittered Repeat**: Each infinite scroll repeat zone has unique position jitter for organic feel
  - **Left-Click Pan**: Pan canvas by left-click dragging anywhere (including over cards)
  - **Click vs Drag**: Click on card opens it, drag pans - uses 5px threshold to distinguish
  - **Consistent Text Tiles**: All text notes are cream/paper colored (no random black/white flickering)
  - **Light Modal for Text**: Text post modals now have light paper background matching the tile
  - **Clean Image Tiles**: Removed white photo border, clean full-bleed images
  - **Larger Layout**: Grid width scales with content amount to reduce visible repetition
  - **Paper Shadows**: Cards cast realistic pinned-paper shadows

### Fixed
- Text notes no longer randomly alternate between black and white backgrounds
- Text modal now matches tile style (light paper, not dark)
- Image tiles no longer have distracting white border

---

## [2026-01-23] - Flat Canvas Polish & Image Dimensions

### Added
- **backend/src/services/upload.ts** - Image dimension extraction:
  - Added `image-size` package
  - Automatically extracts width/height for uploaded images
  - Stored in metadata for masonry aspect ratio calculation

### Changed
- **frontend/src/views/Canvas.svelte** - Major polish update:
  - Flat canvas (removed 3D perspective tilt)
  - True masonry with variable tile sizes
  - Image tiles use real aspect ratios from metadata
  - Full-bleed image tiles (no "image.png" text overlay)
  - Responsive column count (2-5 based on viewport)
  - Better tile styling with gradients and hover effects
  - Corner vignette instead of center fade
  - System fonts for sharper text

### Updated Documentation
- **AI/agents/canvas.md** - Complete rewrite for flat canvas implementation
- **AI/architecture.md** - Updated Pages/Views description
- **README.md** - Updated features and overview

---

## [2026-01-23] - AI Chat Page

### Added
- **frontend/src/views/AIChat.svelte** - New conversational AI search page:
  - 💬 Chat-style interface with user/assistant messages
  - 🎯 Suggested prompts for empty state
  - 📎 Source references linking back to original posts
  - ⌨️ Auto-resize textarea, Enter to send, Shift+Enter for newline
  - ✨ Typing indicator with animated dots
  - 🎨 Purple/blue gradient design matching app theme

### Changed  
- **frontend/src/App.svelte** - Added 'chat' route, 3-way view switching
- **frontend/src/views/InputHome.svelte** - Added "AI Chat" button in header
- **frontend/src/views/Canvas.svelte** - Added "AI Chat" button in nav bar
- All navigation now uses `{ view: 'input' | 'canvas' | 'chat' }` pattern

---

## [2026-01-23] - True Infinite 2.5D Canvas Implementation

### Added
- **frontend/src/views/Canvas.svelte** - Complete rewrite with true Canvas 2D rendering:
  - 🌍 **Globe perspective illusion**: Edges subtly curve/fade, center stays focused
  - 🔍 **3 Zoom LOD levels**: Clusters (zoomed out) → Previews (mid) → Full content (zoomed in)
  - 🎯 **Search as navigation**: Teleports camera to matches, highlights tiles, dims rest
  - 📐 **Masonry layout**: Unequal tile sizes based on content type, organic clustering
  - 🕐 **Time = X-axis**: Posts clustered by day, spread horizontally
  - ⚡ **60fps rendering**: RequestAnimationFrame loop, frustum culling
  - 🖱️ **Pan/zoom with inertia**: Drag to pan, scroll to zoom, smooth physics
  - 🎨 **Color-coded tiles**: Each content type has distinct accent color

### Tech
- HTML5 Canvas 2D (not WebGL) for wide compatibility
- Device pixel ratio scaling for crisp rendering on HiDPI displays
- World coordinate system with camera transformation

---

## [2026-01-23] - R2/GlobeCanvas Vision Alignment

### Changed
- **AI/claude.md** - Updated with R2.md philosophy (capture first, visual memory, search=navigation)
- **AI/architecture.md** - Updated Pages/Views: Home is capture-only, Canvas is 2.5D globe-style
- **AI/agents/canvas.md** - Complete rewrite with globecanvas.md vision:
  - Globe perspective illusion (not real 3D)
  - Masonry layout (unequal tile sizes)
  - Zoom LOD levels (clusters → previews → full content)
  - Search as camera teleportation (not list filtering)
  - Time=longitude, similarity=latitude layout
- **README.md** - Updated overview with R2 philosophy, fixed AI model name

### Notes - Remaining Gaps vs R2.md Vision

| Feature | R2/GlobeCanvas Vision | Current State |
|---------|----------------------|---------------|
| ✅ Canvas | 2.5D globe masonry, pan/zoom | **IMPLEMENTED** |
| ✅ Search | Teleport camera, highlight | **IMPLEMENTED** |
| ✅ Zoom | 3 LOD levels | **IMPLEMENTED** |
| ⏳ Home | Capture-only, no search | Has `/` search mode |
| ⏳ AI Chat | Separate page | Not implemented |

---

## [2026-01-23] - New Browse UI (DOM-based Grid)

### Changed
- **frontend/src/views/Canvas.svelte** - Complete rewrite from blurry Canvas API to crisp DOM-based grid
  - Replaced HTML5 Canvas with CSS Grid layout (sharp on all DPI screens)
  - Added Grid/List view toggle
  - Pill-style content type filters with colors
  - Modern glassmorphism header with blur backdrop
  - Smooth hover animations with subtle lift effect
  - Responsive design for mobile
  - Image thumbnails with zoom-on-hover
  - Gradient overlays on media cards

### Removed
- Removed 2.5D perspective/globe effect (was causing blur)
- Removed pan/zoom canvas controls
- Removed masonry layout (now clean CSS grid)

---

## [2026-01-23] - Switch to GPT-OSS-20B Model

### Changed
- **backend/src/services/ai.ts** - Updated model from `llama-3.1-70b-versatile` to `openai/gpt-oss-20b`
- Updated all AI documentation to reflect GPT-OSS-20B model

---

## [2026-01-23] - Documentation Sync with Codebase

### Changed
- **AI/agents/ai.md** - Updated model name from `GPT-OSS-20B` to `llama-3.1-70b-versatile` to match actual Groq API usage
- **AI/agents/backend.md** - Updated DuckDB package reference from `duckdb` to `@duckdb/node-api`
- **AI/architecture.md** - Updated Groq model name in system diagram
- **AI/claude.md** - Updated AI API model name in tech stack

### Notes
- Full code review completed to ensure MD files accurately reflect implementation
- Current structure:
  - Backend: Express.js + SQLite + DuckDB with @duckdb/node-api
  - Frontend: Svelte 4 with Canvas API (InputHome, Canvas, PostDetail components)
  - AI: Groq llama-3.1-70b-versatile for tagging/tasks/chat
  - Uploads: File storage with OG image caching for URLs

---

## [2026-01-23] - Project Initialization & Core Implementation

### Added
- **Root Config**
  - `package.json` - pnpm monorepo with workspaces
  - `pnpm-workspace.yaml` - workspace configuration
  - `tsconfig.base.json` - shared TypeScript config
  - `.env.example` - environment template
  - `.gitignore` - standard ignores

- **Backend (`backend/`)**
  - Express.js server with Node 20
  - SQLite database with better-sqlite3
  - Schema: posts, tags, tasks tables
  - API endpoints:
    - `POST/GET/DELETE /api/posts` - Post CRUD
    - `POST/GET/DELETE /api/tags` - Tag management
    - `POST/GET/PATCH/DELETE /api/tasks` - Task management
    - `GET /api/search` - Full-text search
    - `POST /api/ai/suggest`, `/api/ai/chat` - AI stubs
  - Services layer for business logic
  - Config management with dotenv

- **Frontend (`frontend/`)**
  - Svelte 4 + Vite setup
  - Two views:
    - **InputHome** - Black screen, single input, capture-only
    - **Canvas** - Infinite canvas with pan/zoom, post cards
  - API client library
  - Keyboard navigation (Enter to save, Tab to browse, Esc to return)

### Tech Stack
- Backend: Express.js, Node 20, SQLite (better-sqlite3)
- Frontend: Svelte 4, Vite, Canvas API
- Package Manager: pnpm (monorepo)

---

## [2026-01-23] - AI Integration & Enhanced UI

### Added
- **DuckDB Integration**
  - Migrated from `duckdb` to `@duckdb/node-api` (pre-compiled binaries, 10x faster install)
  - Full-text search with DuckDB FTS extension
  - Sync posts from SQLite to DuckDB for analytics

- **Groq AI Service**
  - `backend/src/services/ai.ts` - AI service with Groq API
  - Functions: `suggestTags()`, `extractTasks()`, `chat()`
  - Uses `llama-3.1-70b-versatile` model
  - Toggleable via `AI_ENABLED` env var

- **Enhanced API Routes**
  - `POST /api/ai/suggest` - Suggest tags/tasks for new content
  - `POST /api/ai/suggest/:postId` - Suggest for existing post
  - `POST /api/ai/chat` - General AI chat endpoint

- **Frontend Enhancements**
  - **InputHome.svelte**: Search-as-you-type mode (type `/` to search)
  - **PostDetail.svelte**: Modal for viewing/editing post tags and tasks
  - **Canvas.svelte**: 
    - Click-to-select posts (opens PostDetail modal)
    - Hover effects on cards
    - Faceted filters by content type
    - Keyboard shortcuts (Esc to close modal)
  - **API client**: Added `api.ai.suggest()` and `api.ai.chat()` methods

### Tech Stack Updates
- Added: @duckdb/node-api, groq-sdk
- Removed: slow duckdb package (was compiling from source)

---

## [2026-01-23] - File Upload & Multi-Media Support

### Added
- **Upload Service** (`backend/src/services/upload.ts`)
  - File storage with date-based folders (YYYY/MM)
  - Base64 file upload support
  - MIME type detection and content_type mapping
  - URL metadata extraction (title, description)
  
- **Upload Routes** (`backend/src/routes/upload.ts`)
  - `POST /api/upload` - Upload file (base64 encoded)
  - `POST /api/upload/url` - Save URL with auto-extracted metadata
  - `GET /api/upload/file/:year/:month/:filename` - Serve uploaded files

- **Extended Content Types**
  - Added: `video`, `file` content types
  - Added: `extension` source type
  - Extended metadata: filename, originalName, mimeType, size, title, description

- **Frontend File Drop/Paste**
  - Drag & drop files anywhere on InputHome
  - Paste images/files from clipboard (Ctrl+V)
  - URL auto-detection and submission
  - Upload progress indicator
  - Type-specific icons (📝 text, 🖼️ image, 🎵 audio, 🎬 video, 🔗 url, 📎 file)

- **Canvas Enhancements**
  - Type-specific card colors (different borders for image/audio/video/url)
  - URL cards show extracted title + URL preview
  - Type badges with icons

### Changed
- Increased Express JSON limit to 50MB for file uploads
- Updated API client with `api.upload.file()` and `api.upload.url()` methods
- Updated architecture.md with upload endpoints and extended data model

### Fixed
- DuckDB close() → disconnect() method for @duckdb/node-api compatibility

---

## [2026-01-23] - 2.5D Globe Canvas & Image Display

### Added
- **2.5D Globe Perspective Effect**
  - Curved grid background that bends at edges
  - Cards scale/fade based on distance from center
  - Shadow direction follows perspective angle
  - Toggle with 🌐 button or `P` key
  
- **Image Display in Canvas**
  - Images now render as actual thumbnails in cards
  - Image caching for performance
  - Cover-fit cropping with rounded corners
  - Filename shown below image
  
- **Pinterest-Style Masonry Layout**
  - Variable height cards based on content type
  - Cards stack in shortest column
  - Media cards are taller to showcase images

- **Visual Improvements**
  - Radial gradient background (globe spotlight)
  - Cards sorted by depth (far cards render first)
  - Enhanced hover effects with glow
  - Smooth loading spinner

### Changed
- Canvas layout: grid → masonry (Pinterest-style)
- Card shadows follow perspective direction
- Better text contrast on dark cards

---

## [2026-01-23] - Atomic Prompts & Full Context

### Added
- Populated all MD files with project-specific content from PRD (r1.md) and architecture (a1.md)
- Added atomic prompts (small task, perfect execution):
  - `analyze.md`, `plan.md`, `implement.md`, `implement-api.md`, `implement-db.md`
  - `implement-component.md`, `implement-canvas.md`, `fix.md`, `refactor-function.md`
  - `test.md`, `add-types.md`, `add-env.md`, `review-code.md`
  - `ai-tags.md`, `ai-tasks.md`, `ai-search.md`
- Added atomic skills:
  - `read-context.md`, `break-down.md`, `write-code.md`
  - `verify-change.md`, `fix-error.md`, `update-changelog.md`
- Added `agents/search.md` for FTS and faceted search

### Changed
- Updated `claude.md` with full project summary and locked tech stack
- Updated `rules.md` with Express, DB, Frontend, AI integration rules
- Updated `architecture.md` with full system diagram, data model, API endpoints
- Updated all agent files with project-specific patterns and constraints
- Removed generic prompts (code.md, refactor.md, debug.md, review.md)
- Removed generic skills (replaced with atomic versions)

---

## [2026-01-23] - Initial Setup

### Added
- Created AI workflow directory structure
- Added `AI/claude.md` - Claude's persistent memory and rules
- Added `AI/rules.md` - Engineering standards
- Added `AI/architecture.md` - System design documentation
- Added `AI/mistakes.md` - AI mistake tracking
- Added `AI/agents/` directory with role-based personas
- Added `AI/prompts/` directory with reusable prompts
- Added `AI/skills/` directory with skill definitions

### Changed
- Moved `README.md` to project root
- Moved `CHANGELOG.md` to project root
- Reorganized: project files in root, agentic files in AI/

---

## [2026-01-23] - Standardized UI Color System

### Added
- **frontend/src/app.css** - Created standardized 5-color CSS variable system:
  - `--color-bg: #08080c` (near black - main background)
  - `--color-surface: #121218` (dark surface - cards, modals)
  - `--color-primary: #6366f1` (indigo - buttons, highlights, accents)
  - `--color-muted: #71717a` (zinc gray - secondary text)
  - `--color-fg: #fafafa` (near white - main text)
  - `--color-border: #1e1e26` (borders)
  - `--color-primary-hover: #818cf8` (hover state)
  - `--color-primary-dim: rgba(99, 102, 241, 0.15)` (subtle backgrounds)
  - `--paper-light: linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%)` (cream paper for ALL content previews)
  - `--paper-text-dark: #1a1a1a` (dark text on paper)
  - `--paper-text-muted: #555` (muted text on paper)

### Changed
- **frontend/src/components/PostDetail.svelte** - Replaced all hardcoded hex colors with CSS variables:
  - Modal, close button, sections, tags, tasks, AI section all use standardized colors
  - ALL preview types (image, video, audio, file, URL, text) now use light paper gradient
  
- **frontend/src/views/InputHome.svelte** - Full color standardization:
  - Home container, shortcuts modal, logo, nav buttons use CSS variables
  - Input container, textarea, buttons, hints, quick actions all standardized
  - Toast, results, recent items use consistent color palette
  
- **frontend/src/views/Canvas.svelte** - Complete color overhaul:
  - Canvas wrapper, floating nav, search box use CSS variables
  - All tile types use light paper gradient for consistency
  - Modal overlay, modal content, modal close buttons standardized
  - Help modal, shortcuts, kbd elements all use CSS variables
  - Tags, meta info, footers all use standardized colors

### Why
- Eliminated inconsistent hardcoded hex values across the entire frontend
- ALL content types now use consistent light paper (cream gradient) styling
- Easy theme maintenance with centralized CSS variables
- Consistent visual identity across all views and components

---
