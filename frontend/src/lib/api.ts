const API_BASE = '/api';

export interface Post {
  id: string;
  content: string;
  content_type: 'text' | 'image' | 'audio' | 'video' | 'url' | 'file';
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
  tags?: Tag[];
  tasks?: Task[];
}

export interface Tag {
  id: string;
  post_id: string;
  name: string;
  is_ai_suggested: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  post_id: string;
  description: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

export interface Stats {
  totalPosts: number;
  postsByType: Record<string, number>;
  postsToday: number;
  postsThisWeek: number;
  streak: number;
  recentTags: { name: string; count: number }[];
}

export interface ExportData {
  version: string;
  exportedAt: string;
  posts: Post[];
  tags: Tag[];
  tasks: Task[];
  files: { path: string; base64: string }[];
}

export interface ImportResult {
  success: boolean;
  postsImported: number;
  tagsImported: number;
  tasksImported: number;
  filesImported: number;
  errors: string[];
}

export interface AdminStats {
  totalPosts: number;
  deletedPosts: number;
  postsByType: Record<string, number>;
  postsBySource: Record<string, number>;
  storageUsed: string;
  oldestPost: string | null;
  newestPost: string | null;
}

export interface AdminPostsResult {
  posts: Post[];
  total: number;
}

export interface AdminTag {
  name: string;
  count: number;
  ai_count: number;
}

export interface SearchFacets {
  content_types: { value: string; count: number }[];
  sources: { value: string; count: number }[];
  tags: { value: string; count: number }[];
  date_range: { min: string; max: string } | null;
}

export interface FacetedSearchResult {
  posts: Post[];
  facets: SearchFacets;
  total: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Include cookies for auth
    ...options,
  });
  
  // Handle 401 unauthorized
  if (res.status === 401) {
    const json = await res.json();
    throw new Error(json.error || 'Unauthorized');
  }
  
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json.data as T;
}

// Auth
export const auth = {
  status: async () => {
    const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
    return res.json() as Promise<{ authRequired: boolean }>;
  },
  login: async (password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    return res.json() as Promise<{ success: boolean; error?: string }>;
  },
  logout: async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.json() as Promise<{ success: boolean }>;
  },
};

