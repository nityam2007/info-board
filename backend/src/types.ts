// Post entity - immutable source of truth
export interface Post {
  id: string;
  content: string;
  content_type: 'text' | 'image' | 'audio' | 'video' | 'url' | 'file';
  source: 'manual' | 'clipboard' | 'upload' | 'api' | 'extension';
  metadata: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
}

// File upload metadata
export interface FileMetadata {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string; // For URL posts
  title?: string; // Extracted title for URLs
  description?: string; // Extracted description
}

// Tag entity - reference to post
export interface Tag {
  id: string;
  post_id: string;
  name: string;
  is_ai_suggested: boolean;
  created_at: string;
}

// Task entity - reference to post
export interface Task {
  id: string;
  post_id: string;
  description: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

// API Request/Response types
export interface CreatePostRequest {
  content: string;
  content_type?: Post['content_type'];
  source?: Post['source'];
  metadata?: Record<string, unknown>;
}

export interface UploadFileResponse {
  filename: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface CreateTagRequest {
  post_id: string;
  name: string;
  is_ai_suggested?: boolean;
}

export interface CreateTaskRequest {
  post_id: string;
  description: string;
  due_date?: string;
}

export interface UpdateTaskRequest {
  description?: string;
  due_date?: string | null;
  completed?: boolean;
}

export interface SearchParams {
  q?: string;
  content_type?: Post['content_type'];
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
