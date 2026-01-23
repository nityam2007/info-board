<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Post, type Tag, type Task } from '$lib/api';
  import { 
    X, Tag as TagIcon, CheckSquare, Sparkles, Plus, Trash2,
    Image, Video, Music, Link2, FileText, Paperclip,
    ExternalLink, Download, Loader2, Check
  } from 'lucide-svelte';
  
  interface Props {
    post: Post;
    onclose?: () => void;
  }
  
  let { post, onclose }: Props = $props();
  
  // State
  let tags = $state<Tag[]>(post.tags || []);
  let tasks = $state<Task[]>(post.tasks || []);
  let newTag = $state('');
  let newTask = $state('');
  let isLoadingAI = $state(false);
  let aiSuggestions = $state<{ tags: string[]; tasks: { description: string }[] } | null>(null);
  let imageLoaded = $state(false);
  
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
  
  onMount(async () => {
    try {
      const full = await api.posts.get(post.id);
      tags = full.tags || [];
      tasks = full.tasks || [];
    } catch (e) {
      console.error('Failed to load post details:', e);
    }
  });
  
  async function addTag() {
    if (!newTag.trim()) return;
    try {
      const tag = await api.tags.create(post.id, newTag.trim());
      tags = [...tags, tag];
      newTag = '';
    } catch (e) {
      console.error('Failed to add tag:', e);
    }
  }
  
  async function removeTag(id: string) {
    try {
      await api.tags.delete(id);
      tags = tags.filter(t => t.id !== id);
    } catch (e) {
      console.error('Failed to remove tag:', e);
    }
  }
  
  async function addTask() {
    if (!newTask.trim()) return;
    try {
      const task = await api.tasks.create(post.id, newTask.trim());
      tasks = [...tasks, task];
      newTask = '';
    } catch (e) {
      console.error('Failed to add task:', e);
    }
  }
  
  async function toggleTask(task: Task) {
    try {
      const updated = await api.tasks.update(task.id, { completed: !task.completed });
      tasks = tasks.map(t => t.id === task.id ? updated : t);
    } catch (e) {
      console.error('Failed to update task:', e);
    }
  }
  
  async function removeTask(id: string) {
    try {
      await api.tasks.delete(id);
      tasks = tasks.filter(t => t.id !== id);
    } catch (e) {
      console.error('Failed to remove task:', e);
    }
  }
  
  async function getAISuggestions() {
    isLoadingAI = true;
    try {
      aiSuggestions = await api.ai.suggest(post.id);
    } catch (e) {
      console.error('Failed to get AI suggestions:', e);
    } finally {
      isLoadingAI = false;
    }
  }
  
  async function applyAITag(tag: string) {
    try {
      const newTagObj = await api.tags.create(post.id, tag);
      tags = [...tags, { ...newTagObj, is_ai_suggested: true }];
      if (aiSuggestions) {
        aiSuggestions.tags = aiSuggestions.tags.filter(t => t !== tag);
      }
    } catch (e) {
      console.error('Failed to add AI tag:', e);
    }
  }
  
  async function applyAITask(description: string) {
    try {
      const task = await api.tasks.create(post.id, description);
      tasks = [...tasks, task];
      if (aiSuggestions) {
        aiSuggestions.tasks = aiSuggestions.tasks.filter(t => t.description !== description);
      }
    } catch (e) {
      console.error('Failed to add AI task:', e);
    }
  }
  
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
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" role="dialog" aria-modal="true">
  <button class="overlay-bg" onclick={() => onclose?.()} aria-label="Close"></button>
  
  <div class="modal">
    <button class="close-btn" onclick={() => onclose?.()} aria-label="Close">
      <X size={20} />
    </button>
    
    <!-- Media Section -->
    <div class="media-section">
      {#if post.content_type === 'image' && mediaUrl}
        <div class="image-container">
          <img 
            src={mediaUrl} 
            alt={post.metadata?.originalName || 'Image'} 
            onload={() => imageLoaded = true}
            class:loaded={imageLoaded}
          />
          {#if !imageLoaded}
            <div class="image-loading">
              <Loader2 size={24} class="spinner" />
            </div>
          {/if}
        </div>
        <div class="media-info">
          <span class="filename">{post.metadata?.originalName || post.content}</span>
          {#if post.metadata?.size}
            <span class="filesize">{Math.round(Number(post.metadata.size) / 1024)} KB</span>
          {/if}
        </div>
        
      {:else if post.content_type === 'video' && mediaUrl}
        <div class="video-container">
          <video controls preload="metadata">
            <source src={mediaUrl} type={post.metadata?.mimeType || 'video/mp4'}>
            <track kind="captions" />
          </video>
        </div>
        <div class="media-info">
          <span class="filename">{post.metadata?.originalName || post.content}</span>
        </div>
        
      {:else if post.content_type === 'audio' && mediaUrl}
        <div class="audio-container">
          <div class="audio-icon">
            <Music size={48} strokeWidth={1} />
          </div>
          <audio controls preload="metadata">
            <source src={mediaUrl} type={post.metadata?.mimeType || 'audio/mpeg'}>
          </audio>
          <div class="media-info">
            <span class="filename">{post.metadata?.originalName || post.content}</span>
          </div>
        </div>
        
      {:else if post.content_type === 'url'}
        <div class="url-preview">
          {#if mediaUrl}
            <div class="og-image-container">
              <img 
                src={mediaUrl} 
                alt={post.metadata?.title || 'Preview'} 
                onload={() => imageLoaded = true}
                onerror={() => mediaUrl = null}
                class:loaded={imageLoaded}
              />
            </div>
          {/if}
          
          <div class="url-info">
            <div class="url-header">
              {#if post.metadata?.favicon}
                <img class="favicon" src={post.metadata.favicon} alt="" onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
              {/if}
              <span class="site-name">{post.metadata?.siteName || getDomain(post.content)}</span>
            </div>
            
            <h2 class="url-title">{post.metadata?.title || post.content}</h2>
            
            {#if post.metadata?.description}
              <p class="url-description">{post.metadata.description}</p>
            {/if}
            
            <button class="open-url-btn" onclick={openUrl}>
              <ExternalLink size={16} />
              Open Link
              <span class="url-domain">{getDomain(post.content)}</span>
            </button>
          </div>
        </div>
        
      {:else if post.content_type === 'file'}
        <div class="file-preview">
          <div class="file-icon">
            <Paperclip size={48} strokeWidth={1} />
          </div>
          <div class="file-info">
            <span class="filename">{post.metadata?.originalName || post.content}</span>
            {#if post.metadata?.mimeType}
              <span class="mimetype">{post.metadata.mimeType}</span>
            {/if}
            {#if post.metadata?.size}
              <span class="filesize">{Math.round(Number(post.metadata.size) / 1024)} KB</span>
            {/if}
          </div>
          <button class="download-btn">
            <Download size={16} />
            Download
          </button>
        </div>
        
      {:else}
        <!-- Text content -->
        {@const TypeIcon = getTypeIcon(post.content_type)}
        <div class="text-preview">
          <span class="type-badge">
            <TypeIcon size={14} />
            {post.content_type}
          </span>
          {#if post.content?.trim()}
            <p class="content-text">{post.content}</p>
          {:else}
            <p class="content-empty">No content available</p>
          {/if}
        </div>
      {/if}
      
      <div class="meta-row">
        <span class="date">{new Date(post.created_at).toLocaleString()}</span>
        <span class="source">via {post.source}</span>
      </div>
    </div>
    
    <!-- Tags Section -->
    <div class="section">
      <h3>
        <TagIcon size={14} />
        Tags
      </h3>
      <div class="tags-list">
        {#each tags as tag (tag.id)}
          <span class="tag" class:ai={tag.is_ai_suggested}>
            {tag.name}
            <button class="remove-btn" onclick={() => removeTag(tag.id)}>
              <X size={12} />
            </button>
          </span>
        {/each}
        {#if tags.length === 0}
          <span class="empty-hint">No tags yet</span>
        {/if}
      </div>
      <div class="add-row">
        <input 
          type="text" 
          bind:value={newTag} 
          placeholder="Add tag..." 
          onkeydown={(e) => e.key === 'Enter' && addTag()}
        />
        <button onclick={addTag}>
          <Plus size={16} />
        </button>
      </div>
    </div>
    
    <!-- Tasks Section -->
    <div class="section">
      <h3>
        <CheckSquare size={14} />
        Tasks
      </h3>
      <div class="tasks-list">
        {#each tasks as task (task.id)}
          <div class="task" class:completed={task.completed}>
            <button class="checkbox" onclick={() => toggleTask(task)}>
              {#if task.completed}
                <Check size={14} />
              {/if}
            </button>
            <span>{task.description}</span>
            <button class="remove-btn" onclick={() => removeTask(task.id)}>
              <Trash2 size={12} />
            </button>
          </div>
        {/each}
        {#if tasks.length === 0}
          <span class="empty-hint">No tasks yet</span>
        {/if}
      </div>
      <div class="add-row">
        <input 
          type="text" 
          bind:value={newTask} 
          placeholder="Add task..." 
          onkeydown={(e) => e.key === 'Enter' && addTask()}
        />
        <button onclick={addTask}>
          <Plus size={16} />
        </button>
      </div>
    </div>
    
    <!-- AI Section -->
    <div class="section ai-section">
      <button class="ai-btn" onclick={getAISuggestions} disabled={isLoadingAI}>
        {#if isLoadingAI}
          <Loader2 size={18} class="spinner" />
          Analyzing...
        {:else}
          <Sparkles size={18} />
          Get AI Suggestions
        {/if}
      </button>
      
      {#if aiSuggestions}
        {#if aiSuggestions.tags.length > 0}
          <div class="ai-suggestions">
            <span class="label">Suggested tags:</span>
            {#each aiSuggestions.tags as tag}
              <button class="suggestion" onclick={() => applyAITag(tag)}>
                <Plus size={12} />
                {tag}
              </button>
            {/each}
          </div>
        {/if}
        
        {#if aiSuggestions.tasks.length > 0}
          <div class="ai-suggestions">
            <span class="label">Suggested tasks:</span>
            {#each aiSuggestions.tasks as task}
              <button class="suggestion task-suggestion" onclick={() => applyAITask(task.description)}>
                <Plus size={12} />
                {task.description}
              </button>
            {/each}
          </div>
        {/if}
        
        {#if aiSuggestions.tags.length === 0 && aiSuggestions.tasks.length === 0}
          <div class="no-suggestions">No suggestions available</div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .overlay-bg {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(12px);
    border: none;
    cursor: pointer;
  }
  
  .modal {
    position: relative;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    overflow-y: auto;
    padding: 0;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    animation: modal-in 0.25s ease-out;
  }
  
  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    color: var(--color-muted, #71717a);
    border-radius: 10px;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: rgba(0, 0, 0, 0.6);
    color: var(--color-fg, #fafafa);
  }
  
  /* Media Section */
  .media-section {
    padding: 0;
  }
  
  /* Image container - Paper finish */
  .image-container {
    position: relative;
    width: calc(100% - 32px);
    margin: 16px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 12px;
    overflow: hidden;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  }
  
  .image-container img {
    width: 100%;
    max-height: 400px;
    object-fit: contain;
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .image-container img.loaded {
    opacity: 1;
  }
  
  .image-loading {
    position: absolute;
    color: var(--color-muted, #71717a);
  }
  
  .image-loading :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .video-container {
    width: calc(100% - 32px);
    margin: 16px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  }
  
  .video-container video {
    width: 100%;
    max-height: 400px;
    background: #111;
  }
  
  .audio-container {
    padding: 32px;
    margin: 16px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 12px;
    text-align: center;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  }
  
  .audio-icon {
    color: var(--color-primary, #6366f1);
    margin-bottom: 20px;
  }
  
  .audio-container audio {
    width: 100%;
    max-width: 400px;
  }
  
  /* URL Preview - Paper finish like canvas cards */
  .url-preview {
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 12px;
    margin: 16px;
    overflow: hidden;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  }
  
  .og-image-container {
    width: 100%;
    max-height: 260px;
    overflow: hidden;
    background: #f0efe5;
  }
  
  .og-image-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .og-image-container img.loaded {
    opacity: 1;
  }
  
  .url-info {
    padding: 20px;
  }
  
  .url-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .favicon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
  }
  
  .site-name {
    font-size: 11px;
    color: var(--paper-text-muted, #555);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .url-title {
    font-size: 18px;
    color: var(--paper-text-dark, #1a1a1a);
    margin: 0 0 8px 0;
    font-weight: 600;
    line-height: 1.4;
  }
  
  .url-description {
    font-size: 14px;
    color: var(--paper-text-muted, #555);
    margin: 0 0 16px 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .open-url-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: var(--color-primary, #6366f1);
    padding: 10px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .open-url-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  
  .url-domain {
    color: var(--color-primary, #6366f1);
    font-size: 12px;
  }
  
  /* File Preview - Paper finish */
  .file-preview {
    padding: 32px;
    margin: 16px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  }
  
  .file-icon {
    color: var(--color-muted, #71717a);
  }
  
  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .filename {
    color: var(--paper-text-dark, #1a1a1a);
    font-size: 14px;
    word-break: break-all;
  }
  
  .mimetype {
    color: var(--paper-text-muted, #555);
    font-size: 12px;
  }
  
  .filesize {
    color: var(--paper-text-muted, #555);
    font-size: 12px;
  }
  
  .download-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    color: var(--color-primary, #6366f1);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .download-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  
  /* Text Preview - Paper finish like canvas cards */
  .text-preview {
    padding: 24px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 12px;
    margin: 16px;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.15);
  }
  
  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.06);
    padding: 5px 10px;
    border-radius: 6px;
    color: var(--paper-text-muted, #555);
    margin-bottom: 12px;
  }
  
  .content-text {
    color: var(--paper-text-dark, #1a1a1a);
    line-height: 1.7;
    margin: 0;
    white-space: pre-wrap;
    font-size: 16px;
    word-break: break-word;
  }
  
  .content-empty {
    color: var(--color-muted, #71717a);
    font-style: italic;
    margin: 0;
    font-size: 14px;
  }
  
  .media-info {
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border, #1e1e26);
    display: flex;
    gap: 16px;
    align-items: center;
  }
  
  .meta-row {
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .date {
    font-size: 13px;
    color: var(--color-muted, #71717a);
  }
  
  .source {
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }
  
  /* Sections */
  .section {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .section:last-child {
    border-bottom: none;
  }
  
  .section h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--color-muted, #71717a);
    margin: 0 0 12px 0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
    min-height: 32px;
  }
  
  .empty-hint {
    color: var(--color-muted, #71717a);
    font-size: 13px;
    font-style: italic;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--color-primary-hover, #818cf8);
  }
  
  .tag:hover {
    background: rgba(99, 102, 241, 0.25);
  }
  
  .tag.ai {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
  }
  
  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .remove-btn:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.15);
  }
  
  .add-row {
    display: flex;
    gap: 8px;
  }
  
  .add-row input {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border, #1e1e26);
    padding: 10px 14px;
    border-radius: 8px;
    color: var(--color-fg, #fafafa);
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
  }
  
  .add-row input:focus {
    border-color: var(--color-primary, #6366f1);
  }
  
  .add-row input::placeholder {
    color: var(--color-muted, #71717a);
  }
  
  .add-row button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    color: var(--color-fg, #fafafa);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .add-row button:hover {
    background: var(--color-primary-hover, #818cf8);
  }
  
  /* Tasks */
  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
    min-height: 32px;
  }
  
  .task {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    font-size: 14px;
  }
  
  .task.completed span {
    text-decoration: line-through;
    color: var(--color-muted, #71717a);
  }
  
  .task span {
    flex: 1;
    color: var(--color-fg, #fafafa);
  }
  
  .checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 2px solid var(--color-primary, #6366f1);
    border-radius: 6px;
    background: transparent;
    color: var(--color-primary-hover, #818cf8);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .checkbox:hover {
    border-color: var(--color-primary-hover, #818cf8);
  }
  
  .task.completed .checkbox {
    background: var(--color-primary, #6366f1);
    border-color: var(--color-primary, #6366f1);
  }
  
  /* AI Section */
  .ai-section {
    padding: 20px;
  }
  
  .ai-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: var(--color-primary-hover, #818cf8);
    padding: 14px 20px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .ai-btn:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.25);
  }
  
  .ai-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .ai-btn :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  
  .ai-suggestions {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  
  .ai-suggestions .label {
    font-size: 11px;
    color: var(--color-muted, #71717a);
    width: 100%;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .suggestion {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border: 1px solid rgba(99, 102, 241, 0.25);
    color: var(--color-primary-hover, #818cf8);
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .suggestion:hover {
    background: rgba(99, 102, 241, 0.25);
  }
  
  .task-suggestion {
    width: 100%;
    text-align: left;
  }
  
  .no-suggestions {
    margin-top: 16px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
    text-align: center;
  }
</style>
