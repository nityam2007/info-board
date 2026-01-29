<script lang="ts">
  import { api, type Post, type AdminStats, type AdminTag } from '$lib/api';
  import { Eye, FileSearch, Bot } from 'lucide-svelte';
  
  // Props
  interface Props {
    onnavigate?: (detail?: { view?: 'input' | 'canvas' | 'chat' | 'admin' }) => void;
  }
  let { onnavigate }: Props = $props();
  
  // Auth state
  let requiresAuth = $state(false);
  let isAuthenticated = $state(false);
  let authChecking = $state(true);
  let passwordInput = $state('');
  let authError = $state('');
  
  // State
  let activeTab = $state<'posts' | 'trash' | 'tags' | 'system'>('posts');
  let stats = $state<AdminStats | null>(null);
  let posts = $state<Post[]>([]);
  let totalPosts = $state(0);
  let deletedPosts = $state<Post[]>([]);
  let tags = $state<AdminTag[]>([]);
  let loading = $state(true);
  let error = $state('');
  
  // Filters
  let searchQuery = $state('');
  let contentTypeFilter = $state('');
  let showDeleted = $state(false);
  let currentPage = $state(0);
  const pageSize = 20;
  
  // Selection
  let selectedIds = $state<Set<string>>(new Set());
  let selectAll = $state(false);
  
  // Edit modal
  let editingPost = $state<Post | null>(null);
  let editContent = $state('');
  
  // Tag modal
  let showTagModal = $state(false);
  let tagModalMode = $state<'rename' | 'merge' | 'delete'>('rename');
  let tagOldName = $state('');
  let tagNewName = $state('');
  
  // Confirmation modal
  let confirmAction = $state<(() => Promise<void>) | null>(null);
  let confirmMessage = $state('');
  
  // Check auth status on mount
  $effect(() => {
    checkAuthStatus();
  });
  
  async function checkAuthStatus() {
    authChecking = true;
    try {
      const status = await api.admin.authStatus();
      requiresAuth = status.requiresAuth;
      isAuthenticated = !status.requiresAuth || api.admin.hasPassword();
      
      if (isAuthenticated) {
        loadData();
      }
    } catch (e) {
      // If auth check fails, assume auth is required
      requiresAuth = true;
      isAuthenticated = false;
    } finally {
      authChecking = false;
    }
  }
  
  async function handleLogin() {
    authError = '';
    api.admin.setPassword(passwordInput);
    
    try {
      // Try to fetch stats to verify password
      await api.admin.stats();
      isAuthenticated = true;
      loadData();
    } catch (e) {
      const err = e as Error & { requiresAuth?: boolean };
      if (err.requiresAuth) {
        authError = 'Invalid admin password';
        api.admin.clearPassword();
      } else {
        authError = err.message;
      }
    }
  }
  
  function handleLogout() {
    api.admin.clearPassword();
    isAuthenticated = false;
    passwordInput = '';
  }
  
  // Load data
  async function loadData() {
    loading = true;
    error = '';
    try {
      const [statsRes, postsRes, tagsRes] = await Promise.all([
        api.admin.stats(),
        api.admin.posts({ 
          limit: pageSize, 
          offset: currentPage * pageSize,
          includeDeleted: showDeleted,
          content_type: contentTypeFilter || undefined,
          search: searchQuery || undefined,
        }),
        api.admin.tags(),
      ]);
      stats = statsRes;
      posts = postsRes.posts;
      totalPosts = postsRes.total;
      tags = tagsRes;
    } catch (e) {
      const err = e as Error & { requiresAuth?: boolean };
      if (err.requiresAuth) {
        isAuthenticated = false;
        api.admin.clearPassword();
      } else {
        error = err.message;
      }
    } finally {
      loading = false;
    }
  }
  
  async function loadDeletedPosts() {
    try {
      deletedPosts = await api.admin.deletedPosts(100, 0);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  $effect(() => {
    if (isAuthenticated && activeTab === 'trash') {
      loadDeletedPosts();
    }
  });
  
  // Reload when filters change
  let filtersInitialized = false;
  $effect(() => {
    // Dependencies
    searchQuery;
    contentTypeFilter;
    showDeleted;
    currentPage;
    // Only reload if already authenticated and initialized
    if (isAuthenticated && filtersInitialized) {
      loadData();
    }
    filtersInitialized = true;
  });
  
  // Selection handlers
  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds = newSet;
    selectAll = newSet.size === posts.length;
  }
  
  function toggleSelectAll() {
    if (selectAll) {
      selectedIds = new Set();
      selectAll = false;
    } else {
      selectedIds = new Set(posts.map(p => p.id));
      selectAll = true;
    }
  }
  
  // Actions
  async function softDeletePost(id: string) {
    try {
      await api.posts.delete(id);
      await loadData();
      selectedIds = new Set();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  async function hardDeletePost(id: string) {
    confirmMessage = 'Permanently delete this post? This cannot be undone.';
    confirmAction = async () => {
      try {
        await api.admin.hardDelete(id);
        await loadData();
        await loadDeletedPosts();
        selectedIds = new Set();
      } catch (e) {
        error = (e as Error).message;
      }
    };
  }
  
  async function restorePost(id: string) {
    try {
      await api.admin.restore(id);
      await loadData();
      await loadDeletedPosts();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  async function bulkSoftDelete() {
    if (selectedIds.size === 0) return;
    confirmMessage = `Move ${selectedIds.size} posts to trash?`;
    confirmAction = async () => {
      try {
        await api.admin.bulkDelete(Array.from(selectedIds));
        await loadData();
        selectedIds = new Set();
        selectAll = false;
      } catch (e) {
        error = (e as Error).message;
      }
    };
  }
  
  async function bulkHardDelete() {
    if (selectedIds.size === 0) return;
    confirmMessage = `Permanently delete ${selectedIds.size} posts? This cannot be undone.`;
    confirmAction = async () => {
      try {
        await api.admin.bulkHardDelete(Array.from(selectedIds));
        await loadData();
        await loadDeletedPosts();
        selectedIds = new Set();
        selectAll = false;
      } catch (e) {
        error = (e as Error).message;
      }
    };
  }
  
  async function bulkRestore() {
    if (selectedIds.size === 0) return;
    try {
      await api.admin.bulkRestore(Array.from(selectedIds));
      await loadData();
      await loadDeletedPosts();
      selectedIds = new Set();
      selectAll = false;
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  async function emptyTrash() {
    confirmMessage = 'Permanently delete ALL posts in trash? This cannot be undone.';
    confirmAction = async () => {
      try {
        await api.admin.emptyTrash();
        await loadData();
        await loadDeletedPosts();
      } catch (e) {
        error = (e as Error).message;
      }
    };
  }
  
  // Edit post
  function openEditModal(post: Post) {
    editingPost = post;
    editContent = post.content;
  }
  
  async function saveEdit() {
    if (!editingPost) return;
    try {
      await api.admin.updatePost(editingPost.id, { content: editContent });
      editingPost = null;
      await loadData();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  // Tag operations
  function openTagModal(mode: 'rename' | 'merge' | 'delete', name = '') {
    tagModalMode = mode;
    tagOldName = name;
    tagNewName = '';
    showTagModal = true;
  }
  
  async function executeTagAction() {
    try {
      if (tagModalMode === 'rename') {
        await api.admin.renameTag(tagOldName, tagNewName);
      } else if (tagModalMode === 'merge') {
        await api.admin.mergeTags(tagOldName, tagNewName);
      } else if (tagModalMode === 'delete') {
        await api.admin.deleteTag(tagOldName);
      }
      showTagModal = false;
      tags = await api.admin.tags();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  // Database operations
  async function vacuumDatabase() {
    try {
      await api.admin.vacuumDatabase();
      alert('Database optimized successfully');
    } catch (e) {
      error = (e as Error).message;
    }
  }
  
  // Helpers
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }
  
  function truncate(text: string, length = 100) {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  }
  
  function getTypeIcon(type: string) {
    const icons: Record<string, string> = {
      text: '📝',
      image: '🖼️',
      audio: '🎵',
      video: '🎬',
      url: '🔗',
      file: '📎',
    };
    return icons[type] || '📄';
  }
  
  const totalPages = $derived(Math.ceil(totalPosts / pageSize));
</script>

<div class="admin-panel">
  {#if authChecking}
    <div class="auth-loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if requiresAuth && !isAuthenticated}
    <!-- Login Form -->
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-icon">🔐</span>
          <h1>Admin Access</h1>
          <p>Enter the admin password to continue</p>
        </div>
        <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <input
            type="password"
            placeholder="Admin password"
            bind:value={passwordInput}
            class="auth-input"
            autofocus
          />
          {#if authError}
            <div class="auth-error">{authError}</div>
          {/if}
          <button type="submit" class="btn btn-primary auth-btn">Login</button>
        </form>
        <button class="back-link" onclick={() => onnavigate?.({ view: 'input' })}>
          ← Back to Home
        </button>
      </div>
    </div>
  {:else}
    <!-- Admin Panel Content -->
    <!-- Header -->
    <header class="admin-header">
      <div class="header-left">
        <button class="back-btn" onclick={() => onnavigate?.({ view: 'input' })}>
          <span class="back-icon">←</span>
          <span class="back-text">Back</span>
        </button>
        <h1>Admin Panel</h1>
      </div>
      <div class="header-right">
        <div class="header-stats">
          {#if stats}
            <span class="stat"><span class="stat-value">{stats.totalPosts}</span> posts</span>
            <span class="stat"><span class="stat-value">{stats.deletedPosts}</span> trash</span>
            <span class="stat hide-mobile">{stats.storageUsed}</span>
          {/if}
        </div>
        {#if requiresAuth}
          <button class="logout-btn" onclick={handleLogout} title="Logout">
            <span class="logout-icon">🚪</span>
            <span class="logout-text">Logout</span>
          </button>
        {/if}
      </div>
    </header>
    
    <!-- Tabs -->
    <nav class="tabs">
      <button class="tab" class:active={activeTab === 'posts'} onclick={() => activeTab = 'posts'}>
        <span class="tab-icon">📝</span>
        <span class="tab-text">Posts</span>
      </button>
      <button class="tab" class:active={activeTab === 'trash'} onclick={() => activeTab = 'trash'}>
        <span class="tab-icon">🗑️</span>
        <span class="tab-text">Trash</span>
        {#if stats && stats.deletedPosts > 0}<span class="badge">{stats.deletedPosts}</span>{/if}
      </button>
      <button class="tab" class:active={activeTab === 'tags'} onclick={() => activeTab = 'tags'}>
        <span class="tab-icon">🏷️</span>
        <span class="tab-text">Tags</span>
      </button>
      <button class="tab" class:active={activeTab === 'system'} onclick={() => activeTab = 'system'}>
        <span class="tab-icon">⚙️</span>
        <span class="tab-text">System</span>
      </button>
    </nav>
  
  <!-- Error display -->
  {#if error}
    <div class="error-bar">
      {error}
      <button onclick={() => error = ''}>×</button>
    </div>
  {/if}
  
  <!-- Content -->
  <main class="admin-content">
    {#if activeTab === 'posts'}
      <!-- Posts Management -->
      <div class="toolbar">
        <input 
          type="text" 
          placeholder="Search posts..." 
          bind:value={searchQuery}
          class="search-input"
        />
        <select bind:value={contentTypeFilter} class="filter-select">
          <option value="">All Types</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="url">URL</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="file">File</option>
        </select>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={showDeleted} />
          Include deleted
        </label>
        <div class="toolbar-spacer"></div>
        {#if selectedIds.size > 0}
          <span class="selection-count">{selectedIds.size} selected</span>
          <button class="btn btn-warning" onclick={bulkSoftDelete}>Move to Trash</button>
          <button class="btn btn-danger" onclick={bulkHardDelete}>Delete Permanently</button>
        {/if}
      </div>
      
      {#if loading}
        <div class="loading">Loading...</div>
      {:else}
        <!-- Desktop Table View -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-check">
                <input type="checkbox" checked={selectAll} onchange={toggleSelectAll} />
              </th>
              <th class="col-type">Type</th>
              <th class="col-content">Content</th>
              <th class="col-source">Source</th>
              <th class="col-date">Created</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each posts as post}
              <tr class:deleted={post.deleted_at}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(post.id)} 
                    onchange={() => toggleSelect(post.id)} 
                  />
                </td>
                <td><span class="type-icon">{getTypeIcon(post.content_type)}</span></td>
                <td class="content-cell">
                  <div class="content-preview">{truncate(post.content, 80)}</div>
                  {#if post.deleted_at}
                    <span class="deleted-badge">Deleted</span>
                  {/if}
                </td>
                <td><span class="source-badge">{post.source}</span></td>
                <td class="date-cell">{formatDate(post.created_at)}</td>
                <td class="actions-cell">
                  <button class="icon-btn" title="Edit" onclick={() => openEditModal(post)}>✏️</button>
                  {#if post.deleted_at}
                    <button class="icon-btn" title="Restore" onclick={() => restorePost(post.id)}>♻️</button>
                    <button class="icon-btn danger" title="Delete Permanently" onclick={() => hardDeletePost(post.id)}>🗑️</button>
                  {:else}
                    <button class="icon-btn warning" title="Move to Trash" onclick={() => softDeletePost(post.id)}>🗑️</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        
        <!-- Mobile Card View -->
        <div class="posts-mobile">
          <div class="mobile-select-all">
            <label class="checkbox-label">
              <input type="checkbox" checked={selectAll} onchange={toggleSelectAll} />
              Select all
            </label>
          </div>
          {#each posts as post}
            <div class="post-card" class:deleted={post.deleted_at}>
              <div class="post-card-header">
                <div class="post-card-type">
                  <input 
                    type="checkbox" 
                    class="post-card-check"
                    checked={selectedIds.has(post.id)} 
                    onchange={() => toggleSelect(post.id)} 
                  />
                  <span class="type-icon">{getTypeIcon(post.content_type)}</span>
                  <span class="source-badge">{post.source}</span>
                  {#if post.deleted_at}
                    <span class="deleted-badge">Deleted</span>
                  {/if}
                </div>
              </div>
              <div class="post-card-content">{truncate(post.content, 120)}</div>
              <div class="post-card-meta">
                <span>{formatDate(post.created_at)}</span>
              </div>
              <div class="post-card-actions">
                <button class="btn btn-small" onclick={() => openEditModal(post)}>Edit</button>
                {#if post.deleted_at}
                  <button class="btn btn-small" onclick={() => restorePost(post.id)}>Restore</button>
                  <button class="btn btn-small btn-danger" onclick={() => hardDeletePost(post.id)}>Delete</button>
                {:else}
                  <button class="btn btn-small btn-warning" onclick={() => softDeletePost(post.id)}>Trash</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        
        <!-- Pagination -->
        <div class="pagination">
          <button 
            class="btn" 
            disabled={currentPage === 0} 
            onclick={() => currentPage--}
          >Previous</button>
          <span class="page-info">Page {currentPage + 1} of {totalPages}</span>
          <button 
            class="btn" 
            disabled={currentPage >= totalPages - 1} 
            onclick={() => currentPage++}
          >Next</button>
        </div>
      {/if}
    
    {:else if activeTab === 'trash'}
      <!-- Trash Management -->
      <div class="toolbar">
        <span class="toolbar-title">Deleted Posts</span>
        <div class="toolbar-spacer"></div>
        {#if deletedPosts.length > 0}
          <button class="btn btn-danger" onclick={emptyTrash}>Empty Trash</button>
        {/if}
      </div>
      
      {#if deletedPosts.length === 0}
        <div class="empty-state">
          <span class="empty-icon">🗑️</span>
          <p>Trash is empty</p>
        </div>
      {:else}
        <!-- Desktop Table View -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-type">Type</th>
              <th class="col-content">Content</th>
              <th class="col-date">Deleted</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each deletedPosts as post}
              <tr>
                <td><span class="type-icon">{getTypeIcon(post.content_type)}</span></td>
                <td class="content-cell">
                  <div class="content-preview">{truncate(post.content, 100)}</div>
                </td>
                <td class="date-cell">{formatDate(post.deleted_at!)}</td>
                <td class="actions-cell">
                  <button class="btn btn-small" onclick={() => restorePost(post.id)}>Restore</button>
                  <button class="btn btn-small btn-danger" onclick={() => hardDeletePost(post.id)}>Delete</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        
        <!-- Mobile Card View -->
        <div class="posts-mobile">
          {#each deletedPosts as post}
            <div class="post-card">
              <div class="post-card-header">
                <div class="post-card-type">
                  <span class="type-icon">{getTypeIcon(post.content_type)}</span>
                  <span class="source-badge">{post.source}</span>
                </div>
              </div>
              <div class="post-card-content">{truncate(post.content, 120)}</div>
              <div class="post-card-meta">
                <span>Deleted: {formatDate(post.deleted_at!)}</span>
              </div>
              <div class="post-card-actions">
                <button class="btn btn-small" onclick={() => restorePost(post.id)}>Restore</button>
                <button class="btn btn-small btn-danger" onclick={() => hardDeletePost(post.id)}>Delete Forever</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    
    {:else if activeTab === 'tags'}
      <!-- Tags Management -->
      <div class="toolbar">
        <span class="toolbar-title">Tags ({tags.length})</span>
        <div class="toolbar-spacer"></div>
      </div>
      
      <div class="tags-grid">
        {#each tags as tag}
          <div class="tag-card">
            <div class="tag-name">{tag.name}</div>
            <div class="tag-stats">
              <span>{tag.count} posts</span>
              {#if tag.ai_count > 0}
                <span class="ai-badge">{tag.ai_count} AI</span>
              {/if}
            </div>
            <div class="tag-actions">
              <button class="btn btn-small" onclick={() => openTagModal('rename', tag.name)}>Rename</button>
              <button class="btn btn-small" onclick={() => openTagModal('merge', tag.name)}>Merge</button>
              <button class="btn btn-small btn-danger" onclick={() => openTagModal('delete', tag.name)}>Delete</button>
            </div>
          </div>
        {/each}
      </div>
    
    {:else if activeTab === 'system'}
      <!-- System Info -->
      <div class="system-section">
        <h2>Statistics</h2>
        {#if stats}
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{stats.totalPosts}</div>
              <div class="stat-label">Total Posts</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.deletedPosts}</div>
              <div class="stat-label">In Trash</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.storageUsed}</div>
              <div class="stat-label">Storage Used</div>
            </div>
          </div>
          
          <h3>Posts by Type</h3>
          <div class="type-breakdown">
            {#each Object.entries(stats.postsByType) as [type, count]}
              <div class="type-row">
                <span class="type-icon">{getTypeIcon(type)}</span>
                <span class="type-name">{type}</span>
                <span class="type-count">{count}</span>
              </div>
            {/each}
          </div>
          
          <h3>Posts by Source</h3>
          <div class="type-breakdown">
            {#each Object.entries(stats.postsBySource) as [source, count]}
              <div class="type-row">
                <span class="type-name">{source}</span>
                <span class="type-count">{count}</span>
              </div>
            {/each}
          </div>
          
          {#if stats.oldestPost}
            <p class="date-range">
              Posts from <strong>{formatDate(stats.oldestPost)}</strong> to <strong>{formatDate(stats.newestPost!)}</strong>
            </p>
          {/if}
        {/if}
        
        <h2>Database Actions</h2>
        <div class="action-buttons">
          <button class="btn" onclick={vacuumDatabase}>Optimize Database</button>
          <button class="btn" onclick={() => api.export.download(true)}>Export All Data</button>
        </div>
      </div>
    {/if}
  </main>
  
  <!-- Edit Modal -->
  {#if editingPost}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => editingPost = null} onkeydown={(e) => e.key === 'Escape' && (editingPost = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Edit Post</h2>
          <button class="close-btn" onclick={() => editingPost = null}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Content</label>
            <textarea bind:value={editContent} rows={10}></textarea>
          </div>
          <div class="form-info">
            <p><strong>Type:</strong> {editingPost.content_type}</p>
            <p><strong>Created:</strong> {formatDate(editingPost.created_at)}</p>
            <p><strong>Source:</strong> {editingPost.source}</p>
          </div>
          
          {#if editingPost.metadata?.aiDescription || editingPost.metadata?.ocrText}
            <div class="ai-metadata-section">
              <h4 class="ai-section-header">
                <Bot size={14} />
                AI Analysis
              </h4>
              {#if editingPost.metadata?.aiDescription}
                <div class="ai-metadata-item">
                  <label>
                    <Eye size={12} />
                    AI Description
                  </label>
                  <p class="ai-description">{editingPost.metadata.aiDescription}</p>
                </div>
              {/if}
              {#if editingPost.metadata?.ocrText}
                <div class="ai-metadata-item">
                  <label>
                    <FileSearch size={12} />
                    Extracted Text (OCR)
                  </label>
                  <pre class="ocr-text">{editingPost.metadata.ocrText}</pre>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="btn" onclick={() => editingPost = null}>Cancel</button>
          <button class="btn btn-primary" onclick={saveEdit}>Save Changes</button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Tag Modal -->
  {#if showTagModal}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => showTagModal = false} onkeydown={(e) => e.key === 'Escape' && (showTagModal = false)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="modal modal-small" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>
            {#if tagModalMode === 'rename'}Rename Tag
            {:else if tagModalMode === 'merge'}Merge Tags
            {:else}Delete Tag{/if}
          </h2>
          <button class="close-btn" onclick={() => showTagModal = false}>×</button>
        </div>
        <div class="modal-body">
          {#if tagModalMode === 'delete'}
            <p>Delete all occurrences of tag "<strong>{tagOldName}</strong>"?</p>
          {:else}
            <div class="form-group">
              <label>{tagModalMode === 'rename' ? 'Current name' : 'Source tag'}</label>
              <input type="text" bind:value={tagOldName} readonly={tagModalMode !== 'rename'} />
            </div>
            <div class="form-group">
              <label>{tagModalMode === 'rename' ? 'New name' : 'Target tag'}</label>
              <input type="text" bind:value={tagNewName} placeholder="Enter tag name" />
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="btn" onclick={() => showTagModal = false}>Cancel</button>
          <button 
            class="btn {tagModalMode === 'delete' ? 'btn-danger' : 'btn-primary'}" 
            onclick={executeTagAction}
            disabled={tagModalMode !== 'delete' && !tagNewName.trim()}
          >
            {#if tagModalMode === 'rename'}Rename
            {:else if tagModalMode === 'merge'}Merge
            {:else}Delete{/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Confirmation Modal -->
  {#if confirmAction}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => confirmAction = null} onkeydown={(e) => e.key === 'Escape' && (confirmAction = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="modal modal-small" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Confirm Action</h2>
        </div>
        <div class="modal-body">
          <p>{confirmMessage}</p>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick={() => confirmAction = null}>Cancel</button>
          <button class="btn btn-danger" onclick={() => { confirmAction?.(); confirmAction = null; }}>Confirm</button>
        </div>
      </div>
    </div>
  {/if}
  {/if}
</div>

<style>
  .admin-panel {
    min-height: 100vh;
    background: var(--color-bg, #08080c);
    color: var(--color-fg, #fafafa);
  }
  
  /* Header */
  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: var(--color-surface, #121218);
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .back-btn {
    background: transparent;
    border: 1px solid var(--color-border, #1e1e26);
    color: var(--color-fg, #fafafa);
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .back-btn:hover {
    background: var(--color-surface, #121218);
    border-color: var(--color-primary, #6366f1);
  }
  
  h1 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }
  
  .header-stats {
    display: flex;
    gap: 24px;
  }
  
  .header-stats .stat {
    font-size: 14px;
    color: var(--color-muted, #71717a);
  }
  
  /* Tabs */
  .tabs {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
    background: var(--color-surface, #121218);
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .tab {
    background: transparent;
    border: none;
    color: var(--color-muted, #71717a);
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .tab:hover {
    background: rgba(255,255,255,0.05);
    color: var(--color-fg, #fafafa);
  }
  
  .tab.active {
    background: var(--color-primary, #6366f1);
    color: white;
  }
  
  .badge {
    background: rgba(255,255,255,0.2);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }
  
  /* Error bar */
  .error-bar {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 12px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .error-bar button {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 20px;
    cursor: pointer;
  }
  
  /* Content */
  .admin-content {
    padding: 24px;
  }
  
  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  
  .toolbar-title {
    font-size: 16px;
    font-weight: 500;
  }
  
  .toolbar-spacer {
    flex: 1;
  }
  
  .search-input {
    width: 250px;
    padding: 10px 16px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 6px;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--color-primary, #6366f1);
  }
  
  .filter-select {
    padding: 10px 16px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 6px;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }
  
  .selection-count {
    font-size: 14px;
    color: var(--color-primary, #6366f1);
    margin-right: 8px;
  }
  
  /* Buttons */
  .btn {
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    background: var(--color-surface, #121218);
    color: var(--color-fg, #fafafa);
    border: 1px solid var(--color-border, #1e1e26);
  }
  
  .btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: var(--color-primary, #6366f1);
    border-color: var(--color-primary, #6366f1);
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #818cf8);
  }
  
  .btn-warning {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.5);
    color: #f59e0b;
  }
  
  .btn-danger {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }
  
  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    font-size: 16px;
    transition: background 0.2s;
  }
  
  .icon-btn:hover {
    background: rgba(255,255,255,0.1);
  }
  
  .icon-btn.warning:hover {
    background: rgba(245, 158, 11, 0.2);
  }
  
  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  /* Table */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--color-surface, #121218);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .data-table th,
  .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .data-table th {
    background: rgba(0,0,0,0.2);
    font-weight: 500;
    font-size: 13px;
    color: var(--color-muted, #71717a);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .data-table tr:hover {
    background: rgba(255,255,255,0.02);
  }
  
  .data-table tr.deleted {
    opacity: 0.6;
  }
  
  .col-check { width: 40px; }
  .col-type { width: 60px; }
  .col-source { width: 100px; }
  .col-date { width: 160px; }
  .col-actions { width: 140px; }
  
  .type-icon {
    font-size: 18px;
  }
  
  .content-cell {
    position: relative;
  }
  
  .content-preview {
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400px;
  }
  
  .deleted-badge {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
  }
  
  .source-badge {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-primary, #6366f1);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
  
  .date-cell {
    font-size: 13px;
    color: var(--color-muted, #71717a);
  }
  
  .actions-cell {
    display: flex;
    gap: 4px;
  }
  
  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border, #1e1e26);
  }
  
  .page-info {
    font-size: 14px;
    color: var(--color-muted, #71717a);
  }
  
  /* Loading & Empty states */
  .loading {
    text-align: center;
    padding: 60px;
    color: var(--color-muted, #71717a);
  }
  
  .empty-state {
    text-align: center;
    padding: 60px;
    color: var(--color-muted, #71717a);
  }
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  /* Tags grid */
  .tags-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .tag-card {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    padding: 16px;
  }
  
  .tag-name {
    font-weight: 500;
    margin-bottom: 8px;
  }
  
  .tag-stats {
    font-size: 13px;
    color: var(--color-muted, #71717a);
    margin-bottom: 12px;
    display: flex;
    gap: 12px;
  }
  
  .ai-badge {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  }
  
  .tag-actions {
    display: flex;
    gap: 8px;
  }
  
  /* System section */
  .system-section h2 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  
  .system-section h3 {
    font-size: 14px;
    color: var(--color-muted, #71717a);
    margin: 24px 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .stat-card {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }
  
  .stat-value {
    font-size: 32px;
    font-weight: 600;
    color: var(--color-primary, #6366f1);
  }
  
  .stat-label {
    font-size: 13px;
    color: var(--color-muted, #71717a);
    margin-top: 4px;
  }
  
  .type-breakdown {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .type-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .type-row:last-child {
    border-bottom: none;
  }
  
  .type-name {
    flex: 1;
    text-transform: capitalize;
  }
  
  .type-count {
    font-weight: 500;
    color: var(--color-primary, #6366f1);
  }
  
  .date-range {
    font-size: 14px;
    color: var(--color-muted, #71717a);
    margin-top: 24px;
  }
  
  .action-buttons {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }
  
  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  
  .modal {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: auto;
  }
  
  .modal-small {
    max-width: 400px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }
  
  .modal-header h2 {
    font-size: 18px;
    margin: 0;
  }
  
  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-muted, #71717a);
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }
  
  .close-btn:hover {
    color: var(--color-fg, #fafafa);
  }
  
  .modal-body {
    padding: 20px;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border, #1e1e26);
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    font-size: 13px;
    color: var(--color-muted, #71717a);
    margin-bottom: 8px;
  }
  
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 12px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 6px;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
  }
  
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary, #6366f1);
  }
  
  .form-info {
    background: rgba(0,0,0,0.2);
    padding: 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  
  .form-info p {
    margin: 4px 0;
  }
  
  /* AI Metadata Section */
  .ai-metadata-section {
    margin-top: 16px;
    padding: 16px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 12px;
  }
  
  .ai-section-header {
    font-size: 12px;
    font-weight: 600;
    color: #a78bfa;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .ai-metadata-item {
    margin-bottom: 16px;
  }
  
  .ai-metadata-item:last-child {
    margin-bottom: 0;
  }
  
  .ai-metadata-item label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #a78bfa;
    margin-bottom: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .ai-description {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-fg, #fafafa);
    margin: 0;
  }
  
  .ocr-text {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 6px;
    color: var(--color-fg, #fafafa);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    max-height: 200px;
    overflow-y: auto;
  }
  
  /* Auth Styles */
  .auth-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 16px;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border, #1e1e26);
    border-top-color: var(--color-primary, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .auth-card {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    padding: 32px;
    width: 100%;
    max-width: 380px;
    text-align: center;
  }
  
  .auth-header {
    margin-bottom: 24px;
  }
  
  .auth-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .auth-header h1 {
    font-size: 24px;
    margin: 0 0 8px;
  }
  
  .auth-header p {
    color: var(--color-muted, #71717a);
    font-size: 14px;
    margin: 0;
  }
  
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .auth-input {
    width: 100%;
    padding: 14px 16px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    color: var(--color-fg, #fafafa);
    font-size: 16px;
    text-align: center;
  }
  
  .auth-input:focus {
    outline: none;
    border-color: var(--color-primary, #6366f1);
  }
  
  .auth-error {
    color: #ef4444;
    font-size: 14px;
    padding: 8px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 6px;
  }
  
  .auth-btn {
    padding: 14px 24px;
    font-size: 16px;
  }
  
  .back-link {
    background: transparent;
    border: none;
    color: var(--color-muted, #71717a);
    font-size: 14px;
    cursor: pointer;
    margin-top: 20px;
    padding: 8px;
  }
  
  .back-link:hover {
    color: var(--color-fg, #fafafa);
  }
  
  /* Header improvements */
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .header-stats .stat-value {
    color: var(--color-primary, #6366f1);
    font-weight: 600;
  }
  
  .logout-btn {
    background: transparent;
    border: 1px solid var(--color-border, #1e1e26);
    color: var(--color-muted, #71717a);
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .logout-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
  
  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  /* Tab improvements */
  .tab-icon {
    font-size: 16px;
  }
  
  /* Mobile post cards (replaces table on small screens) */
  .posts-mobile {
    display: none;
  }
  
  .mobile-select-all {
    margin-bottom: 12px;
    padding: 12px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
  }
  
  .post-card {
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
  }
  
  .post-card.deleted {
    opacity: 0.6;
  }
  
  .post-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  
  .post-card-type {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .post-card-check {
    margin-right: 8px;
  }
  
  .post-card-content {
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 12px;
    word-break: break-word;
  }
  
  .post-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--color-muted, #71717a);
    margin-bottom: 12px;
  }
  
  .post-card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  /* ========== RESPONSIVE STYLES ========== */
  
  /* Tablet and below */
  @media (max-width: 768px) {
    .admin-header {
      flex-direction: column;
      gap: 12px;
      padding: 12px 16px;
    }
    
    .header-left {
      width: 100%;
      justify-content: space-between;
    }
    
    .header-right {
      width: 100%;
      justify-content: space-between;
    }
    
    .header-stats {
      gap: 12px;
    }
    
    .header-stats .stat {
      font-size: 12px;
    }
    
    h1 {
      font-size: 18px;
    }
    
    .tabs {
      padding: 8px 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    .tab {
      padding: 8px 12px;
      font-size: 13px;
      white-space: nowrap;
    }
    
    .admin-content {
      padding: 16px;
    }
    
    .toolbar {
      gap: 8px;
    }
    
    .search-input {
      width: 100%;
      order: -1;
    }
    
    .filter-select {
      flex: 1;
      min-width: 0;
    }
    
    .checkbox-label {
      font-size: 12px;
    }
    
    /* Hide table, show cards */
    .data-table {
      display: none;
    }
    
    .posts-mobile {
      display: block;
    }
    
    .selection-count {
      width: 100%;
      text-align: center;
      margin: 8px 0;
    }
    
    .btn-warning,
    .btn-danger {
      flex: 1;
      text-align: center;
    }
    
    .pagination {
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .pagination .btn {
      flex: 1;
    }
    
    .tags-grid {
      grid-template-columns: 1fr;
    }
    
    .tag-actions {
      flex-wrap: wrap;
    }
    
    .tag-actions .btn-small {
      flex: 1;
      text-align: center;
    }
    
    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    
    .stat-card {
      padding: 12px;
    }
    
    .stat-value {
      font-size: 24px;
    }
    
    .action-buttons {
      flex-direction: column;
    }
    
    .action-buttons .btn {
      width: 100%;
    }
    
    .modal {
      width: 95%;
      max-height: 90vh;
    }
    
    .modal-footer {
      flex-direction: column-reverse;
    }
    
    .modal-footer .btn {
      width: 100%;
    }
  }
  
  /* Mobile - small screens */
  @media (max-width: 480px) {
    .back-text,
    .logout-text {
      display: none;
    }
    
    .back-btn,
    .logout-btn {
      padding: 8px;
    }
    
    .tab-text {
      display: none;
    }
    
    .tab {
      padding: 10px 14px;
    }
    
    .tab-icon {
      font-size: 18px;
    }
    
    .hide-mobile {
      display: none;
    }
    
    .header-stats {
      gap: 8px;
    }
    
    .header-stats .stat {
      font-size: 11px;
    }
    
    .stats-grid {
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    
    .stat-card {
      padding: 10px 8px;
    }
    
    .stat-value {
      font-size: 20px;
    }
    
    .stat-label {
      font-size: 10px;
    }
    
    .type-breakdown {
      font-size: 13px;
    }
    
    .type-row {
      padding: 10px 12px;
    }
    
    .auth-card {
      padding: 24px 20px;
    }
    
    .auth-icon {
      font-size: 40px;
    }
    
    .auth-header h1 {
      font-size: 20px;
    }
  }
</style>
