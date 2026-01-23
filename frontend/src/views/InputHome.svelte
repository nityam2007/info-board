<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Post } from '$lib/api';
  import { 
    Send, Search, Grid3x3, Upload, Link2, Image, Music, 
    Video, FileText, Paperclip, Loader2, X, Check, ExternalLink,
    Sparkles, ArrowRight, Bot, Keyboard, Clock
  } from 'lucide-svelte';
  
  interface Props {
    onnavigate?: (detail?: { search?: string; postId?: string; view?: 'input' | 'canvas' | 'chat' }) => void;
  }
  
  let { onnavigate }: Props = $props();
  
  // State
  let content = $state('');
  let isSubmitting = $state(false);
  let recentPosts = $state<{ id: string; content: string; type: string }[]>([]);
  let searchResults = $state<Post[]>([]);
  let isSearching = $state(false);
  let mode = $state<'capture' | 'search'>('capture');
  let isDragging = $state(false);
  let uploadProgress = $state('');
  let showSuccess = $state(false);
  let showShortcuts = $state(false);
  
  let inputElement: HTMLTextAreaElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  
  // URL detection
  const urlRegex = /^https?:\/\/[^\s]+$/i;
  
  // Reactive mode switching
  $effect(() => {
    if (content.startsWith('/') || content.startsWith('?')) {
      mode = 'search';
      debouncedSearch(content.slice(1));
    } else if (content.length === 0) {
      mode = 'capture';
      searchResults = [];
    }
  });
  
  // Auto-focus on mount
  onMount(() => {
    inputElement?.focus();
  });
  
  function debouncedSearch(query: string) {
    clearTimeout(searchTimeout);
    if (!query.trim()) {
      searchResults = [];
      return;
    }
    searchTimeout = setTimeout(() => performSearch(query), 200);
  }
  
  async function performSearch(query: string) {
    isSearching = true;
    try {
      searchResults = await api.search.simple(query);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      isSearching = false;
    }
  }
  
  async function handleSubmit() {
    if (!content.trim() || isSubmitting) return;
    
    if (mode === 'search') {
      onnavigate?.({ search: content.slice(1) });
      return;
    }
    
    isSubmitting = true;
    try {
      if (urlRegex.test(content.trim())) {
        const post = await api.upload.url(content.trim());
        recentPosts = [{ id: post.id, content: post.metadata?.title as string || post.content, type: 'url' }, ...recentPosts.slice(0, 4)];
      } else {
        const post = await api.posts.create(content.trim());
        recentPosts = [{ id: post.id, content: post.content, type: 'text' }, ...recentPosts.slice(0, 4)];
      }
      content = '';
      showSuccess = true;
      setTimeout(() => showSuccess = false, 2000);
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      isSubmitting = false;
    }
  }
  
  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    
    isSubmitting = true;
    try {
      for (const file of fileArray) {
        uploadProgress = `Uploading ${file.name}...`;
        const post = await api.upload.file(file);
        recentPosts = [{ id: post.id, content: file.name, type: post.content_type }, ...recentPosts.slice(0, 4)];
      }
      uploadProgress = '';
      showSuccess = true;
      setTimeout(() => showSuccess = false, 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      uploadProgress = '';
    } finally {
      isSubmitting = false;
    }
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files);
    } else if (e.dataTransfer?.getData('text/plain')) {
      content = e.dataTransfer.getData('text/plain');
    }
  }
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }
  
  function handleDragLeave(e: DragEvent) {
    if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      isDragging = false;
    }
  }
  
  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFiles([file]);
        return;
      }
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }
  
  function handleGlobalKeydown(e: KeyboardEvent) {
    // Skip if typing in textarea
    if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    
    switch (e.key.toLowerCase()) {
      case 'g':
        e.preventDefault();
        onnavigate?.({ view: 'canvas' });
        break;
      case 'c':
        e.preventDefault();
        onnavigate?.({ view: 'chat' });
        break;
      case '/':
        e.preventDefault();
        content = '/';
        inputElement?.focus();
        break;
      case '?':
        e.preventDefault();
        showShortcuts = !showShortcuts;
        break;
      case 'escape':
        if (showShortcuts) {
          showShortcuts = false;
        }
        break;
    }
  }
  
  function openPost(post: { id: string }) {
    onnavigate?.({ postId: post.id });
  }
  
  function getTypeIcon(type: string) {
    switch (type) {
      case 'text': return FileText;
      case 'image': return Image;
      case 'audio': return Music;
      case 'video': return Video;
      case 'url': return Link2;
      case 'file': return Paperclip;
      default: return FileText;
    }
  }
  
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
</script>

