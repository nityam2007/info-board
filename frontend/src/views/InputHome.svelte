<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Stats } from '$lib/api';
  import { 
    Send, Grid3x3, Upload, Link2, 
    Loader2, Check, Bot, Keyboard,
    Flame, Zap, Layers, Compass, Settings
  } from 'lucide-svelte';
  
  interface Props {
    onnavigate?: (detail?: { search?: string; postId?: string; view?: 'input' | 'canvas' | 'chat' | 'admin' }) => void;
  }
  
  let { onnavigate }: Props = $props();
  
  // State
  let content = $state('');
  let isSubmitting = $state(false);
  let isDragging = $state(false);
  let uploadProgress = $state('');
  let showSuccess = $state(false);
  let showConfetti = $state(false);
  let stats = $state<Stats | null>(null);
  let statsLoading = $state(true);
  let mounted = $state(false);
  let showShortcuts = $state(false);
  
  let inputElement: HTMLTextAreaElement;
  
  // URL detection
  const urlRegex = /^https?:\/\/[^\s]+$/i;
  
  onMount(async () => {
    mounted = true;
    inputElement?.focus();
    
    try {
      stats = await api.posts.stats();
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      statsLoading = false;
    }
  });
  
  async function handleSubmit() {
    if (!content.trim() || isSubmitting) return;
    
    isSubmitting = true;
    try {
      if (urlRegex.test(content.trim())) {
        await api.upload.url(content.trim());
      } else {
        await api.posts.create(content.trim());
      }
      content = '';
      
      // Celebration
      showConfetti = true;
      showSuccess = true;
      setTimeout(() => {
        showSuccess = false;
        showConfetti = false;
      }, 2500);
      
      // Refresh stats
      stats = await api.posts.stats();
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
        await api.upload.file(file);
      }
      uploadProgress = '';
      
      showConfetti = true;
      showSuccess = true;
      setTimeout(() => {
        showSuccess = false;
        showConfetti = false;
      }, 2500);
      
      stats = await api.posts.stats();
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
    if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') {
      // If typing "/" in empty textarea, go to canvas search
      if (e.key === '/' && content === '') {
        e.preventDefault();
        onnavigate?.({ view: 'canvas', search: '' });
      }
      return;
    }
    
    switch (e.key.toLowerCase()) {
      case 'g':
      case '/':
        e.preventDefault();
        onnavigate?.({ view: 'canvas', search: '' });
        break;
      case 'c':
        e.preventDefault();
        onnavigate?.({ view: 'chat' });
        break;
      case '?':
        e.preventDefault();
        showShortcuts = !showShortcuts;
        break;
      case 'escape':
        if (showShortcuts) showShortcuts = false;
        break;
    }
  }
  
  // Confetti
  function generateConfetti(): { x: number; delay: number; color: string; size: number }[] {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e', '#f59e0b', '#ec4899'];
    return Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
    }));
  }
  
  let confettiPieces = $derived(showConfetti ? generateConfetti() : []);
</script>

<svelte:window onpaste={handlePaste} onkeydown={handleGlobalKeydown} />

<div 
  class="home"
  class:mounted
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  role="application"
  aria-label="Info Board capture"
