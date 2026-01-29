<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Post, type Tag } from '$lib/api';
  import { 
    X, Tag as TagIcon, Calendar, Globe,
    Image, Video, Music, Link2, FileText, Paperclip,
    ExternalLink, Download, Loader2, Eye, FileSearch, Bot, Copy, Check
  } from 'lucide-svelte';
  
  interface Props {
    post: Post;
    onclose?: () => void;
  }
  
  let { post, onclose }: Props = $props();
  
  // State
  let tags = $state<Tag[]>([]);
  let imageLoaded = $state(false);
  let copied = $state(false);
  
  // Get media URL
  function getMediaUrl(): string | null {
    if (post.content_type === 'image' || post.content_type === 'video' || post.content_type === 'audio') {
      if (post.metadata?.filename) {
        const date = new Date(post.created_at);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `/api/upload/file/${year}/${month}/${post.metadata.filename}`;
      }
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
  
  let mediaUrl = $state(getMediaUrl());
  
  // Check if this is a media type that should use 2-column layout
  const hasMediaPreview = $derived(
    (post.content_type === 'image' || post.content_type === 'video') && mediaUrl ||
    (post.content_type === 'url' && mediaUrl)
  );
  
  onMount(async () => {
    try {
      const full = await api.posts.get(post.id);
      tags = full.tags || [];
    } catch (e) {
      console.error('Failed to load post details:', e);
    }
  });
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose?.();
  }
  
  function openUrl() {
    if (post.content_type === 'url') {
      window.open(post.content, '_blank');
    }
  }
  
  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
  
  async function copyContent() {
    const text = post.content_type === 'url' 
      ? post.content 
      : post.content_type === 'text' 
        ? post.content 
        : post.metadata?.originalName || '';
    
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }
  
  function downloadFile() {
    if (!mediaUrl) return;
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = post.metadata?.originalName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
  
  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      text: 'Note',
      image: 'Image',
      video: 'Video',
      audio: 'Audio',
      url: 'Link',
      file: 'File'
    };
    return labels[type] || type;
  }
  
  const hasAIMetadata = $derived(
    post.metadata?.aiDescription || 
    post.metadata?.ocrText || 
    post.metadata?.aiSummary || 
    post.metadata?.transcription
  );
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="overlay" 
  role="dialog" 
  aria-modal="true"
  onpointerdown={(e) => e.stopPropagation()}
  onpointermove={(e) => e.stopPropagation()}
  onpointerup={(e) => e.stopPropagation()}
  onwheel={(e) => e.stopPropagation()}