// Posts
export const api = {
  posts: {
    create: (content: string, contentType = 'text') =>
      request<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({ content, content_type: contentType }),
      }),
    list: (limit = 50, offset = 0) =>
      request<Post[]>(`/posts?limit=${limit}&offset=${offset}`),
    get: (id: string) =>
      request<Post>(`/posts/${id}`),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/posts/${id}`, { method: 'DELETE' }),
    stats: () =>
      request<Stats>('/posts/stats'),
  },

  tags: {
    create: (postId: string, name: string) =>
      request<Tag>('/tags', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, name }),
      }),
    list: () => request<{ name: string; count: number }[]>('/tags'),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/tags/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    create: (postId: string, description: string) =>
      request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, description }),
      }),
    list: (completed?: boolean) => {
      const params = completed !== undefined ? `?completed=${completed}` : '';
      return request<Task[]>(`/tasks${params}`);
    },
    update: (id: string, data: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  },

  search: {
    // Simple search
    simple: (q: string, options?: { tag?: string; contentType?: string }) => {
      const params = new URLSearchParams({ q });
      if (options?.tag) params.set('tag', options.tag);
      if (options?.contentType) params.set('content_type', options.contentType);
      return request<Post[]>(`/search?${params}`);
    },
    // Faceted search
    faceted: (options: {
      q?: string;
      content_type?: string[];
      tag?: string[];
      source?: string[];
      date_from?: string;
      date_to?: string;
      limit?: number;
      offset?: number;
    }) => {
      const params = new URLSearchParams();
      if (options.q) params.set('q', options.q);
      if (options.content_type?.length) {
        options.content_type.forEach(t => params.append('content_type', t));
      }
      if (options.tag?.length) {
        options.tag.forEach(t => params.append('tag', t));
      }
      if (options.source?.length) {
        options.source.forEach(s => params.append('source', s));
      }
      if (options.date_from) params.set('date_from', options.date_from);
      if (options.date_to) params.set('date_to', options.date_to);
      if (options.limit) params.set('limit', String(options.limit));
      if (options.offset) params.set('offset', String(options.offset));
      return request<FacetedSearchResult>(`/search?${params}`);
    },
    // Get facets only
    facets: () => request<SearchFacets>('/search/facets'),
  },

  ai: {
    suggest: (postId: string) =>
      request<{ tags: string[]; tasks: { description: string; dueDate?: string }[]; description: string }>(
        `/ai/suggest/${postId}`,
        { method: 'POST', body: JSON.stringify({}) }
      ),
    chat: (query: string) =>
      request<{ response: string; sources: { id: string; preview: string }[] }>(
        '/ai/chat',
        { method: 'POST', body: JSON.stringify({ query }) }
      ),
  },

  upload: {
    // Upload file as base64
    file: (file: File) => {
      return new Promise<Post>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const result = await request<{ post: Post }>('/upload', {
              method: 'POST',
              body: JSON.stringify({
                file: base64,
                filename: file.name,
                mimeType: file.type,
                source: 'upload',
              }),
            });
            resolve(result.post);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    // Upload URL with metadata extraction
    url: (url: string) =>
      request<Post>('/upload/url', {
        method: 'POST',
        body: JSON.stringify({ url, source: 'manual' }),
      }),
  },

  export: {
    // Export all data
    download: async (includeFiles = true) => {
      const res = await fetch(`${API_BASE}/export?includeFiles=${includeFiles}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `infoboard-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return data as ExportData;
    },
    // Import data
    import: async (data: ExportData, overwrite = false) => {
      const res = await fetch(`${API_BASE}/export/import?overwrite=${overwrite}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Import failed');
      return res.json() as Promise<ImportResult>;
    },
  },

  admin: {
    // Get admin stats
    stats: () => request<AdminStats>('/admin/stats'),
    
    // List posts with filters
    posts: (options: { 
      limit?: number; 
      offset?: number; 
      includeDeleted?: boolean; 
      content_type?: string;
      search?: string;
    } = {}) => {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.offset) params.set('offset', String(options.offset));
      if (options.includeDeleted) params.set('includeDeleted', 'true');
      if (options.content_type) params.set('content_type', options.content_type);
      if (options.search) params.set('search', options.search);
      return request<AdminPostsResult>(`/admin/posts?${params}`);
    },
    
    // List deleted posts
    deletedPosts: (limit = 50, offset = 0) =>
      request<Post[]>(`/admin/posts/deleted?limit=${limit}&offset=${offset}`),
    
    // Edit post
    updatePost: (id: string, data: { content?: string; content_type?: string; metadata?: Record<string, unknown> }) =>
      request<Post>(`/admin/posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    // Hard delete (permanent)
    hardDelete: (id: string) =>
      request<{ deleted: boolean; permanent: boolean }>(`/admin/posts/${id}/hard`, { method: 'DELETE' }),
    
    // Restore soft-deleted post
    restore: (id: string) =>
      request<{ restored: boolean }>(`/admin/posts/${id}/restore`, { method: 'POST' }),
    
    // Bulk soft delete
    bulkDelete: (ids: string[]) =>
      request<{ deleted: number }>('/admin/posts/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    
    // Bulk hard delete
    bulkHardDelete: (ids: string[]) =>
      request<{ deleted: number; permanent: boolean }>('/admin/posts/bulk-hard-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    
    // Bulk restore
    bulkRestore: (ids: string[]) =>
      request<{ restored: number }>('/admin/posts/bulk-restore', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    
    // Empty trash
    emptyTrash: () =>
      request<{ deleted: number }>('/admin/posts/empty-trash', { method: 'POST' }),
    
    // Tags
    tags: () => request<AdminTag[]>('/admin/tags'),
    
    renameTag: (oldName: string, newName: string) =>
      request<{ renamed: number }>('/admin/tags/rename', {
        method: 'POST',
        body: JSON.stringify({ oldName, newName }),
      }),
    
    mergeTags: (sourceTag: string, targetTag: string) =>
      request<{ merged: number }>('/admin/tags/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceTag, targetTag }),
      }),
    
    deleteTag: (name: string) =>
      request<{ deleted: number }>(`/admin/tags/name/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    
    // Database
    databaseInfo: () => request<{ tables: string[]; counts: Record<string, number> }>('/admin/database'),
    
    vacuumDatabase: () => request<{ message: string }>('/admin/database/vacuum', { method: 'POST' }),
  },
};
