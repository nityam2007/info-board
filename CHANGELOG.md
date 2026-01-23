# CHANGELOG

> **RULE: This file is APPEND-ONLY. Always update at end of every query.**

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