>
  <button class="overlay-bg" onclick={() => onclose?.()} aria-label="Close"></button>
  
  <div class="modal" class:two-column={hasMediaPreview}>
    <!-- Header -->
    <div class="modal-header">
      <div class="header-info">
        <span class="type-label">{getTypeLabel(post.content_type)}</span>
        <span class="meta-separator">-</span>
        <span class="date-label">
          <Calendar size={12} />
          {formatDate(post.created_at)}
        </span>
      </div>
      <div class="header-actions">
        <button class="action-btn" onclick={copyContent} title="Copy">
          {#if copied}
            <Check size={16} />
          {:else}
            <Copy size={16} />
          {/if}
        </button>
        <button class="close-btn" onclick={() => onclose?.()} aria-label="Close">
          <X size={18} />
        </button>
      </div>
    </div>
    
    <!-- Content Area -->
    <div class="modal-content" class:two-column-content={hasMediaPreview}>
      
      <!-- LEFT COLUMN: Media Preview (for 2-column layouts) -->
      {#if hasMediaPreview}
        <div class="media-column">
          {#if post.content_type === 'image' && mediaUrl}
            <div class="media-frame">
              <img 
                src={mediaUrl} 
                alt={post.metadata?.originalName || 'Image'} 
                onload={() => imageLoaded = true}
                class:loaded={imageLoaded}
              />
              {#if !imageLoaded}
                <div class="loading-state">
                  <Loader2 size={24} class="spinner" />
                </div>
              {/if}
            </div>
          {:else if post.content_type === 'video' && mediaUrl}
            <div class="media-frame video-frame">
              <video controls preload="metadata">
                <source src={mediaUrl} type={post.metadata?.mimeType || 'video/mp4'}>
                <track kind="captions" />
              </video>
            </div>
          {:else if post.content_type === 'url' && mediaUrl}
            <div class="media-frame url-frame">
              <img 
                src={mediaUrl} 
                alt={post.metadata?.title || 'Preview'} 
                onload={() => imageLoaded = true}
                onerror={() => mediaUrl = null}
                class:loaded={imageLoaded}
              />
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- RIGHT COLUMN (or full width for non-media types): Details -->
      <div class="details-column">
        
        <!-- URL-specific content -->
        {#if post.content_type === 'url'}
          <div class="url-details">
            <div class="url-site">
              {#if post.metadata?.favicon}
                <img class="favicon" src={post.metadata.favicon} alt="" onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
              {/if}
              <span>{post.metadata?.siteName || getDomain(post.content)}</span>
            </div>
            <h2 class="url-title">{post.metadata?.title || 'Untitled'}</h2>
            {#if post.metadata?.description}
              <p class="url-desc">{post.metadata.description}</p>
            {/if}
            <button class="url-open" onclick={openUrl}>
              <ExternalLink size={14} />
              <span>Open</span>
              <span class="url-domain">{getDomain(post.content)}</span>
            </button>
          </div>
        
        <!-- Image/Video filename -->
        {:else if (post.content_type === 'image' || post.content_type === 'video') && post.metadata?.originalName}
          <div class="file-info">
            <p class="filename">{post.metadata.originalName}</p>
            {#if post.metadata?.mimeType}
              <p class="file-meta">{post.metadata.mimeType}</p>
            {/if}
          </div>
        
        <!-- Text content (full width) -->
        {:else if post.content_type === 'text'}
          <div class="text-block">
            {#if post.content?.trim()}
              <p class="text-content">{post.content}</p>
            {:else}
              <p class="text-empty">No content</p>
            {/if}
          </div>
        
        <!-- Audio content -->
        {:else if post.content_type === 'audio'}
          <div class="audio-block">
            <div class="audio-visual">
              <Music size={32} strokeWidth={1.5} />
            </div>
            {#if mediaUrl}
              <audio controls preload="metadata">
                <source src={mediaUrl} type={post.metadata?.mimeType || 'audio/mpeg'}>
              </audio>
            {/if}
            {#if post.metadata?.originalName}
              <p class="filename">{post.metadata.originalName}</p>
            {/if}
          </div>
        
        <!-- File content -->
        {:else if post.content_type === 'file'}
          <div class="file-block">
            <div class="file-icon">
              <Paperclip size={36} strokeWidth={1.5} />
            </div>
            <div class="file-details">
              <p class="filename">{post.metadata?.originalName || post.content}</p>
              <p class="file-meta">
                {#if post.metadata?.mimeType}
                  <span>{post.metadata.mimeType}</span>
                {/if}
                {#if post.metadata?.size}
                  <span>{Math.round(Number(post.metadata.size) / 1024)} KB</span>
                {/if}
              </p>
            </div>
            <button class="download-btn" onclick={downloadFile} title="Download">
              <Download size={16} />
            </button>
          </div>
        {/if}
        
        <!-- AI ANALYSIS (if any) -->
        {#if hasAIMetadata}
          <div class="ai-block">
            <div class="ai-header">
              <Bot size={14} />
              <span>AI Analysis</span>
            </div>
            
            {#if post.metadata?.aiDescription}
              <div class="ai-item">
                <label><Eye size={12} /> Description</label>
                <p>{post.metadata.aiDescription}</p>
              </div>
            {/if}
            
            {#if post.metadata?.aiSummary}
              <div class="ai-item">
                <label><Bot size={12} /> Summary</label>
                <p>{post.metadata.aiSummary}</p>
              </div>
            {/if}
            
            {#if post.metadata?.ocrText}
              <div class="ai-item">
                <label><FileSearch size={12} /> Extracted Text</label>
                <pre>{post.metadata.ocrText}</pre>
              </div>
            {/if}
            
            {#if post.metadata?.transcription}
              <div class="ai-item">
                <label><Music size={12} /> Transcription</label>
                <pre>{post.metadata.transcription}</pre>
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- TAGS (read-only) -->
        {#if tags.length > 0}
          <div class="tags-block">
            <div class="tags-header">
              <TagIcon size={14} />
              <span>Tags</span>
            </div>
            
            <div class="tags-list">
              {#each tags as tag (tag.id)}
                <span class="tag" class:ai={tag.is_ai_suggested}>
                  {#if tag.is_ai_suggested}
                    <Bot size={10} />
                  {/if}
                  {tag.name}
                </span>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- SOURCE -->
        <div class="source-block">
          <Globe size={12} />
          <span>via {post.source}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Overlay - must override canvas styles */
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 20px;
    /* Override canvas restrictions */
    touch-action: auto !important;
    user-select: text !important;
    pointer-events: auto !important;
    cursor: auto;
  }
  
  .overlay-bg {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    border: none;
    cursor: pointer;
    z-index: 1;
  }
  
  /* Modal */
  .modal {
    position: relative;
    background: #0f0f13;
    border: 1px solid #1e1e26;
    border-radius: 16px;
    width: 100%;
    max-width: 520px;
    max-height: calc(100vh - 40px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    animation: modal-in 0.2s ease-out;
    z-index: 2;
    /* Ensure interactivity */
    pointer-events: auto;
    user-select: text;
    cursor: auto;
  }
  
  .modal.two-column {
    max-width: 900px;
  }
  
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.96) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  
  /* Header */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #1e1e26;
    flex-shrink: 0;
  }
  
  .header-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #71717a;
  }
  
  .type-label {
    color: #a78bfa;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .meta-separator {
    opacity: 0.4;
  }
  
  .date-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
  
  .action-btn, .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #71717a;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    pointer-events: auto;
    z-index: 10;
  }
  
  .action-btn:hover, .close-btn:hover {
    background: #1e1e26;
    color: #fafafa;
  }
  
  /* Content Area */
  .modal-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    /* Ensure text selection works */
    user-select: text;
    cursor: auto;
  }
  
  .modal-content.two-column-content {
    flex-direction: row;
    gap: 20px;
  }
  
  /* Scrollbar */
  .modal-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .modal-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .modal-content::-webkit-scrollbar-thumb {
    background: #2a2a35;
    border-radius: 3px;
  }
  
  .modal-content::-webkit-scrollbar-thumb:hover {
    background: #3a3a45;
  }
  
  /* Media Column (left side - 40%) */
  .media-column {
    flex: 0 0 40%;
    min-width: 0;
  }
  
  .media-frame {
    position: relative;
    background: linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .media-frame img {
    width: 100%;
    max-height: 500px;
    object-fit: contain;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .media-frame img.loaded {
    opacity: 1;
  }
  
  .media-frame.video-frame {
    background: #000;
  }
  
  .media-frame.video-frame video {
    width: 100%;
    max-height: 500px;
    display: block;
  }
  
  .media-frame.url-frame img {
    max-height: 300px;
    object-fit: cover;
  }
  
  .loading-state {
    position: absolute;
    color: #71717a;
  }
  
  .loading-state :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* Details Column (right side - 60%) */
  .details-column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  /* URL Details */
  .url-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .url-site {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  
  .favicon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }
  
  .url-title {
    font-size: 18px;
    font-weight: 600;
    color: #fafafa;
    margin: 0;
    line-height: 1.4;
    user-select: text;
    cursor: text;
  }
  
  .url-desc {
    font-size: 14px;
    color: #a1a1aa;
    margin: 0;
    line-height: 1.5;
    user-select: text;
    cursor: text;
  }
  
  .url-open {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #6366f1;
    border: none;
    color: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    width: fit-content;
    margin-top: 8px;
    pointer-events: auto;
    z-index: 5;
  }
  
  .url-open:hover {
    background: #818cf8;
  }
  
  .url-domain {
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
  }
  
  /* File Info */
  .file-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .filename {
    font-size: 14px;
    color: #fafafa;
    margin: 0;
    word-break: break-all;
  }
  
  .file-meta {
    font-size: 12px;
    color: #71717a;
    margin: 0;
    display: flex;
    gap: 8px;
  }
  
  /* Text Block */
  .text-block {
    background: linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%);
    border-radius: 12px;
    padding: 20px;
  }
  
  .text-content {
    font-size: 15px;
    color: #1a1a1a;
    line-height: 1.7;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    cursor: text;
  }
  
  .text-empty {
    color: #888;
    font-style: italic;
    margin: 0;
  }
  
  /* Audio Block */
  .audio-block {
    background: linear-gradient(135deg, #1a1a22 0%, #151518 100%);
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  
  .audio-visual {
    color: #6366f1;
  }
  
  .audio-block audio {
    width: 100%;
    max-width: 400px;
  }
  
  /* File Block */
  .file-block {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, #1a1a22 0%, #151518 100%);
    border-radius: 12px;
    padding: 16px;
  }
  
  .file-icon {
    color: #71717a;
  }
  
  .file-details {
    flex: 1;
    min-width: 0;
  }
  
  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #6366f1;
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    transition: background 0.15s;
    pointer-events: auto;
    z-index: 5;
  }
  
  .download-btn:hover {
    background: #818cf8;
  }
  
  /* AI Block */
  .ai-block {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 12px;
    padding: 14px;
  }
  
  .ai-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }
  
  .ai-item {
    margin-bottom: 12px;
  }
  
  .ai-item:last-child {
    margin-bottom: 0;
  }
  
  .ai-item label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #8b8b99;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  
  .ai-item p {
    font-size: 13px;
    color: #e4e4e7;
    line-height: 1.5;
    margin: 0;
    user-select: text;
    cursor: text;
  }
  
  .ai-item pre {
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 11px;
    color: #d4d4d8;
    background: rgba(0, 0, 0, 0.2);
    padding: 10px;
    border-radius: 6px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 160px;
    overflow-y: auto;
    line-height: 1.5;
    user-select: text;
    cursor: text;
  }
  
  /* Tags Block (read-only) */
  .tags-block {
    background: #18181c;
    border-radius: 12px;
    padding: 14px;
  }
  
  .tags-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 10px;
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(99, 102, 241, 0.12);
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: #818cf8;
  }
  
  .tag.ai {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
  }
  
  /* Source Block */
  .source-block {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #52525b;
    padding-top: 4px;
    margin-top: auto;
  }
  
  /* Mobile: Stack columns vertically */
  @media (max-width: 640px) {
    .modal.two-column {
      max-width: 100%;
    }
    
    .modal-content.two-column-content {
      flex-direction: column;
    }
    
    .media-column {
      flex: none;
    }
    
    .media-frame img,
    .media-frame.video-frame video {
      max-height: 300px;
    }
  }
</style>