>
  <!-- Background -->
  <div class="bg">
    <div class="bg-gradient"></div>
    <div class="bg-dots"></div>
    <div class="bg-vignette"></div>
  </div>
  
  <!-- Confetti -->
  {#if showConfetti}
    <div class="confetti">
      {#each confettiPieces as piece}
        <div 
          class="confetti-piece" 
          style="left:{piece.x}%;animation-delay:{piece.delay}s;background:{piece.color};width:{piece.size}px;height:{piece.size}px;"
        ></div>
      {/each}
    </div>
  {/if}
  
  <!-- Drag overlay -->
  {#if isDragging}
    <div class="drag-overlay">
      <div class="drag-box">
        <Upload size={48} strokeWidth={1.5} />
        <span>Drop to capture</span>
      </div>
    </div>
  {/if}

  <!-- Shortcuts Modal -->
  {#if showShortcuts}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => showShortcuts = false} onkeydown={(e) => e.key === 'Escape' && (showShortcuts = false)} role="presentation">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
        <h3><Keyboard size={18} /> Shortcuts</h3>
        <div class="shortcuts">
          <div class="shortcut"><kbd>/</kbd> <span>Search on Canvas</span></div>
          <div class="shortcut"><kbd>G</kbd> <span>Go to Canvas</span></div>
          <div class="shortcut"><kbd>C</kbd> <span>AI Chat</span></div>
          <div class="shortcut"><kbd>Ctrl+Enter</kbd> <span>Submit</span></div>
          <div class="shortcut"><kbd>?</kbd> <span>This help</span></div>
        </div>
        <button class="modal-btn" onclick={() => showShortcuts = false}>Got it</button>
      </div>
    </div>
  {/if}
  
  <!-- Main Content -->
  <div class="main">
    <!-- Nav -->
    <nav class="nav">
      <button class="nav-btn" onclick={() => onnavigate?.({ view: 'admin' })} title="Admin Panel">
        <Settings size={18} />
      </button>
      <button class="nav-btn" onclick={() => showShortcuts = true} title="Shortcuts (?)">
        <Keyboard size={18} />
      </button>
      <button class="nav-btn" onclick={() => onnavigate?.({ view: 'chat' })} title="AI Chat (C)">
        <Bot size={18} />
      </button>
      <button class="nav-btn primary" onclick={() => onnavigate?.({ view: 'canvas' })} title="Canvas (G)">
        <Compass size={18} />
        <span>Explore</span>
      </button>
    </nav>
    
    <!-- Center -->
    <div class="center">
      <!-- Stats (minimal) -->
      {#if stats && stats.totalPosts > 0}
        <div class="stats">
          <div class="stat">
            <Layers size={16} />
            <span class="stat-value">{stats.totalPosts}</span>
            <span class="stat-label">captures</span>
          </div>
          {#if stats.streak > 0}
            <div class="stat streak">
              <Flame size={16} />
              <span class="stat-value">{stats.streak}</span>
              <span class="stat-label">day streak</span>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Input -->
      <div class="input-card">
        <div class="input-icon">
          {#if urlRegex.test(content.trim())}
            <Link2 size={20} />
          {:else}
            <Zap size={20} />
          {/if}
        </div>
        
        <textarea
          bind:this={inputElement}
          bind:value={content}
          placeholder="Capture anything..."
          rows="2"
          onkeydown={handleKeydown}
        ></textarea>
        
        <div class="input-actions">
          <label class="action-btn" title="Upload file">
            <Upload size={18} />
            <input type="file" multiple onchange={(e) => handleFiles((e.target as HTMLInputElement).files!)} />
          </label>
          
          <button 
            class="action-btn submit" 
            onclick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            title="Submit (Ctrl+Enter)"
          >
            {#if isSubmitting}
              <Loader2 size={18} class="spin" />
            {:else}
              <Send size={18} />
            {/if}
          </button>
        </div>
      </div>
      
      <!-- Hints -->
      <div class="hints">
        <span><kbd>/</kbd> search</span>
        <span><kbd>G</kbd> canvas</span>
        <span><kbd>C</kbd> chat</span>
      </div>
    </div>
  </div>
  
  <!-- Toast -->
  {#if showSuccess}
    <div class="toast">
      <Check size={18} />
      <span>Captured!</span>
    </div>
  {/if}
  
  {#if uploadProgress}
    <div class="toast uploading">
      <Loader2 size={18} class="spin" />
      <span>{uploadProgress}</span>
    </div>
  {/if}
</div>

<style>
  .home {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #030305;
    opacity: 0;
    transition: opacity 0.4s;
  }
  
  .home.mounted {
    opacity: 1;
  }
  
  /* Background - matches Canvas */
  .bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  
  .bg-gradient {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.05) 0%, transparent 40%);
  }
  
  .bg-dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  
  .bg-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%);
  }
  
  /* Confetti */
  .confetti {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
  }
  
  .confetti-piece {
    position: absolute;
    top: -20px;
    border-radius: 2px;
    animation: fall 2.5s ease-out forwards;
  }
  
  @keyframes fall {
    to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  
  /* Drag overlay */
  .drag-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(3, 3, 5, 0.95);
    backdrop-filter: blur(20px);
    z-index: 1000;
  }
  
  .drag-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 60px 80px;
    border: 2px dashed rgba(99, 102, 241, 0.5);
    border-radius: 24px;
    color: var(--color-primary, #6366f1);
    font-size: 18px;
    font-weight: 500;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    50% { border-color: rgba(99, 102, 241, 0.8); }
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 1000;
  }
  
  .modal {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 20px;
    padding: 28px;
    min-width: 320px;
    animation: modal-in 0.2s ease-out;
  }
  
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.95); }
  }
  
  .modal h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 20px;
    font-size: 16px;
    color: var(--color-fg, #fafafa);
  }
  
  .shortcuts {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .shortcut {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--color-muted, #71717a);
  }
  
  .shortcut kbd {
    min-width: 24px;
    padding: 4px 8px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 6px;
    font-family: inherit;
    font-size: 11px;
    color: var(--color-fg, #fafafa);
    text-align: center;
  }
  
  .modal-btn {
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
  
  .modal-btn:hover {
    background: var(--color-primary-hover, #818cf8);
  }
  
  /* Main */
  .main {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 1;
  }
  
  /* Nav */
  .nav {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
  }
  
  .nav-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(18, 18, 24, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    color: var(--color-muted, #71717a);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .nav-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--color-primary, #6366f1);
    color: var(--color-fg, #fafafa);
  }
  
  .nav-btn.primary {
    background: var(--color-primary, #6366f1);
    border-color: var(--color-primary, #6366f1);
    color: white;
  }
  
  .nav-btn.primary:hover {
    background: var(--color-primary-hover, #818cf8);
  }
  
  /* Center */
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
    max-width: 500px;
  }
  
  /* Stats */
  .stats {
    display: flex;
    gap: 24px;
    animation: fade-in 0.5s ease-out;
  }
  
  @keyframes fade-in {
    from { opacity: 0; }
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
  }
  
  .stat-value {
    font-weight: 600;
    color: var(--color-fg, #fafafa);
  }
  
  .stat.streak {
    color: #fb923c;
  }
  
  .stat.streak .stat-value {
    color: #fb923c;
  }
  
  /* Input */
  .input-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 20px;
    background: rgba(18, 18, 24, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 20px;
    transition: all 0.2s;
  }
  
  .input-card:focus-within {
    border-color: var(--color-primary, #6366f1);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1), 0 20px 50px rgba(0, 0, 0, 0.4);
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
  
  .input-card:focus-within .input-icon {
    color: var(--color-primary, #6366f1);
  }
  
  textarea {
    flex: 1;
    min-height: 60px;
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
  }
  
  .action-btn {
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
    transition: all 0.15s;
  }
  
  .action-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--color-primary, #6366f1);
    color: var(--color-primary, #6366f1);
  }
  
  .action-btn input {
    display: none;
  }
  
  .action-btn.submit {
    background: var(--color-primary, #6366f1);
    border-color: var(--color-primary, #6366f1);
    color: white;
  }
  
  .action-btn.submit:hover:not(:disabled) {
    background: var(--color-primary-hover, #818cf8);
  }
  
  .action-btn.submit:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  /* Hints */
  .hints {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }
  
  .hints span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .hints kbd {
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
  }
  
  /* Toast */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    background: rgba(18, 18, 24, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
    color: #22c55e;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: toast-in 0.3s ease-out;
  }
  
  .toast.uploading {
    border-color: rgba(99, 102, 241, 0.3);
    color: var(--color-primary, #6366f1);
  }
  
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  }
  
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* Mobile */
  @media (max-width: 480px) {
    .nav-btn span { display: none; }
    .nav { gap: 6px; }
    .hints { flex-wrap: wrap; justify-content: center; }
  }
</style>
