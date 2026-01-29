<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Post } from '$lib/api';
  import { 
    Search, ChevronLeft, Loader2, Bot, X, Home, HelpCircle,
    FileText, Image as ImageIcon, Music, Video, Link2, Paperclip,
    Calendar, ExternalLink, ZoomIn, ZoomOut, Compass
  } from 'lucide-svelte';

  interface Props {
    initialSearch?: string;
    initialPostId?: string;
    onnavigate?: (detail?: { view?: 'input' | 'canvas' | 'chat' }) => void;
  }

  let { initialSearch = '', initialPostId = '', onnavigate }: Props = $props();

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPES & CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  interface WorldPost extends Post {
    worldX: number;
    worldY: number;
    size: number;
  }

  const CONTENT_TYPES = [
    { id: 'text', label: 'Notes', icon: FileText, color: '#a3a3a3' },
    { id: 'image', label: 'Images', icon: ImageIcon, color: '#60a5fa' },
    { id: 'url', label: 'Links', icon: Link2, color: '#a78bfa' },
    { id: 'audio', label: 'Audio', icon: Music, color: '#34d399' },
    { id: 'video', label: 'Video', icon: Video, color: '#f472b6' },
    { id: 'file', label: 'Files', icon: Paperclip, color: '#fbbf24' },
  ];

  // Physics constants
  const FRICTION = 0.92;
  const MIN_ZOOM = 0.6;  // Max 60% zoom out
  const MAX_ZOOM = 2.5;
  const FLY_DURATION = 600;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  let posts = $state<Post[]>([]);
  let worldPosts = $state<WorldPost[]>([]);
  let loading = $state(true);
  let selectedPost = $state<Post | null>(null);
  let searchQuery = $state(initialSearch);
  let searchResults = $state<Post[]>([]);
  let showHelp = $state(false);

  // Camera state
  let camera = $state({
    x: 0,
    y: 0,
    zoom: 1,
    vx: 0,
    vy: 0,
  });

  // Interaction state
  let isDragging = $state(false);
  let didDrag = $state(false);  // Track if user actually dragged (vs just clicked)
  let dragStart = { x: 0, y: 0, camX: 0, camY: 0 };
  let lastDragPos = { x: 0, y: 0, time: 0 };
  let isFlying = $state(false);

  // Container reference
  let containerEl: HTMLDivElement;
  let searchInputEl: HTMLInputElement;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  // Animation frame
  let animationId: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // WORLD LAYOUT - Spiral time-based positioning
  // ═══════════════════════════════════════════════════════════════════════════

  function layoutPosts(rawPosts: Post[]): WorldPost[] {
    // Sort by date (newest first)
    const sorted = [...rawPosts].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return sorted.map((post, index) => {
      // Spiral layout: newer posts near center, older spiral outward
      // Using golden angle for even distribution
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = index * goldenAngle;
      const radius = Math.sqrt(index) * 180; // Spread factor
      
      // Add some randomness for organic feel
      const jitterX = (Math.random() - 0.5) * 60;
      const jitterY = (Math.random() - 0.5) * 60;

      // Size varies by content type
      const baseSize = post.content_type === 'image' ? 200 : 
                       post.content_type === 'text' ? 180 :
                       post.content_type === 'url' ? 190 : 160;

      return {
        ...post,
        worldX: Math.cos(angle) * radius + jitterX,
        worldY: Math.sin(angle) * radius + jitterY,
        size: baseSize + (Math.random() - 0.5) * 40,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA & RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  function worldToScreen(worldX: number, worldY: number) {
    const screenX = (worldX - camera.x) * camera.zoom + viewportWidth / 2;
    const screenY = (worldY - camera.y) * camera.zoom + viewportHeight / 2;
    return { x: screenX, y: screenY };
  }

  function screenToWorld(screenX: number, screenY: number) {
    const worldX = (screenX - viewportWidth / 2) / camera.zoom + camera.x;
    const worldY = (screenY - viewportHeight / 2) / camera.zoom + camera.y;
    return { x: worldX, y: worldY };
  }

  // 3D Sphere projection - creates a smooth ball/globe effect
  // Cards shrink gracefully from center to edge while staying readable
  function getGlobeTransform(screenX: number, screenY: number, size: number) {
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    
    // Distance from center in pixels
    const dx = screenX - centerX;
    const dy = screenY - centerY;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    
    // Use larger sphere radius to fill more of the screen
    const sphereRadius = Math.min(viewportWidth, viewportHeight) * 0.8;
    
    // Normalized distance: 0 at center, 1 at sphere edge
    const normalizedDist = Math.min(distPx / sphereRadius, 1.5);
    
    // Zoom affects the "tightness" of the ball (min 0.6 since that's our MIN_ZOOM)
    const zoomFactor = Math.max(0.6, Math.min(1, camera.zoom));
    
    // Scale: smooth cosine curve for natural falloff
    // Center zone (0-30%) stays at full size, then graceful shrink
    const centerZone = 0.3;
    const effectiveDist = Math.max(0, (normalizedDist - centerZone) / (1 - centerZone));
    
    // Cosine interpolation for smooth curve (not harsh exponential)
    const t = Math.min(effectiveDist, 1);
    const smoothT = (1 - Math.cos(t * Math.PI)) / 2; // 0 to 1 smoothly
    
    // Min scale varies with zoom: 40% at 30% zoom, 50% at 100%
    const minScale = 0.4 + zoomFactor * 0.1;
    const scale = 1 - smoothT * (1 - minScale);
    
    // Opacity: gentle fade only at extreme edges
    const opacity = normalizedDist > 1.2 
      ? Math.max(0, 1 - (normalizedDist - 1.2) / 0.3)
      : 1;
    
    // Rotation: gentle tilt for 3D feel, not too extreme
    // Max 35° at edges (readable), 45° at 30% zoom
    const maxTilt = 35 + (1 - zoomFactor) * 10;
    const tiltAmount = smoothT * 0.8; // Softer tilt
    const normalizedDx = dx / (distPx || 1);
    const normalizedDy = dy / (distPx || 1);
    const rotateX = -normalizedDy * tiltAmount * maxTilt;
    const rotateY = normalizedDx * tiltAmount * maxTilt;
    
    // Z-index: center cards on top
    const zIndex = Math.floor((1 - normalizedDist) * 100);

    return {
      scale,
      opacity,
      rotateX,
      rotateY,
      zIndex,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  function animate() {
    // Apply velocity with friction
    if (!isDragging && !isFlying) {
      camera.x += camera.vx;
      camera.y += camera.vy;
      camera.vx *= FRICTION;
      camera.vy *= FRICTION;
      
      // Stop when velocity is negligible
      if (Math.abs(camera.vx) < 0.1) camera.vx = 0;
      if (Math.abs(camera.vy) < 0.1) camera.vy = 0;
    }

    animationId = requestAnimationFrame(animate);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION - Pan, Zoom, Fly
  // ═══════════════════════════════════════════════════════════════════════════

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return; // Left click only
    
    // Don't start drag if clicking on UI elements or cards
    const target = e.target as HTMLElement;
    if (target.closest('.floating-header') || 
        target.closest('.floating-controls') || 
        target.closest('.zoom-indicator') ||
        target.closest('.world-post') ||
        target.closest('.modal-overlay')) {
      return;
    }
    
    isDragging = true;
    didDrag = false;  // Reset drag flag on new pointer down
    camera.vx = 0;
    camera.vy = 0;
    
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      camX: camera.x,
      camY: camera.y,
    };
    lastDragPos = { x: e.clientX, y: e.clientY, time: Date.now() };
    
    containerEl?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Mark as drag if moved more than 5px (prevents accidental drags)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      didDrag = true;
    }
    
    camera.x = dragStart.camX - dx / camera.zoom;
    camera.y = dragStart.camY - dy / camera.zoom;
    
    // Track velocity for momentum
    const now = Date.now();
    const dt = now - lastDragPos.time;
    if (dt > 0) {
      camera.vx = (lastDragPos.x - e.clientX) / camera.zoom / dt * 16;
      camera.vy = (lastDragPos.y - e.clientY) / camera.zoom / dt * 16;
    }
    lastDragPos = { x: e.clientX, y: e.clientY, time: now };
  }

  function handlePointerUp(e: PointerEvent) {
    isDragging = false;
    containerEl?.releasePointerCapture(e.pointerId);
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * zoomFactor));
    
    // Zoom toward mouse position
    const rect = containerEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldBefore = screenToWorld(mouseX, mouseY);
    camera.zoom = newZoom;
    const worldAfter = screenToWorld(mouseX, mouseY);
    
    camera.x += worldBefore.x - worldAfter.x;
    camera.y += worldBefore.y - worldAfter.y;
  }

  function flyTo(worldX: number, worldY: number, targetZoom?: number) {
    isFlying = true;
    const startX = camera.x;
    const startY = camera.y;
    const startZoom = camera.zoom;
    const endZoom = targetZoom ?? Math.max(1, camera.zoom);
    const startTime = Date.now();
    
    function flyStep() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / FLY_DURATION);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      camera.x = startX + (worldX - startX) * eased;
      camera.y = startY + (worldY - startY) * eased;
      camera.zoom = startZoom + (endZoom - startZoom) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(flyStep);
      } else {
        isFlying = false;
      }
    }
    
    flyStep();
  }

  function handleCanvasClick(e: MouseEvent) {
    // Only if not dragged (using didDrag flag set during pointer move)
    if (didDrag) return;
    
    // Ignore clicks on floating UI elements (header, controls, zoom indicator)
    const target = e.target as HTMLElement;
    if (target.closest('.floating-header') || 
        target.closest('.floating-controls') || 
        target.closest('.zoom-indicator') ||
        target.closest('.world-post') ||
        target.closest('.modal-overlay')) {
      return;
    }
    
    // Fly to clicked position
    const rect = containerEl.getBoundingClientRect();
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    flyTo(world.x, world.y);
  }

  // Touch handling for pinch zoom
  let touches: { id: number; x: number; y: number }[] = [];
  let initialPinchDist = 0;
  let initialZoom = 1;

  function handleTouchStart(e: TouchEvent) {
    touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    
    if (touches.length === 2) {
      initialPinchDist = Math.hypot(
        touches[0].x - touches[1].x,
        touches[0].y - touches[1].y
      );
      initialZoom = camera.zoom;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    const newTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    
    if (newTouches.length === 2 && touches.length === 2) {
      // Pinch zoom
      const dist = Math.hypot(
        newTouches[0].x - newTouches[1].x,
        newTouches[0].y - newTouches[1].y
      );
      const scale = dist / initialPinchDist;
      camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom * scale));
    }
    
    touches = newTouches;
  }

  function handleTouchEnd(e: TouchEvent) {
    touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════════

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
    
    switch (e.key.toLowerCase()) {
      case '/':
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.search-input')?.focus();
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
        onnavigate?.({ view: 'input' });
        break;
      case 'c':
        onnavigate?.({ view: 'chat' });
        break;
      case '?':
        showHelp = !showHelp;
        break;
      case '0':
      case 'home':
        flyTo(0, 0, 1);
        break;
      case '+':
      case '=':
        camera.zoom = Math.min(MAX_ZOOM, camera.zoom * 1.2);
        break;
      case '-':
        camera.zoom = Math.max(MIN_ZOOM, camera.zoom / 1.2);
        break;
      case 'arrowup':
      case 'w':
        camera.vy = -20;
        break;
      case 'arrowdown':
      case 's':
        camera.vy = 20;
        break;
      case 'arrowleft':
      case 'a':
        camera.vx = -20;
        break;
      case 'arrowright':
      case 'd':
        camera.vx = 20;
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH - Teleport style (Enter = fly to result, click card = open)
  // ═══════════════════════════════════════════════════════════════════════════

  let searchTimeout: ReturnType<typeof setTimeout>;
  let currentResultIndex = $state(-1); // -1 = no result selected yet
  let highlightedPostId = $state<string | null>(null); // Currently highlighted post

  function handleSearchInput() {
    clearTimeout(searchTimeout);
    currentResultIndex = -1; // Reset index on new input
    highlightedPostId = null;
    
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        searchResults = await api.search.simple(searchQuery);
        currentResultIndex = -1;
      } catch (error) {
        console.error('Search failed:', error);
        searchResults = [];
      }
    }, 300);
  }

  // Fly to a search result without opening it
  function flyToResult(index: number) {
    if (searchResults.length === 0) return;
    
    // Wrap around
    const safeIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
    currentResultIndex = safeIndex;
    
    const post = searchResults[safeIndex];
    const worldPost = worldPosts.find(p => p.id === post.id);
    
    if (worldPost) {
      highlightedPostId = post.id;
      flyTo(worldPost.worldX, worldPost.worldY, 1.2);
    }
  }

  // Handle Enter key in search - teleport to next result
  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (searchResults.length > 0) {
        // Go to next result (or first if none selected)
        flyToResult(currentResultIndex + 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        flyToResult(currentResultIndex + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        flyToResult(currentResultIndex - 1);
      }
    } else if (e.key === 'Escape') {
      searchQuery = '';
      searchResults = [];
      currentResultIndex = -1;
      highlightedPostId = null;
    }
  }

  // Click on dropdown item = fly to it (not open)
  function selectSearchResult(post: Post, index: number) {
    currentResultIndex = index;
    const worldPost = worldPosts.find(p => p.id === post.id);
    if (worldPost) {
      highlightedPostId = post.id;
      flyTo(worldPost.worldX, worldPost.worldY, 1.2);
    }
  }
  
  // Clear search and highlight
  function clearSearch() {
    searchQuery = '';
    searchResults = [];
    currentResultIndex = -1;
    highlightedPostId = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function getMediaUrl(post: Post): string | null {
    if ((post.content_type === 'image' || post.content_type === 'video' || post.content_type === 'audio') && post.metadata?.filename) {
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
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  function getTypeInfo(type: string) {
    return CONTENT_TYPES.find(t => t.id === type) || CONTENT_TYPES[0];
  }

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  onMount(async () => {
    // Get viewport size
    viewportWidth = containerEl?.clientWidth || window.innerWidth;
    viewportHeight = containerEl?.clientHeight || window.innerHeight;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        viewportWidth = entry.contentRect.width;
        viewportHeight = entry.contentRect.height;
      }
    });
    if (containerEl) resizeObserver.observe(containerEl);
    
    // Load posts
    loading = true;
    try {
      posts = await api.posts.list(500);
      worldPosts = layoutPosts(posts);
      
      // Handle initial post selection
      if (initialPostId) {
        const post = worldPosts.find(p => p.id === initialPostId);
        if (post) {
          camera.x = post.worldX;
          camera.y = post.worldY;
          selectedPost = post;
        }
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      loading = false;
    }
    
    // Auto-focus search if navigating with search intent
    if (initialSearch !== undefined) {
      setTimeout(() => searchInputEl?.focus(), 100);
    }
    
    // Start animation loop
    animate();
    
    // Keyboard events
    window.addEventListener('keydown', handleKeyDown);
    
    // Touch and wheel events with { passive: false } to allow preventDefault
    containerEl?.addEventListener('wheel', handleWheel, { passive: false });
    containerEl?.addEventListener('touchstart', handleTouchStart, { passive: true });
    containerEl?.addEventListener('touchmove', handleTouchMove, { passive: false });
    containerEl?.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      containerEl?.removeEventListener('wheel', handleWheel);
      containerEl?.removeEventListener('touchstart', handleTouchStart);
      containerEl?.removeEventListener('touchmove', handleTouchMove);
      containerEl?.removeEventListener('touchend', handleTouchEnd);
      resizeObserver.disconnect();
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="canvas-world"
  bind:this={containerEl}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onclick={handleCanvasClick}
>
  <!-- Parallax Background Layers -->
  <div class="parallax-layer layer-1" style="transform: translate({-camera.x * 0.1}px, {-camera.y * 0.1}px)"></div>
  <div class="parallax-layer layer-2" style="transform: translate({-camera.x * 0.2}px, {-camera.y * 0.2}px)"></div>
  <div class="parallax-layer layer-3" style="transform: translate({-camera.x * 0.3}px, {-camera.y * 0.3}px)"></div>

  <!-- Globe vignette overlay -->
  <div class="globe-vignette"></div>

  <!-- Loading State -->
  {#if loading}
    <div class="loading-state">
      <Loader2 size={40} class="spin" />
      <p>Loading your universe...</p>
    </div>
  {:else if worldPosts.length === 0}
    <div class="empty-state">
      <Compass size={64} />
      <h2>Your universe awaits</h2>
      <p>Start capturing thoughts, links, and files</p>
      <button class="primary-btn" onclick={() => onnavigate?.({ view: 'input' })}>
        Create your first post
      </button>
    </div>
  {:else}
    <!-- World Posts -->
    <div class="posts-layer">
      {#each worldPosts as post (post.id)}
        {@const screen = worldToScreen(post.worldX, post.worldY)}
        {@const globe = getGlobeTransform(screen.x, screen.y, post.size)}
        {@const typeInfo = getTypeInfo(post.content_type)}
        {@const mediaUrl = getMediaUrl(post)}
        {@const isVisible = screen.x > -300 && screen.x < viewportWidth + 300 && 
                            screen.y > -300 && screen.y < viewportHeight + 300}
        
        {#if isVisible && globe.opacity > 0.1}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="world-post {post.content_type}"
            class:highlighted={post.id === highlightedPostId}
            style="
              left: {screen.x}px;
              top: {screen.y}px;
              width: {post.size * camera.zoom}px;
              opacity: {globe.opacity};
              z-index: {post.id === highlightedPostId ? 200 : globe.zIndex};
              transform: translate(-50%, -50%) 
                         perspective(1000px) 
                         rotateX({globe.rotateX}deg) 
                         rotateY({globe.rotateY}deg)
                         scale({globe.scale});
              transform-style: preserve-3d;
              --type-color: {typeInfo.color};
            "
            onclick={(e) => { e.stopPropagation(); selectedPost = post; }}
          >
            {#if post.content_type === 'image' && mediaUrl}
              <div class="post-media">
                <img src={mediaUrl} alt="" loading="lazy" />
              </div>
            {:else if post.content_type === 'url'}
              {#if mediaUrl}
                <div class="post-media url-media">
                  <img src={mediaUrl} alt="" loading="lazy" />
                </div>
              {/if}
              <div class="post-content">
                <h4>{post.metadata?.title || getDomain(post.content)}</h4>
                <span class="post-domain">{getDomain(post.content)}</span>
              </div>
            {:else if post.content_type === 'text'}
              <div class="post-content text-content">
                <p>{truncate(post.content, 120)}</p>
              </div>
            {:else if post.content_type === 'audio'}
              <div class="post-content audio-content">
                <Music size={28} />
                <span>{post.metadata?.originalName || 'Audio'}</span>
              </div>
            {:else if post.content_type === 'video'}
              <div class="post-content video-content">
                <Video size={28} />
                <span>{post.metadata?.originalName || 'Video'}</span>
              </div>
            {:else}
              <div class="post-content file-content">
                <Paperclip size={24} />
                <span>{post.metadata?.originalName || post.content}</span>
              </div>
            {/if}
            
            <div class="post-footer">
              <span class="post-type" style="color: {typeInfo.color}">
                {typeInfo.label}
              </span>
              <span class="post-date">{formatDate(post.created_at)}</span>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Floating UI -->
  <header class="floating-header">
    <button class="icon-btn" onclick={() => onnavigate?.({ view: 'input' })} title="Home (H)">
      <Home size={18} />
    </button>
    
    <div class="search-container" class:has-results={searchResults.length > 0}>
      <Search size={16} />
      <input
        bind:this={searchInputEl}
        type="text"
        class="search-input"
        placeholder="Search... (Enter to teleport)"
        bind:value={searchQuery}
        oninput={handleSearchInput}
        onkeydown={handleSearchKeydown}
      />
      {#if searchQuery}
        <button class="search-clear" onclick={clearSearch}>
          <X size={14} />
        </button>
      {/if}
      
      {#if searchResults.length > 0}
        <div class="search-dropdown">
          <div class="search-hint">
            Press Enter to teleport • {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </div>
          {#each searchResults.slice(0, 8) as result, index}
            {@const typeInfo = getTypeInfo(result.content_type)}
            <button 
              class="search-result" 
              class:active={index === currentResultIndex}
              onclick={() => selectSearchResult(result, index)}
            >
              <span class="result-index">{index + 1}</span>
              <span class="result-type" style="color: {typeInfo.color}">
                {typeInfo.label}
              </span>
              <span class="result-text">{truncate(result.content, 50)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    
    <button class="icon-btn" onclick={() => onnavigate?.({ view: 'chat' })} title="AI Chat (C)">
      <Bot size={18} />
    </button>
  </header>

  <div class="floating-controls">
    <button class="control-btn" onclick={() => camera.zoom = Math.min(MAX_ZOOM, camera.zoom * 1.3)} title="Zoom in (+)">
      <ZoomIn size={18} />
    </button>
    <button class="control-btn" onclick={() => camera.zoom = Math.max(MIN_ZOOM, camera.zoom / 1.3)} title="Zoom out (-)">
      <ZoomOut size={18} />
    </button>
    <button class="control-btn" onclick={() => flyTo(0, 0, 1)} title="Reset view (0)">
      <Compass size={18} />
    </button>
    <button class="control-btn" onclick={() => showHelp = true} title="Help (?)">
      <HelpCircle size={18} />
    </button>
  </div>

  <div class="zoom-indicator">
    {Math.round(camera.zoom * 100)}%
  </div>

  <!-- Help Modal -->
  {#if showHelp}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => showHelp = false} onkeydown={(e) => e.key === 'Escape' && (showHelp = false)}>
      <div class="help-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
        <h2>Navigation</h2>
        <div class="shortcuts">
          <div class="shortcut"><kbd>Drag</kbd> Pan around</div>
          <div class="shortcut"><kbd>Scroll</kbd> Zoom in/out</div>
          <div class="shortcut"><kbd>Click</kbd> Fly to location</div>
          <div class="shortcut"><kbd>WASD</kbd> Move camera</div>
          <div class="shortcut"><kbd>+/-</kbd> Zoom</div>
          <div class="shortcut"><kbd>0</kbd> Reset view</div>
          <div class="shortcut"><kbd>/</kbd> Search</div>
          <div class="shortcut"><kbd>H</kbd> Home</div>
          <div class="shortcut"><kbd>C</kbd> AI Chat</div>
          <div class="shortcut"><kbd>Esc</kbd> Close / Back</div>
        </div>
        <button class="close-help" onclick={() => showHelp = false}>Got it</button>
      </div>
    </div>
  {/if}

  <!-- Post Detail Modal -->
  {#if selectedPost}
    {@const mediaUrl = getMediaUrl(selectedPost)}
    {@const typeInfo = getTypeInfo(selectedPost.content_type)}
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => selectedPost = null} onkeydown={(e) => e.key === 'Escape' && (selectedPost = null)}>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
        <button class="modal-close" onclick={() => selectedPost = null}>
          <X size={20} />
        </button>
        
        {#if selectedPost.content_type === 'image' || selectedPost.content_type === 'video'}
          <div class="modal-media">
            {#if selectedPost.content_type === 'video' && mediaUrl}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video src={mediaUrl} controls></video>
            {:else if mediaUrl}
              <img src={mediaUrl} alt="" />
            {/if}
          </div>
        {:else if selectedPost.content_type === 'url'}
          {#if mediaUrl}
            <div class="modal-media url-preview">
              <img src={mediaUrl} alt="" />
            </div>
          {/if}
          <div class="modal-body">
            <h2>{selectedPost.metadata?.title || 'Link'}</h2>
            {#if selectedPost.metadata?.description}
              <p class="modal-desc">{selectedPost.metadata.description}</p>
            {/if}
            <a href={selectedPost.content} target="_blank" rel="noopener noreferrer" class="modal-link">
              <ExternalLink size={14} />
              {selectedPost.content}
            </a>
          </div>
        {:else if selectedPost.content_type === 'text'}
          <div class="modal-body text-modal">
            <p>{selectedPost.content}</p>
          </div>
        {:else if selectedPost.content_type === 'audio'}
          <div class="modal-body">
            {#if mediaUrl}
              <audio src={mediaUrl} controls class="modal-audio"></audio>
            {/if}
            <p class="modal-filename">{selectedPost.metadata?.originalName || 'Audio file'}</p>
          </div>
        {:else}
          <div class="modal-body file-modal">
            <Paperclip size={32} />
            <p class="modal-filename">{selectedPost.metadata?.originalName || selectedPost.content}</p>
          </div>
        {/if}
        
        <div class="modal-footer">
          <div class="modal-type" style="color: {typeInfo.color}">
            <span>{typeInfo.label}</span>
          </div>
          <span class="modal-date">
            <Calendar size={12} />
            {new Date(selectedPost.created_at).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .canvas-world {
    position: fixed;
    inset: 0;
    background: #030305;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .canvas-world:active {
    cursor: grabbing;
  }

  /* Parallax Background Layers */
  .parallax-layer {
    position: absolute;
    inset: -50%;
    pointer-events: none;
  }

  .layer-1 {
    background: 
      radial-gradient(circle at 30% 40%, rgba(99, 102, 241, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 70% 60%, rgba(139, 92, 246, 0.03) 0%, transparent 50%);
  }

  .layer-2 {
    background-image: radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .layer-3 {
    background-image: radial-gradient(circle, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 120px 120px;
  }

  /* Globe vignette - darker at edges */
  .globe-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 20%,
      rgba(0, 0, 0, 0.3) 60%,
      rgba(0, 0, 0, 0.7) 100%
    );
    pointer-events: none;
  }

  /* Loading & Empty States */
  .loading-state, .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-muted, #71717a);
    text-align: center;
    gap: 16px;
  }

  .empty-state h2 {
    font-size: 24px;
    color: var(--color-fg, #fafafa);
    margin: 0;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .primary-btn {
    margin-top: 12px;
    padding: 12px 24px;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .primary-btn:hover {
    background: var(--color-primary-hover, #818cf8);
    transform: translateY(-2px);
  }

  /* Posts Layer */
  .posts-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* World Post Card */
  .world-post {
    position: absolute;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    pointer-events: auto;
    transition: box-shadow 0.2s, border-color 0.2s;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    max-height: 280px;
  }

  .world-post:hover {
    border-color: var(--type-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px color-mix(in srgb, var(--type-color) 30%, transparent);
  }

  .world-post.highlighted {
    border-color: var(--color-primary, #6366f1);
    box-shadow: 
      0 0 0 3px var(--color-primary, #6366f1),
      0 0 40px rgba(99, 102, 241, 0.5),
      0 8px 32px rgba(0, 0, 0, 0.6);
    animation: pulse-highlight 1.5s ease-in-out infinite;
  }

  @keyframes pulse-highlight {
    0%, 100% {
      box-shadow: 
        0 0 0 3px var(--color-primary, #6366f1),
        0 0 40px rgba(99, 102, 241, 0.5),
        0 8px 32px rgba(0, 0, 0, 0.6);
    }
    50% {
      box-shadow: 
        0 0 0 5px var(--color-primary, #6366f1),
        0 0 60px rgba(99, 102, 241, 0.7),
        0 8px 32px rgba(0, 0, 0, 0.6);
    }
  }

  .post-media {
    width: 100%;
    aspect-ratio: 4/3;
    background: #0a0a0f;
    overflow: hidden;
  }

  .post-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .post-media.url-media {
    aspect-ratio: 16/9;
  }

  .post-content {
    padding: 12px;
  }

  .post-content h4 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .post-domain {
    font-size: 11px;
    color: var(--color-primary, #6366f1);
  }

  .text-content {
    background: linear-gradient(135deg, #fffef8 0%, #f5f4e8 100%);
    min-height: 80px;
    max-height: 200px;
    overflow: hidden;
  }

  .text-content p {
    margin: 0;
    font-size: 13px;
    color: #333;
    line-height: 1.5;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .audio-content, .video-content, .file-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80px;
    gap: 8px;
    color: var(--type-color);
  }

  .audio-content span, .video-content span, .file-content span {
    font-size: 11px;
    color: var(--color-muted, #71717a);
    text-align: center;
  }

  .post-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-top: 1px solid var(--color-border, #1e1e26);
    font-size: 10px;
  }

  .post-type {
    font-weight: 500;
  }

  .post-date {
    color: var(--color-muted, #71717a);
  }

  /* Floating Header */
  .floating-header {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: rgba(18, 18, 24, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    z-index: 100;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-primary, #6366f1);
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 10px;
    min-width: 240px;
    position: relative;
    transition: all 0.2s;
    color: var(--color-muted, #71717a);
  }

  .search-container:focus-within {
    border-color: var(--color-primary, #6366f1);
    box-shadow: 0 0 0 3px var(--color-primary-dim, rgba(99, 102, 241, 0.15));
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
  }

  .search-input::placeholder {
    color: var(--color-muted, #71717a);
  }

  .search-clear {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-muted, #71717a);
    border: none;
    border-radius: 50%;
    color: var(--color-bg, #08080c);
    cursor: pointer;
  }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
    color: var(--color-fg, #fafafa);
  }

  .search-result:hover {
    background: var(--color-bg, #08080c);
  }

  .result-type {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    width: 50px;
    flex-shrink: 0;
  }

  .result-text {
    font-size: 13px;
    color: var(--color-muted, #71717a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .search-hint {
    padding: 8px 14px;
    font-size: 11px;
    color: var(--color-muted, #71717a);
    border-bottom: 1px solid var(--color-border, #1e1e26);
    background: var(--color-bg, #08080c);
  }

  .result-index {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-border, #1e1e26);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted, #71717a);
    flex-shrink: 0;
  }

  .search-result.active {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
  }

  .search-result.active .result-index {
    background: var(--color-primary, #6366f1);
    color: white;
  }

  .search-result.active .result-text {
    color: var(--color-fg, #fafafa);
  }

  /* Floating Controls */
  .floating-controls {
    position: absolute;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 100;
  }

  .control-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(18, 18, 24, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-btn:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: var(--color-primary, #6366f1);
    color: var(--color-primary, #6366f1);
  }

  .zoom-indicator {
    position: absolute;
    bottom: 24px;
    left: 24px;
    padding: 8px 14px;
    background: rgba(18, 18, 24, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-muted, #71717a);
    z-index: 100;
  }

  /* Modal Overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  /* Help Modal */
  .help-modal {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 20px;
    padding: 28px;
    max-width: 360px;
    width: 100%;
  }

  .help-modal h2 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
  }

  .shortcuts {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--color-muted, #71717a);
  }

  .shortcut kbd {
    min-width: 60px;
    padding: 4px 10px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 6px;
    font-family: inherit;
    font-size: 12px;
    color: var(--color-fg, #fafafa);
    text-align: center;
  }

  .close-help {
    width: 100%;
    margin-top: 24px;
    padding: 12px;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .close-help:hover {
    background: var(--color-primary-hover, #818cf8);
  }

  /* Post Detail Modal */
  .modal {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 20px;
    max-width: 700px;
    max-height: 90vh;
    width: 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    animation: modal-enter 0.2s ease-out;
  }

  @keyframes modal-enter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .help-modal {
    animation: modal-enter 0.2s ease-out;
  }

  .modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    z-index: 10;
    transition: all 0.15s;
  }

  .modal-close:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .modal-media {
    width: 100%;
    max-height: 60vh;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-media img, .modal-media video {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }

  .modal-media.url-preview {
    max-height: 200px;
  }

  .modal-media.url-preview img {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
  }

  .modal-body h2 {
    margin: 0 0 12px;
    font-size: 20px;
    color: var(--color-fg, #fafafa);
  }

  .modal-desc {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--color-muted, #71717a);
    line-height: 1.6;
  }

  .modal-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-primary, #6366f1);
    text-decoration: none;
    font-size: 13px;
    word-break: break-all;
  }

  .modal-link:hover {
    text-decoration: underline;
  }

  .text-modal {
    background: linear-gradient(135deg, #fffef8 0%, #f5f4e8 100%);
  }

  .text-modal p {
    margin: 0;
    font-size: 16px;
    color: #333;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .modal-audio {
    width: 100%;
    margin-bottom: 12px;
  }

  .modal-filename {
    margin: 0;
    font-size: 14px;
    color: var(--color-fg, #fafafa);
    text-align: center;
  }

  .file-modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #f59e0b;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-top: 1px solid var(--color-border, #1e1e26);
    background: var(--color-bg, #08080c);
  }

  .modal-type {
    font-size: 13px;
    font-weight: 500;
  }

  .modal-date {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }

  /* Animations */
  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Mobile */
  @media (max-width: 640px) {
    .floating-header {
      left: 12px;
      right: 12px;
      transform: none;
    }

    .search-container {
      min-width: 0;
      flex: 1;
    }

    .floating-controls {
      bottom: 16px;
      right: 16px;
    }

    .zoom-indicator {
      bottom: 16px;
      left: 16px;
    }
  }
</style>
