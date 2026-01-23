<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api, type Post } from '$lib/api';
  import { Search, ChevronLeft, Loader2, Bot } from 'lucide-svelte';

  interface Props {
    initialSearch?: string;
    initialPostId?: string;
    onnavigate?: (detail?: { view?: 'input' | 'canvas' | 'chat' }) => void;
  }

  let { initialSearch = '', initialPostId = '', onnavigate }: Props = $props();

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  let containerEl: HTMLDivElement;
  let posts = $state<Post[]>([]);
  let loading = $state(true);
  let searchQuery = $state(initialSearch);
  let selectedPost = $state<Post | null>(null);
  let highlightedIds = $state<Set<string>>(new Set());

  // Camera state (pan position, no perspective)
  let camera = $state({
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1,
    velocityX: 0,
    velocityY: 0,
  });

  // Interaction state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartCamX = 0;
  let dragStartCamY = 0;
  let animationId: number;
  
  // Keyboard/touch state
  let keysPressed = new Set<string>();
  let showHelp = $state(false);
  let touchStartDist = 0;
  let touchStartZoom = 1;

  // Tile positions (calculated once, stored in world space)
  interface Tile {
    post: Post;
    x: number;
    y: number;
    width: number;
    height: number;
    column: number;
  }
  let tiles = $state<Tile[]>([]);

  // Layout constants - responsive column count
  const GAP = 20;
  const MIN_TILE_WIDTH = 260;
  const MAX_TILE_WIDTH = 340;
  
  function getColumnCount(): number {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 768) return 2;
    if (width < 1200) return 3;
    if (width < 1600) return 4;
    return 5;
  }

  // Colors by content type
  const TYPE_COLORS: Record<string, string> = {
    text: '#3f3f46',
    image: '#1e3a5f',
    audio: '#14532d',
    video: '#4a1d5c',
    url: '#3730a3',
    file: '#78350f',
  };

  const TYPE_ACCENTS: Record<string, string> = {
    text: '#71717a',
    image: '#3b82f6',
    audio: '#22c55e',
    video: '#d946ef',
    url: '#6366f1',
    file: '#f59e0b',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INFINITE GLOBE CANVAS - Wraps in all directions like a torus
  // ═══════════════════════════════════════════════════════════════════════════

  let layoutWidth = $state(0);
  let layoutHeight = $state(0);

  // Seeded random for consistent but varied sizing
  function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // Generate a second random from same seed
  function seededRandom2(seed: number): number {
    const x = Math.sin(seed * 1.5 + 7) * 10000;
    return x - Math.floor(x);
  }

  function calculateMasonryLayout(posts: Post[]): Tile[] {
    const tiles: Tile[] = [];
    
    // Freeform masonry - variable widths, organic placement
    const gap = 24; // Larger gap for less clutter
    const baseUnit = 160; // Smaller base unit for less clutter
    
    // Width options: more conservative multipliers
    const widthMultipliers = [1, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
    
    // Rhombus-like layout - moderately wide, grows tall
    // This creates a more square/diamond distribution
    const gridWidth = 2800; // Wider for more spread
    
    // Height map: for each x pixel, track the lowest available y
    const resolution = 10; // Resolution of height tracking
    const heightMap: number[] = new Array(Math.ceil(gridWidth / resolution)).fill(gap);
    
    // Shuffle posts randomly for varied layout each load
    const shuffledPosts = [...posts].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffledPosts.length; i++) {
      const post = shuffledPosts[i];
      const seed = post.id.charCodeAt(0) + (post.id.charCodeAt(1) || 0) + i;
      const rand1 = seededRandom(seed);
      const rand2 = seededRandom2(seed);
      
      // Determine width based on content type and randomness
      let widthMultiplier: number;
      if (post.content_type === 'image' || post.content_type === 'video') {
        // Images can be wider
        widthMultiplier = widthMultipliers[Math.floor(rand1 * widthMultipliers.length)];
      } else if (post.content_type === 'url') {
        // URLs are medium-sized
        widthMultiplier = [1, 1.2, 1.4][Math.floor(rand1 * 3)];
      } else {
        // Text notes vary
        widthMultiplier = [1, 1.2, 1.5][Math.floor(rand1 * 3)];
      }
      
      const width = Math.round(baseUnit * widthMultiplier);
      
      // Determine height based on content
      let height: number;
      if (post.content_type === 'image' || post.content_type === 'video') {
        const imgWidth = post.metadata?.width as number | undefined;
        const imgHeight = post.metadata?.height as number | undefined;
        
        if (imgWidth && imgHeight) {
          const aspect = imgHeight / imgWidth;
          height = Math.round(width * aspect);
          height = Math.max(120, Math.min(500, height));
        } else {
          // Random aspect for images without metadata
          const aspects = [0.75, 1, 1.25, 1.5, 0.66];
          height = Math.round(width * aspects[Math.floor(rand2 * aspects.length)]);
        }
      } else if (post.content_type === 'url') {
        const hasImage = post.metadata?.ogImage || post.metadata?.ogImageLocal;
        if (hasImage) {
          height = 180 + Math.floor(rand2 * 120);
        } else {
          height = 80 + Math.floor(rand2 * 60);
        }
      } else if (post.content_type === 'text') {
        const charCount = post.content.length;
        const charsPerLine = Math.floor(width / 8);
        const lines = Math.ceil(charCount / charsPerLine);
        height = Math.max(100, Math.min(400, 50 + lines * 20));
      } else if (post.content_type === 'audio') {
        height = 90;
      } else {
        height = 120 + Math.floor(rand2 * 80);
      }
      
      // Find best position using height map (bin-packing)
      const tileWidthInCells = Math.ceil(width / resolution);
      let bestX = 0;
      let bestY = Infinity;
      
      // Scan for lowest available position
      for (let startCell = 0; startCell <= heightMap.length - tileWidthInCells; startCell++) {
        // Find max height in this range (the floor level for this position)
        let maxHeightInRange = 0;
        for (let cell = startCell; cell < startCell + tileWidthInCells; cell++) {
          maxHeightInRange = Math.max(maxHeightInRange, heightMap[cell]);
        }
        
        if (maxHeightInRange < bestY) {
          bestY = maxHeightInRange;
          bestX = startCell * resolution;
        }
      }
      
      // Place tile
      const x = bestX;
      const y = bestY;
      
      tiles.push({
        post,
        x,
        y,
        width,
        height,
        column: Math.floor(x / baseUnit), // For reference only
      });
      
      // Update height map for occupied region
      const startCell = Math.floor(x / resolution);
      const endCell = Math.min(heightMap.length - 1, Math.ceil((x + width) / resolution));
      for (let cell = startCell; cell <= endCell; cell++) {
        heightMap[cell] = y + height + gap;
      }
    }
    
    layoutWidth = gridWidth + gap;
    layoutHeight = Math.max(...heightMap) + gap;
    
    return tiles;
  }

  // Calculate wrapped tile positions for infinite scroll
  // Both directions wrap for true infinite canvas
  function getWrappedTiles(): Array<Tile & { worldX: number; worldY: number; key: string; rotation: number; offsetJitter: { x: number; y: number } }> {
    if (!containerEl || tiles.length === 0 || layoutWidth === 0 || layoutHeight === 0) return [];
    
    const viewWidth = window.innerWidth / camera.zoom;
    const viewHeight = window.innerHeight / camera.zoom;
    const padding = 300;
    
    // View bounds in world space
    const viewLeft = camera.x - padding;
    const viewRight = camera.x + viewWidth + padding;
    const viewTop = camera.y - padding;
    const viewBottom = camera.y + viewHeight + padding;
    
    // Infinite wrapping in both directions
    const repeatX = Math.ceil((viewRight - viewLeft) / layoutWidth) + 2;
    const repeatY = Math.ceil((viewBottom - viewTop) / layoutHeight) + 2;
    const startTileX = Math.floor(viewLeft / layoutWidth);
    const startTileY = Math.floor(viewTop / layoutHeight);
    
    const wrappedTiles: Array<Tile & { worldX: number; worldY: number; key: string; rotation: number; offsetJitter: { x: number; y: number } }> = [];
    
    for (let tx = startTileX; tx < startTileX + repeatX; tx++) {
      for (let ty = startTileY; ty < startTileY + repeatY; ty++) {
        const offsetX = tx * layoutWidth;
        const offsetY = ty * layoutHeight;
        
        // Create unique jitter seed for this zone
        const zoneSeed = tx * 1000 + ty * 37;
        
        for (let i = 0; i < tiles.length; i++) {
          const tile = tiles[i];
          
          // Per-tile jitter based on zone + tile index for organic feel
          const jitterSeed = zoneSeed + i * 7;
          const jitterX = (seededRandom(jitterSeed) - 0.5) * 80; // +/- 40px horizontal
          const jitterY = (seededRandom(jitterSeed + 1) - 0.5) * 60; // +/- 30px vertical
          const rotation = (seededRandom(jitterSeed + 2) - 0.5) * 5; // +/- 2.5 degrees
          
          const worldX = tile.x + offsetX + jitterX;
          const worldY = tile.y + offsetY + jitterY;
          
          // Frustum culling
          if (worldX + tile.width > viewLeft && 
              worldX < viewRight &&
              worldY + tile.height > viewTop && 
              worldY < viewBottom) {
            wrappedTiles.push({
              ...tile,
              worldX,
              worldY,
              key: `${tile.post.id}-${tx}-${ty}`,
              rotation,
              offsetJitter: { x: jitterX, y: jitterY },
            });
          }
        }
      }
    }
    
    return wrappedTiles;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA & PHYSICS (Flat plane, no perspective)
  // ═══════════════════════════════════════════════════════════════════════════

  function animate() {
    const friction = 0.92;
    const smoothing = 0.15;

    // Apply velocity with friction (inertia)
    camera.x += camera.velocityX;
    camera.y += camera.velocityY;
    camera.velocityX *= friction;
    camera.velocityY *= friction;

    // Smooth zoom
    camera.zoom += (camera.targetZoom - camera.zoom) * smoothing;

    // Smooth pan to target (for search teleport)
    if (Math.abs(camera.targetX - camera.x) > 1 || Math.abs(camera.targetY - camera.y) > 1) {
      camera.x += (camera.targetX - camera.x) * smoothing;
      camera.y += (camera.targetY - camera.y) * smoothing;
    }

    animationId = requestAnimationFrame(animate);
  }

  function teleportTo(x: number, y: number, zoom = 1) {
    camera.targetX = x - (window.innerWidth / 2) / zoom;
    camera.targetY = y - (window.innerHeight / 2) / zoom;
    camera.targetZoom = zoom;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Track if we actually dragged vs just clicked
  let hasDragged = false;
  const DRAG_THRESHOLD = 5;

  function handleMouseDown(e: MouseEvent) {
    // Left-click = pan from anywhere
    if (e.button !== 0) return;
    
    isDragging = true;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCamX = camera.x;
    dragStartCamY = camera.y;
    containerEl.style.cursor = 'grabbing';
  }

  function handleContextMenu(e: MouseEvent) {
    // Allow context menu
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;

    const dx = (e.clientX - dragStartX) / camera.zoom;
    const dy = (e.clientY - dragStartY) / camera.zoom;
    
    // Check if we've moved enough to count as a drag
    if (Math.abs(e.clientX - dragStartX) > DRAG_THRESHOLD || Math.abs(e.clientY - dragStartY) > DRAG_THRESHOLD) {
      hasDragged = true;
    }

    camera.x = dragStartCamX - dx;
    camera.y = dragStartCamY - dy;
    camera.targetX = camera.x;
    camera.targetY = camera.y;

    // Track velocity for inertia
    camera.velocityX = -dx * 0.1;
    camera.velocityY = -dy * 0.1;
  }

  function handleMouseUp() {
    isDragging = false;
    containerEl.style.cursor = 'grab';
  }
  
  // Handle tile click - only if we didn't drag
  function handleTileClick(post: Post) {
    if (!hasDragged) {
      selectedPost = post;
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(2, camera.targetZoom * zoomFactor));
    
    // Zoom toward mouse position
    const rect = containerEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = camera.x + mouseX / camera.zoom;
    const worldY = camera.y + mouseY / camera.zoom;
    
    camera.targetZoom = newZoom;
    
    // Adjust position to zoom toward mouse
    camera.targetX = worldX - mouseX / newZoom;
    camera.targetY = worldY - mouseY / newZoom;
  }

  // Double-click to zoom in/out
  function handleDoubleClick(e: MouseEvent) {
    const rect = containerEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = camera.x + mouseX / camera.zoom;
    const worldY = camera.y + mouseY / camera.zoom;
    
    // Toggle between zoomed in and default
    const newZoom = camera.zoom < 1.3 ? 1.5 : 1;
    
    camera.targetZoom = newZoom;
    camera.targetX = worldX - mouseX / newZoom;
    camera.targetY = worldY - mouseY / newZoom;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const PAN_SPEED = 20;
  const ZOOM_STEP = 0.15;
  let keyboardInterval: ReturnType<typeof setInterval> | null = null;

  function startKeyboardLoop() {
    if (keyboardInterval) return;
    keyboardInterval = setInterval(() => {
      let moved = false;
      if (keysPressed.has('w') || keysPressed.has('arrowup')) {
        camera.y -= PAN_SPEED / camera.zoom;
        moved = true;
      }
      if (keysPressed.has('s') || keysPressed.has('arrowdown')) {
        camera.y += PAN_SPEED / camera.zoom;
        moved = true;
      }
      if (keysPressed.has('a') || keysPressed.has('arrowleft')) {
        camera.x -= PAN_SPEED / camera.zoom;
        moved = true;
      }
      if (keysPressed.has('d') || keysPressed.has('arrowright')) {
        camera.x += PAN_SPEED / camera.zoom;
        moved = true;
      }
      // Keep target in sync so smoothing doesn't fight against keyboard movement
      if (moved) {
        camera.targetX = camera.x;
        camera.targetY = camera.y;
      }
    }, 16); // ~60fps
  }

  function stopKeyboardLoop() {
    if (keyboardInterval) {
      clearInterval(keyboardInterval);
      keyboardInterval = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Skip if user is typing in search box or textarea
    const target = e.target as HTMLElement;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
    
    const key = e.key.toLowerCase();
    keysPressed.add(key);
    
    // Start continuous movement for WASD/arrows
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      startKeyboardLoop();
      return;
    }
    
    switch (key) {
      case '+':
      case '=':
        e.preventDefault();
        camera.targetZoom = Math.min(2, camera.targetZoom + ZOOM_STEP);
        break;
      case '-':
      case '_':
        e.preventDefault();
        camera.targetZoom = Math.max(0.3, camera.targetZoom - ZOOM_STEP);
        break;
      case '1':
        camera.targetZoom = 0.5;
        break;
      case '2':
        camera.targetZoom = 0.75;
        break;
      case '3':
        camera.targetZoom = 1;
        break;
      case '4':
        camera.targetZoom = 1.25;
        break;
      case '5':
        camera.targetZoom = 1.5;
        break;
      case 'home':
      case '0':
        camera.targetX = -20;
        camera.targetY = -60;
        camera.targetZoom = 1;
        camera.velocityX = 0;
        camera.velocityY = 0;
        break;
      case 'r':
        // Random teleport
        if (tiles.length > 0) {
          const randomTile = tiles[Math.floor(Math.random() * tiles.length)];
          teleportTo(randomTile.x + randomTile.width / 2, randomTile.y + randomTile.height / 2, 1);
        }
        break;
      case '/':
        e.preventDefault();
        // Focus search box
        const searchInput = document.querySelector('.search-box input') as HTMLInputElement;
        searchInput?.focus();
        break;
      case '?':
        e.preventDefault();
        showHelp = !showHelp;
        break;
      case 'escape':
        if (selectedPost) {
          selectedPost = null;
        } else if (showHelp) {
          showHelp = false;
        } else {
          onnavigate?.({ view: 'input' });
        }
        break;
      case 'h':
        // Go to input/home
        onnavigate?.({ view: 'input' });
        break;
      case 'c':
        // Open chat
        onnavigate?.({ view: 'chat' });
        break;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    keysPressed.delete(key);
    
    // Stop keyboard loop if no movement keys pressed
    const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const hasMovementKey = movementKeys.some(k => keysPressed.has(k));
    if (!hasMovementKey) {
      stopKeyboardLoop();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      // Single touch = pan
      isDragging = true;
      hasDragged = false;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragStartCamX = camera.x;
      dragStartCamY = camera.y;
    } else if (e.touches.length === 2) {
      // Two fingers = pinch zoom
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
      touchStartZoom = camera.zoom;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
      const dx = (e.touches[0].clientX - dragStartX) / camera.zoom;
      const dy = (e.touches[0].clientY - dragStartY) / camera.zoom;
      
      if (Math.abs(e.touches[0].clientX - dragStartX) > DRAG_THRESHOLD || 
          Math.abs(e.touches[0].clientY - dragStartY) > DRAG_THRESHOLD) {
        hasDragged = true;
      }

      camera.x = dragStartCamX - dx;
      camera.y = dragStartCamY - dy;
      camera.targetX = camera.x;
      camera.targetY = camera.y;
      camera.velocityX = -dx * 0.1;
      camera.velocityY = -dy * 0.1;
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchStartDist;
      camera.targetZoom = Math.max(0.3, Math.min(2, touchStartZoom * scale));
    }
  }

  function handleTouchEnd() {
    isDragging = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH AS NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSearch() {
    if (!searchQuery.trim()) {
      highlightedIds = new Set();
      return;
    }

    loading = true;
    try {
      const results = await api.search.simple(searchQuery);
      highlightedIds = new Set(results.map(p => p.id));

      // Teleport to first result
      if (results.length > 0) {
        const tile = tiles.find(t => t.post.id === results[0].id);
        if (tile) {
          teleportTo(tile.x + tile.width / 2, tile.y + tile.height / 2, 1);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      loading = false;
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') {
      searchQuery = '';
      highlightedIds = new Set();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TILE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function getMediaUrl(post: Post): string | null {
    if ((post.content_type === 'image' || post.content_type === 'video') && post.metadata?.filename) {
      const date = new Date(post.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `/api/upload/file/${year}/${month}/${post.metadata.filename}`;
    }
    if (post.content_type === 'url' && post.metadata?.ogImageLocal) {
      const date = new Date(post.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `/api/upload/file/${year}/${month}/${post.metadata.ogImageLocal}`;
    }
    if (post.content_type === 'url' && post.metadata?.ogImage) {
      return post.metadata.ogImage as string;
    }
    return null;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  function generateNoteTitle(content: string): string {
    // Generate a short title from content
    const words = content.split(' ').slice(0, 3).join(' ');
    if (words.length > 20) return words.slice(0, 20) + '...';
    return words;
  }

  function shouldBeDarkTile(index: number): boolean {
    // All text tiles are light paper color - no alternation
    // Dark backgrounds are only for images/videos
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  onMount(async () => {
    // Load posts
    loading = true;
    try {
      posts = await api.posts.list(500);
      tiles = calculateMasonryLayout(posts);

      // Start with slight offset for nav bar clearance
      const startY = -60; // Negative so content starts below nav
      camera.x = -20; // Small left padding
      camera.y = startY;
      camera.targetX = -20;
      camera.targetY = startY;

      // Handle initial navigation
      if (initialSearch) {
        searchQuery = initialSearch;
        await handleSearch();
      } else if (initialPostId) {
        const tile = tiles.find(t => t.post.id === initialPostId);
        if (tile) {
          selectedPost = tile.post;
          teleportTo(tile.x + tile.width / 2, tile.y + tile.height / 2, 1);
        }
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      loading = false;
    }

    // Start animation loop
    animate();
    
    // Add keyboard listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  });

  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    stopKeyboardLoop();
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  });

  // Computed transform style - flat canvas (no 3D tilt per user feedback)
  let transformStyle = $derived(
    `transform: scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px);`
  );

  // Force reactivity on camera changes
  let cameraKey = $derived(`${Math.round(camera.x)}-${Math.round(camera.y)}-${camera.zoom.toFixed(2)}-${tiles.length}`);

  // Wrapped infinite tiles - use a function to compute on each render
  function getVisibleTiles() {
    // Touch reactive values
    const _ = cameraKey;
    return getWrappedTiles();
  }
</script>

<div class="canvas-wrapper">
  <!-- Minimal floating nav -->
  <nav class="floating-nav">
    <button class="nav-btn" onclick={() => onnavigate?.({ view: 'input' })}>
      <ChevronLeft size={18} />
    </button>

    <div class="search-box">
      <Search size={14} />
      <input
        type="text"
        placeholder="Search..."
        bind:value={searchQuery}
        onkeydown={handleSearchKeydown}
      />
      {#if loading}
        <Loader2 size={14} class="spin" />
      {/if}
    </div>

    <span class="zoom-label">{Math.round(camera.zoom * 100)}%</span>
    
    <button class="nav-btn help-btn" onclick={() => showHelp = !showHelp} title="Keyboard shortcuts (?)">
      ?
    </button>

    <button class="nav-btn chat-btn" onclick={() => onnavigate?.({ view: 'chat' })}>
      <Bot size={18} />
    </button>
  </nav>
  
  <!-- Help Modal -->
  {#if showHelp}
    <div class="help-overlay" onclick={() => showHelp = false}>
      <div class="help-modal" onclick={(e) => e.stopPropagation()}>
        <h3>⌨️ Keyboard Shortcuts</h3>
        <div class="shortcut-grid">
          <div class="shortcut-group">
            <h4>Navigation</h4>
            <div class="shortcut"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> Pan</div>
            <div class="shortcut"><kbd>R</kbd> Random teleport</div>
            <div class="shortcut"><kbd>Home</kbd> or <kbd>0</kbd> Reset view</div>
          </div>
          <div class="shortcut-group">
            <h4>Zoom</h4>
            <div class="shortcut"><kbd>+</kbd> / <kbd>-</kbd> Zoom in/out</div>
            <div class="shortcut"><kbd>1</kbd>-<kbd>5</kbd> Quick zoom levels</div>
            <div class="shortcut"><kbd>Scroll</kbd> Zoom at cursor</div>
            <div class="shortcut"><kbd>Double-click</kbd> Toggle zoom</div>
          </div>
          <div class="shortcut-group">
            <h4>Views</h4>
            <div class="shortcut"><kbd>H</kbd> Home (capture)</div>
            <div class="shortcut"><kbd>C</kbd> AI Chat</div>
            <div class="shortcut"><kbd>/</kbd> Focus search</div>
          </div>
          <div class="shortcut-group">
            <h4>Other</h4>
            <div class="shortcut"><kbd>Esc</kbd> Close modal</div>
            <div class="shortcut"><kbd>?</kbd> Toggle this help</div>
          </div>
          <div class="shortcut-group">
            <h4>Mouse & Touch</h4>
            <div class="shortcut"><kbd>Drag</kbd> Pan canvas</div>
            <div class="shortcut"><kbd>Click</kbd> Open post</div>
            <div class="shortcut"><kbd>Pinch</kbd> Zoom (touch)</div>
          </div>
        </div>
        <button class="close-help" onclick={() => showHelp = false}>Got it!</button>
      </div>
    </div>
  {/if}

  <!-- Infinite Canvas Container -->
  <div
    bind:this={containerEl}
    class="canvas-container"
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
    onwheel={handleWheel}
    ondblclick={handleDoubleClick}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    role="application"
    aria-label="Infinite canvas"
    tabindex="0"
  >
    <!-- Background with vignette -->
    <div class="canvas-bg"></div>

    <!-- Tiles layer -->
    <div class="tiles-layer" style={transformStyle}>
      {#each getVisibleTiles() as tile, index (tile.key)}
        {@const isHighlighted = highlightedIds.has(tile.post.id)}
        {@const isDimmed = highlightedIds.size > 0 && !isHighlighted}
        {@const mediaUrl = getMediaUrl(tile.post)}
        {@const tileClass = tile.post.content_type === 'text' 
          ? 'text-tile'
          : tile.post.content_type === 'image' || tile.post.content_type === 'video'
          ? 'image-tile'
          : 'url-tile'}
        
        <button
          class="tile {tileClass}"
          class:highlighted={isHighlighted}
          class:dimmed={isDimmed}
          style="
            left: {tile.worldX}px;
            top: {tile.worldY}px;
            width: {tile.width}px;
            height: {tile.height}px;
            transform: rotate({tile.rotation}deg);
          "
          onclick={() => handleTileClick(tile.post)}
        >
          <!-- Image/Video tile - Clean, no text overlay -->
          {#if tile.post.content_type === 'image' || tile.post.content_type === 'video'}
            <div class="tile-media full">
              {#if mediaUrl}
                <img src={mediaUrl} alt="" loading="lazy" />
              {:else}
                <div class="media-placeholder">
                  <span>📷</span>
                </div>
              {/if}
            </div>

          <!-- URL tile -->
          {:else if tile.post.content_type === 'url'}
            {#if mediaUrl}
              <div class="tile-media url-media">
                <img src={mediaUrl} alt="" loading="lazy" />
              </div>
            {/if}
            <div class="tile-url-content">
              {#if tile.post.metadata?.title && tile.post.metadata.title !== 'Link'}
                <h3 class="tile-title">{tile.post.metadata.title}</h3>
                {#if tile.post.metadata?.description}
                  <p class="tile-desc">{tile.post.metadata.description}</p>
                {/if}
              {:else}
                <p class="tile-desc tile-url-only">{tile.post.content}</p>
              {/if}
              <span class="tile-domain">{getDomain(tile.post.content)}</span>
            </div>

          <!-- Text tile - Note style -->
          {:else if tile.post.content_type === 'text'}
            <div class="tile-text-content">
              <h4 class="note-title">{generateNoteTitle(tile.post.content)}</h4>
              <p>{tile.post.content}</p>
            </div>
            <div class="tile-footer">
              <span class="tile-date">{formatDate(tile.post.created_at)}</span>
            </div>

          <!-- Audio tile -->
          {:else if tile.post.content_type === 'audio'}
            <div class="tile-audio">
              <div class="audio-wave"></div>
              <span class="audio-label">Audio</span>
            </div>
            <div class="tile-footer">
              <span class="tile-date">{formatDate(tile.post.created_at)}</span>
            </div>

          <!-- File tile -->
          {:else}
            <div class="tile-file">
              <span class="file-name">{tile.post.metadata?.filename || 'File'}</span>
            </div>
            <div class="tile-footer">
              <span class="tile-date">{formatDate(tile.post.created_at)}</span>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Post Detail Modal -->
  {#if selectedPost}
    {@const modalMediaUrl = getMediaUrl(selectedPost)}
    {@const isTextPost = selectedPost.content_type === 'text'}
    {@const isUrlPost = selectedPost.content_type === 'url'}
    {@const isAudioPost = selectedPost.content_type === 'audio'}
    {@const isFilePost = selectedPost.content_type === 'file'}
    {@const isMediaPost = selectedPost.content_type === 'image' || selectedPost.content_type === 'video'}
    <div class="modal-overlay" onclick={() => selectedPost = null} role="dialog" aria-modal="true">
      <div class="modal-content {isMediaPost ? 'modal-media' : 'modal-paper'}" onclick={(e) => e.stopPropagation()}>
        <button class="modal-close" onclick={() => selectedPost = null}>×</button>
        
        <!-- Image/Video Modal -->
        {#if selectedPost.content_type === 'image' || selectedPost.content_type === 'video'}
          <div class="modal-image-container">
            {#if modalMediaUrl}
              {#if selectedPost.content_type === 'video'}
                <video src={modalMediaUrl} controls class="modal-image"></video>
              {:else}
                <img src={modalMediaUrl} alt="" class="modal-image" />
              {/if}
            {/if}
          </div>
          <div class="modal-image-footer">
            <div class="modal-image-info">
              {#if selectedPost.metadata?.width && selectedPost.metadata?.height}
                <span class="modal-dimensions">{selectedPost.metadata.width} × {selectedPost.metadata.height}</span>
              {/if}
              {#if selectedPost.metadata?.size}
                <span class="modal-size">{(selectedPost.metadata.size / 1024).toFixed(1)} KB</span>
              {/if}
            </div>
            <span class="modal-date">{new Date(selectedPost.created_at).toLocaleString()}</span>
          </div>
        
        <!-- URL Modal -->
        {:else if selectedPost.content_type === 'url'}
          {#if modalMediaUrl}
            <div class="modal-url-image">
              <img src={modalMediaUrl} alt="" />
            </div>
          {/if}
          <div class="modal-body">
            <h2 class="modal-url-title">{selectedPost.metadata?.title || 'Link'}</h2>
            {#if selectedPost.metadata?.description}
              <p class="modal-url-desc">{selectedPost.metadata.description}</p>
            {/if}
            <a href={selectedPost.content} target="_blank" rel="noopener noreferrer" class="modal-url-link">
              {selectedPost.content}
            </a>
            <div class="modal-meta">{new Date(selectedPost.created_at).toLocaleString()}</div>
          </div>
        
        <!-- Text Modal -->
        {:else if selectedPost.content_type === 'text'}
          <div class="modal-body modal-text-body">
            <p class="modal-text-content">{selectedPost.content}</p>
            {#if selectedPost.tags && selectedPost.tags.length > 0}
              <div class="modal-tags">
                {#each selectedPost.tags as tag}
                  <span class="tag">#{tag.name}</span>
                {/each}
              </div>
            {/if}
            <div class="modal-meta">{new Date(selectedPost.created_at).toLocaleString()}</div>
          </div>
        
        <!-- Audio Modal -->
        {:else if selectedPost.content_type === 'audio'}
          <div class="modal-body">
            <div class="modal-audio-player">
              {#if modalMediaUrl}
                <audio src={modalMediaUrl} controls class="modal-audio"></audio>
              {/if}
            </div>
            <div class="modal-meta">{new Date(selectedPost.created_at).toLocaleString()}</div>
          </div>
        
        <!-- File Modal -->
        {:else}
          <div class="modal-body">
            <div class="modal-file-info">
              <span class="modal-file-icon">📄</span>
              <span class="modal-file-name">{selectedPost.metadata?.originalName || selectedPost.content}</span>
            </div>
            {#if selectedPost.metadata?.size}
              <span class="modal-file-size">{(selectedPost.metadata.size / 1024).toFixed(1)} KB</span>
            {/if}
            <div class="modal-meta">{new Date(selectedPost.created_at).toLocaleString()}</div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .canvas-wrapper {
    width: 100%;
    height: 100vh;
    background: var(--color-bg, #08080c);
    overflow: hidden;
    position: relative;
  }

  /* Floating nav - minimal */
  .floating-nav {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(8, 8, 12, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    z-index: 100;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.15s;
  }

  .nav-btn:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-fg, #fafafa);
  }

  .chat-btn {
    color: var(--color-primary-hover, #818cf8);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 10px;
    color: var(--color-muted, #71717a);
    transition: all 0.2s;
  }
  
  .search-box:focus-within {
    background: rgba(18, 18, 24, 0.95);
    border-color: var(--color-primary, #6366f1);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .search-box input {
    width: 180px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
    font-weight: 400;
  }

  .search-box input::placeholder {
    color: var(--color-muted, #71717a);
  }
  
  .search-box :global(.spin) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .zoom-label {
    font-size: 11px;
    color: var(--color-muted, #71717a);
    font-family: monospace;
    min-width: 40px;
    text-align: center;
  }

  /* Canvas container */
  .canvas-container {
    width: 100%;
    height: 100%;
    cursor: grab;
    position: relative;
    overflow: hidden;
  }

  .canvas-container:active {
    cursor: grabbing;
  }

  /* Dramatic vignette at corners only */
  .canvas-bg {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse 120% 120% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 80%, #000 100%);
    pointer-events: none;
    z-index: 10;
  }

  .tiles-layer {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    will-change: transform;
    transform-style: preserve-3d;
  }

  /* Base tile styles - Pinboard style with slight mess */
  .tile {
    position: absolute;
    border-radius: 4px; /* More paper-like, less rounded */
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow 0.2s ease, z-index 0s;
    display: flex;
    flex-direction: column;
    text-align: left;
    /* Paper-like shadow - looks pinned to board */
    box-shadow: 
      2px 3px 8px rgba(0,0,0,0.3),
      0 1px 2px rgba(0,0,0,0.2);
    /* Don't override rotation on hover */
    transform-origin: center center;
  }

  .tile:hover {
    box-shadow: 
      4px 6px 20px rgba(0,0,0,0.4),
      0 2px 4px rgba(0,0,0,0.3);
    z-index: 10;
  }

  .tile.highlighted {
    box-shadow: 0 0 0 3px var(--color-primary, #6366f1), 4px 6px 20px rgba(99, 102, 241, 0.4);
    z-index: 15;
  }

  .tile.dimmed {
    opacity: 0.3;
  }

  /* Text tiles - Paper note pinned to board */
  .tile.text-tile {
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border: none;
    /* Torn paper edge effect */
    box-shadow: 
      2px 3px 8px rgba(0,0,0,0.25),
      0 1px 2px rgba(0,0,0,0.15),
      inset 0 0 30px rgba(0,0,0,0.02);
  }

  /* Dark text tiles - Also use light paper for consistency */
  .tile.text-tile-dark {
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border: none;
    box-shadow: 
      2px 3px 8px rgba(0,0,0,0.25),
      0 1px 2px rgba(0,0,0,0.15);
  }

  /* Image/Photo tiles - Clean photo look */
  .tile.image-tile {
    background: #111;
    border: none;
    overflow: hidden;
    padding: 0;
  }

  .tile.image-tile:hover .tile-media.full img {
    transform: scale(1.02);
  }

  /* Full media tiles (images fill entire card) */
  .tile-media.full {
    position: absolute;
    inset: 0;
    border-radius: 4px;
    overflow: hidden;
  }

  .tile-media.full img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .media-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%);
    font-size: 32px;
    opacity: 0.5;
  }

  /* URL tiles */
  .tile.url-tile {
    background: #fff;
    border: 1px solid rgba(0,0,0,0.08);
  }

  .tile.url-tile:hover {
    border-color: rgba(0,0,0,0.12);
  }

  /* Media tiles */
  .tile-media {
    flex: 1;
    overflow: hidden;
    background: #222;
  }

  .tile-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .url-media {
    height: 160px;
    flex: none;
    background: linear-gradient(145deg, #e8e8e8 0%, #d8d8d8 100%);
  }

  .url-media img {
    transition: transform 0.3s ease;
  }

  .tile.url-tile:hover .url-media img {
    transform: scale(1.03);
  }

  /* URL content - paper style */
  .tile-url-content {
    padding: 12px 14px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: #fafafa;
  }

  .tile-url-only {
    font-size: 12px;
    color: var(--paper-text-muted, #555);
    word-break: break-all;
    -webkit-line-clamp: 3;
  }

  .tile-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--paper-text-dark, #1a1a1a);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .tile-desc {
    font-size: 11px;
    color: var(--paper-text-muted, #555);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
  }

  .tile-domain {
    font-size: 10px;
    color: var(--color-primary, #6366f1);
    font-weight: 500;
  }

  /* Text tiles - clean note style */
  .tile-text-content {
    flex: 1;
    padding: 14px 16px 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .tile-text-content .note-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--paper-text-dark, #1a1a1a);
    margin: 0 0 10px 0;
    font-family: system-ui, -apple-system, sans-serif;
    letter-spacing: -0.2px;
    line-height: 1.3;
  }

  .tile-text-content p {
    font-size: 13px;
    color: var(--paper-text-muted, #555);
    line-height: 1.6;
    margin: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Audio tiles - use light paper */
  .tile-audio {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
  }

  .audio-wave {
    width: 60%;
    height: 24px;
    background: linear-gradient(90deg, 
      #22c55e 2px, transparent 2px,
      transparent 6px, #22c55e 6px, #22c55e 8px, transparent 8px,
      transparent 12px, #22c55e 12px, #22c55e 16px, transparent 16px
    );
    background-size: 16px 100%;
    opacity: 0.5;
    border-radius: 2px;
  }

  .audio-label {
    font-size: 11px;
    color: var(--color-primary, #6366f1);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* File tiles - use light paper */
  .tile-file {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
  }

  .file-name {
    font-size: 12px;
    color: var(--paper-text-muted, #555);
    word-break: break-all;
    text-align: center;
  }

  /* Footer */
  .tile-footer {
    padding: 8px 16px 10px;
    margin-top: auto;
  }

  .tile.text-tile .tile-footer {
    border-top: 1px solid rgba(0, 0, 0, 0.05);
  }

  .tile.text-tile-dark .tile-footer {
    border-top: 1px solid rgba(0, 0, 0, 0.05);
  }

  .tile-date {
    font-size: 11px;
    color: var(--paper-text-muted, #555);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .tile.text-tile-dark .tile-date {
    color: var(--paper-text-muted, #555);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    backdrop-filter: blur(12px);
    padding: 20px;
  }

  .modal-content {
    position: relative;
    background: var(--color-surface, #121218);
    border-radius: 16px;
    max-width: 560px;
    width: 100%;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px var(--color-border, #1e1e26);
  }

  .modal-content.modal-media {
    max-width: 900px;
    background: var(--color-bg, #08080c);
  }

  /* All non-media modals use light paper background */
  .modal-content.modal-paper {
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }

  .modal-content.modal-paper .modal-close {
    color: var(--paper-text-dark, #1a1a1a);
    background: rgba(0,0,0,0.05);
  }

  .modal-content.modal-paper .modal-close:hover {
    background: rgba(0,0,0,0.1);
  }

  .modal-content.modal-paper .modal-body {
    background: transparent;
  }

  .modal-content.modal-paper .modal-url-title,
  .modal-content.modal-paper .modal-text-content,
  .modal-content.modal-paper .modal-file-name {
    color: var(--paper-text-dark, #1a1a1a);
  }

  .modal-content.modal-paper .modal-url-desc,
  .modal-content.modal-paper .modal-meta,
  .modal-content.modal-paper .modal-file-size {
    color: var(--paper-text-muted, #555);
  }

  .modal-content.modal-paper .modal-tags .tag {
    background: rgba(99, 102, 241, 0.2);
    color: #4f46e5;
  }

  .modal-content.modal-paper .modal-meta {
    border-top-color: rgba(0, 0, 0, 0.1);
  }

  .modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    color: var(--color-fg, #fafafa);
    font-size: 20px;
    cursor: pointer;
    z-index: 10;
    transition: all 0.15s;
  }

  .modal-close:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.05);
  }

  /* Image/Video Modal */
  .modal-image-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg, #08080c);
    min-height: 300px;
    max-height: 70vh;
  }

  .modal-image {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }

  .modal-image-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--color-surface, #121218);
    border-top: 1px solid var(--color-border, #1e1e26);
  }

  .modal-image-info {
    display: flex;
    gap: 16px;
  }

  .modal-dimensions, .modal-size {
    font-size: 13px;
    color: var(--color-muted, #71717a);
    font-family: monospace;
  }

  .modal-date {
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }

  /* URL Modal - uses light paper background */
  .modal-url-image {
    width: 100%;
    height: 220px;
    overflow: hidden;
    background: var(--color-bg, #08080c);
  }

  .modal-url-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .modal-url-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--paper-text-dark, #1a1a1a);
    margin: 0 0 12px;
    line-height: 1.3;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .modal-url-desc {
    font-size: 14px;
    color: var(--paper-text-muted, #555);
    line-height: 1.6;
    margin: 0 0 16px;
  }

  .modal-url-link {
    display: inline-block;
    font-size: 13px;
    color: var(--color-primary, #6366f1);
    text-decoration: none;
    word-break: break-all;
    margin-bottom: 16px;
  }

  .modal-url-link:hover {
    text-decoration: underline;
    color: var(--color-primary-hover, #818cf8);
  }

  /* Text Modal body padding */
  .modal-text-body {
    padding: 32px;
  }

  .modal-text-content {
    font-size: 18px;
    line-height: 1.7;
    margin: 0 0 24px;
    white-space: pre-wrap;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Audio Modal */
  .modal-audio-player {
    padding: 20px 0;
  }

  .modal-audio {
    width: 100%;
  }

  /* File Modal */
  .modal-file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .modal-file-icon {
    font-size: 32px;
  }

  .modal-file-name {
    font-size: 16px;
    color: var(--paper-text-dark, #1a1a1a);
    font-weight: 500;
    word-break: break-all;
  }

  .modal-file-size {
    font-size: 13px;
    color: var(--paper-text-muted, #555);
    font-family: monospace;
    display: block;
    margin-bottom: 16px;
  }

  .modal-body {
    padding: 24px;
    background: var(--color-surface, #121218);
  }

  .modal-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .tag {
    padding: 4px 10px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-primary, #6366f1);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .modal-meta {
    color: var(--color-muted, #71717a);
    font-size: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border, #1e1e26);
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Help Button */
  .help-btn {
    font-weight: bold;
    font-size: 14px;
  }

  /* Help Modal */
  .help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .help-modal {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    padding: 24px 32px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .help-modal h3 {
    margin: 0 0 20px;
    font-size: 20px;
    color: var(--color-fg, #fafafa);
    text-align: center;
  }

  .shortcut-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
  }

  .shortcut-group {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.05));
    border-radius: 8px;
    padding: 12px 16px;
  }

  .shortcut-group h4 {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--color-muted, #71717a);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--color-fg, #fafafa);
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  kbd {
    display: inline-block;
    padding: 3px 8px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
    color: var(--color-fg, #fafafa);
    box-shadow: 0 2px 0 var(--color-bg, #08080c);
  }

  .close-help {
    display: block;
    width: 100%;
    margin-top: 24px;
    padding: 12px;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .close-help:hover {
    background: var(--color-primary-hover, #818cf8);
  }
</style>