<svelte:window onpaste={handlePaste} onkeydown={handleGlobalKeydown} />

<div 
  class="home-container"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  role="application"
  aria-label="Info Board capture interface"
>
  <!-- Background glow -->
  <div class="bg-glow"></div>
  <div class="bg-grid"></div>
  
  <!-- Drag overlay -->
  {#if isDragging}
    <div class="drag-overlay">
      <Upload size={48} strokeWidth={1.5} />
      <span>Drop files here</span>
    </div>
  {/if}

  <!-- Keyboard Shortcuts Modal -->
  {#if showShortcuts}
    <div class="shortcuts-overlay" onclick={() => showShortcuts = false}>
      <div class="shortcuts-modal" onclick={(e) => e.stopPropagation()}>
        <h3><Keyboard size={20} /> Keyboard Shortcuts</h3>
        <div class="shortcuts-grid">
          <div class="shortcut"><kbd>G</kbd> <span>Go to Canvas</span></div>
          <div class="shortcut"><kbd>C</kbd> <span>Open AI Chat</span></div>
          <div class="shortcut"><kbd>/</kbd> <span>Start search</span></div>
          <div class="shortcut"><kbd>?</kbd> <span>Show shortcuts</span></div>
          <div class="shortcut"><kbd>⌘</kbd>+<kbd>Enter</kbd> <span>Submit</span></div>
          <div class="shortcut"><kbd>Esc</kbd> <span>Close modal</span></div>
        </div>
        <button class="close-shortcuts" onclick={() => showShortcuts = false}>Got it!</button>
      </div>
    </div>
  {/if}
  
  <div class="content">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <div class="logo-icon-wrapper">
          <Sparkles size={22} />
        </div>
        <div class="logo-text">
          <h1>Info Board</h1>
          <span class="greeting">{getGreeting()}</span>
        </div>
      </div>
      <div class="nav-buttons">
        <button class="nav-btn help-btn" onclick={() => showShortcuts = true} title="Keyboard shortcuts">
          <Keyboard size={16} />
        </button>
        <button class="nav-btn chat-btn" onclick={() => onnavigate?.({ view: 'chat' })}>
          <Bot size={18} />
          <span>AI Chat</span>
        </button>
        <button class="nav-btn canvas-btn" onclick={() => onnavigate?.({ view: 'canvas' })}>
          <Grid3x3 size={18} />
          <span>Canvas</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </header>
    
    <!-- Main Input -->
    <div class="input-section" class:search-mode={mode === 'search'}>
      <div class="input-container" class:focused={!!content}>
        <div class="input-icon">
          {#if mode === 'search'}
            <Search size={20} />
          {:else if urlRegex.test(content.trim())}
            <Link2 size={20} />
          {:else}
            <FileText size={20} />
          {/if}
        </div>
        
        <textarea
          bind:this={inputElement}
          bind:value={content}
          placeholder={mode === 'search' 
            ? 'Search your knowledge...' 
            : 'Capture a thought, paste a link, drop a file...'}
          rows="3"
          onkeydown={handleKeydown}
        ></textarea>
        
        <div class="input-actions">
          <label class="file-btn" title="Upload file">
            <Upload size={18} />
            <input type="file" multiple onchange={(e) => handleFiles((e.target as HTMLInputElement).files!)} />
          </label>
          
          <button 
            class="submit-btn" 
            onclick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
          >
            {#if isSubmitting}
              <Loader2 size={18} class="spinner" />
            {:else if mode === 'search'}
              <Search size={18} />
            {:else}
              <Send size={18} />
            {/if}
          </button>
        </div>
      </div>
      
      <div class="input-hints">
        <span class="hint"><kbd>/</kbd> search</span>
        <span class="hint"><kbd>G</kbd> canvas</span>
        <span class="hint"><kbd>C</kbd> chat</span>
        <span class="hint"><kbd>?</kbd> shortcuts</span>
      </div>
    </div>
    
    <!-- Quick Actions -->
    {#if mode === 'capture' && !content}
      <div class="quick-actions">
        <button class="quick-action" onclick={() => { content = '/'; inputElement?.focus(); }}>
          <Search size={16} />
          <span>Search posts</span>
        </button>
        <button class="quick-action" onclick={() => onnavigate?.({ view: 'canvas' })}>
          <Grid3x3 size={16} />
          <span>Browse canvas</span>
        </button>
        <button class="quick-action" onclick={() => onnavigate?.({ view: 'chat' })}>
          <Bot size={16} />
          <span>Ask AI</span>
        </button>
      </div>
    {/if}
    
    <!-- Success Toast -->
    {#if showSuccess}
      <div class="toast success">
        <Check size={18} />
        <span>Captured successfully!</span>
      </div>
    {/if}
    
    <!-- Upload Progress -->
    {#if uploadProgress}
      <div class="toast progress">
        <Loader2 size={18} class="spinner" />
        <span>{uploadProgress}</span>
      </div>
    {/if}
    
    <!-- Search Results -->
    {#if mode === 'search' && (searchResults.length > 0 || isSearching)}
      <div class="results-section">
        <h3>
          {#if isSearching}
            <Loader2 size={16} class="spinner" />
            Searching...
          {:else}
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          {/if}
        </h3>
        
        <div class="results-list">
          {#each searchResults as result, i}
            {@const TypeIcon = getTypeIcon(result.content_type)}
            <button class="result-item" onclick={() => openPost(result)} style="animation-delay: {i * 50}ms">
              <div class="result-icon">
                <TypeIcon size={16} />
              </div>
              <div class="result-content">
                <span class="result-text">
                  {result.metadata?.title || result.content.slice(0, 100)}
                </span>
                <span class="result-meta">
                  {result.content_type} • {new Date(result.created_at).toLocaleDateString()}
                </span>
              </div>
              <ExternalLink size={14} class="result-arrow" />
            </button>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Recent Posts -->
    {#if recentPosts.length > 0 && mode === 'capture'}
      <div class="recent-section">
        <h3><Clock size={14} /> Just captured</h3>
        <div class="recent-list">
          {#each recentPosts as post, i}
            {@const TypeIcon = getTypeIcon(post.type)}
            <button class="recent-item" onclick={() => openPost(post)} style="animation-delay: {i * 50}ms">
              <TypeIcon size={14} />
              <span>{post.content.slice(0, 50)}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .home-container {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
    overflow: hidden;
    background: var(--color-bg, #08080c);
  }
  
  .bg-glow {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at center, 
      rgba(99, 102, 241, 0.08) 0%, 
      rgba(99, 102, 241, 0.04) 40%,
      transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .bg-grid {
    position: fixed;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }
  
  .drag-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(8, 8, 12, 0.98);
    backdrop-filter: blur(12px);
    border: 3px dashed var(--color-primary, #6366f1);
    color: var(--color-primary-hover, #818cf8);
    font-size: 18px;
    z-index: 1000;
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% { border-color: rgba(99, 102, 241, 0.5); }
    50% { border-color: rgba(99, 102, 241, 0.8); }
  }

  /* Shortcuts Modal */
  .shortcuts-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 1000;
    animation: fade-in 0.2s ease-out;
  }

  .shortcuts-modal {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    padding: 24px 32px;
    min-width: 340px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: scale-in 0.2s ease-out;
  }

  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .shortcuts-modal h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 20px 0;
    font-size: 18px;
    color: var(--color-fg, #fafafa);
  }

  .shortcuts-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shortcuts-grid .shortcut {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--color-muted, #71717a);
  }

  .shortcuts-grid kbd {
    display: inline-block;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--color-fg, #fafafa);
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
  }

  .close-shortcuts {
    display: block;
    width: 100%;
    margin-top: 24px;
    padding: 12px;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-shortcuts:hover {
    background: var(--color-primary-hover, #818cf8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }
  
  .content {
    position: relative;
    width: 100%;
    max-width: 580px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    z-index: 1;
  }
  
  @media (max-width: 640px) {
    .content {
      gap: 20px;
    }
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  @media (max-width: 480px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-radius: 12px;
    color: var(--color-primary-hover, #818cf8);
  }

  .logo-text {
    display: flex;
    flex-direction: column;
  }
  
  .logo h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-fg, #fafafa);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .greeting {
    font-size: 13px;
    color: var(--color-muted, #71717a);
    margin-top: 2px;
  }
  
  .nav-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  @media (max-width: 480px) {
    .nav-buttons {
      justify-content: flex-end;
    }
    
    .nav-btn span {
      display: none;
    }
    
    .nav-btn {
      padding: 10px;
    }
  }
  
  .nav-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 10px;
    color: var(--color-muted, #71717a);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .nav-btn:hover {
    background: rgba(30, 30, 40, 0.9);
    color: var(--color-fg, #fafafa);
    border-color: var(--color-primary, #6366f1);
    transform: translateY(-1px);
  }

  .nav-btn.help-btn {
    padding: 10px;
  }

  .nav-btn.chat-btn {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: rgba(99, 102, 241, 0.3);
    color: var(--color-primary-hover, #818cf8);
  }

  .nav-btn.chat-btn:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: var(--color-primary, #6366f1);
    color: var(--color-fg, #fafafa);
  }

  .nav-btn.canvas-btn {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: rgba(99, 102, 241, 0.3);
    color: var(--color-primary-hover, #818cf8);
  }

  .nav-btn.canvas-btn:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: var(--color-primary, #6366f1);
    color: var(--color-fg, #fafafa);
  }
  
  .input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .input-container {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 18px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .input-container:focus-within,
  .input-container.focused {
    background: rgba(18, 18, 24, 0.95);
    border-color: var(--color-primary, #6366f1);
    box-shadow: 
      0 0 0 3px rgba(99, 102, 241, 0.1),
      0 10px 40px rgba(99, 102, 241, 0.1);
  }

  .search-mode .input-container {
    border-color: var(--color-primary, #6366f1);
  }

  .search-mode .input-container:focus-within {
    border-color: var(--color-primary-hover, #818cf8);
    box-shadow: 
      0 0 0 3px rgba(99, 102, 241, 0.15),
      0 10px 40px rgba(99, 102, 241, 0.15);
  }
  
  .input-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--color-muted, #71717a);
    flex-shrink: 0;
    transition: color 0.2s;
  }
  
  .input-container:focus-within .input-icon {
    color: var(--color-primary-hover, #818cf8);
  }

  .search-mode .input-container:focus-within .input-icon {
    color: var(--color-primary, #6366f1);
  }
  
  textarea {
    flex: 1;
    min-height: 80px;
    padding: 8px 0;
    background: transparent;
    border: none;
    color: var(--color-fg, #fafafa);
    font-size: 16px;
    font-family: inherit;
    line-height: 1.6;
    resize: none;
    outline: none;
  }
  
  textarea::placeholder {
    color: var(--color-muted, #71717a);
  }
  
  .input-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-left: 12px;
  }
  
  .file-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 10px;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .file-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    color: var(--color-primary-hover, #818cf8);
    border-color: var(--color-primary, #6366f1);
    transform: translateY(-1px);
  }
  
  .file-btn input {
    display: none;
  }
  
  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 10px;
    color: var(--color-fg, #fafafa);
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }
  
  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #818cf8);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }
  
  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
  
  .submit-btn :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .input-hints {
    display: flex;
    gap: 12px;
    padding-left: 58px;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  
  @media (max-width: 480px) {
    .input-hints {
      padding-left: 0;
      justify-content: center;
    }
  }
  
  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }
  
  .hint kbd {
    display: inline-block;
    padding: 2px 6px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
    color: var(--color-muted, #71717a);
  }

  /* Quick Actions */
  .quick-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    animation: fade-in 0.3s ease-out;
  }
  
  @media (max-width: 480px) {
    .quick-actions {
      gap: 8px;
    }
    
    .quick-action {
      flex: 1 1 calc(50% - 4px);
      min-width: 0;
      justify-content: center;
      padding: 12px 10px;
    }
  }

  .quick-action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-action:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: var(--color-primary, #6366f1);
    color: var(--color-fg, #fafafa);
    transform: translateY(-2px);
  }
  
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    font-size: 14px;
    backdrop-filter: blur(12px);
    z-index: 1000;
    animation: slide-up 0.3s ease-out;
  }
  
  .toast.success {
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: 0 4px 20px rgba(34, 197, 94, 0.15);
  }
  
  .toast.progress {
    color: var(--color-primary-hover, #818cf8);
    border-color: rgba(99, 102, 241, 0.3);
  }
  
  .toast :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  .results-section,
  .recent-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: fade-in 0.3s ease-out;
  }
  
  .results-section h3,
  .recent-section h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted, #71717a);
    margin: 0;
  }
  
  .results-section h3 :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  
  .results-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .result-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    animation: slide-in 0.3s ease-out backwards;
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .result-item:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: var(--color-primary, #6366f1);
    transform: translateX(4px);
  }
  
  .result-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-radius: 8px;
    color: var(--color-primary-hover, #818cf8);
    flex-shrink: 0;
  }
  
  .result-content {
    flex: 1;
    min-width: 0;
  }
  
  .result-text {
    display: block;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .result-meta {
    display: block;
    font-size: 12px;
    color: var(--color-muted, #71717a);
    margin-top: 4px;
    text-transform: capitalize;
  }
  
  .result-item :global(.result-arrow) {
    color: var(--color-muted, #71717a);
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .result-item:hover :global(.result-arrow) {
    color: var(--color-primary-hover, #818cf8);
    transform: translateX(2px);
  }
  
  .recent-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .recent-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 10px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    animation: slide-in 0.3s ease-out backwards;
  }
  
  .recent-item:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-fg, #fafafa);
    border-color: var(--color-primary, #6366f1);
    transform: translateY(-2px);
  }
  
  @media (max-width: 480px) {
    .recent-item {
      max-width: 100%;
      flex: 1 1 100%;
    }
  }
  
  /* Touch device optimizations */
  @media (hover: none) {
    .nav-btn:hover,
    .quick-action:hover,
    .result-item:hover,
    .recent-item:hover {
      transform: none;
    }
    
    .nav-btn:active,
    .quick-action:active,
    .result-item:active,
    .recent-item:active {
      opacity: 0.8;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .input-container {
      border-color: var(--color-primary, #6366f1);
    }
    
    .nav-btn {
      border-color: var(--color-primary, #6366f1);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .result-item,
    .recent-item,
    .quick-action {
      animation: none;
    }
    
    .toast {
      animation: none;
    }
  }
</style>
