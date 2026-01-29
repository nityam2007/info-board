import { getDatabase } from '../db/sqlite.js';
import type { Post } from '../types.js';
import { postsService } from './posts.js';

export interface FacetedSearchParams {
  q?: string;
  content_type?: string | string[];
  tag?: string | string[];
  source?: string | string[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
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

export const searchService = {
  // Basic search (backward compatible)
  search(params: FacetedSearchParams): Post[] {
    return this.facetedSearch(params).posts;
  },

  // Advanced faceted search
  facetedSearch(params: FacetedSearchParams): FacetedSearchResult {
    const db = getDatabase();
    const { 
      q, 
      content_type, 
      tag, 
      source,
      date_from,
      date_to,
      limit = 50, 
      offset = 0 
    } = params;

    // Build base WHERE clause
    let whereClause = `WHERE p.deleted_at IS NULL`;
    const sqlParams: any[] = [];

    // Full-text search on content AND metadata fields (ocrText, aiDescription, title, description)
    if (q) {
      whereClause += ` AND (
        p.content LIKE ? OR
        json_extract(p.metadata, '$.ocrText') LIKE ? OR
        json_extract(p.metadata, '$.aiDescription') LIKE ? OR
        json_extract(p.metadata, '$.title') LIKE ? OR
        json_extract(p.metadata, '$.description') LIKE ?
      )`;
      const searchTerm = `%${q}%`;
      sqlParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Content type filter (supports array)
    if (content_type) {
      const types = Array.isArray(content_type) ? content_type : [content_type];
      if (types.length > 0) {
        whereClause += ` AND p.content_type IN (${types.map(() => '?').join(',')})`;
        sqlParams.push(...types);
      }
    }

    // Source filter (supports array)
    if (source) {
      const sources = Array.isArray(source) ? source : [source];
      if (sources.length > 0) {
        whereClause += ` AND p.source IN (${sources.map(() => '?').join(',')})`;
        sqlParams.push(...sources);
      }
    }

    // Date range filters
    if (date_from) {
      whereClause += ` AND p.created_at >= ?`;
      sqlParams.push(date_from);
    }
    if (date_to) {
      whereClause += ` AND p.created_at <= ?`;
      sqlParams.push(date_to);
    }

    // Tag filter (requires join)
    let tagJoin = '';
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        tagJoin = ` INNER JOIN tags t ON p.id = t.post_id AND t.name IN (${tags.map(() => '?').join(',')})`;
        sqlParams.unshift(...tags.map(t => t.toLowerCase()));
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM posts p ${tagJoin} ${whereClause}`;
    const countStmt = db.prepare(countSql);
    const countResult = countStmt.get(...sqlParams) as { total: number };
    const total = countResult?.total || 0;

    // Get posts
    const postsSql = `
      SELECT DISTINCT p.* FROM posts p 
      ${tagJoin}
      ${whereClause}
      ORDER BY p.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const postsStmt = db.prepare(postsSql);
    const posts = (postsStmt.all(...sqlParams, limit, offset) as any[]).map(postsService.mapRow);

    // Get facets (counts for filter options)
    const facets = this.getFacets(q);

    return { posts, facets, total };
  },

  // Get facet counts for filter UI
  getFacets(query?: string): SearchFacets {
    const db = getDatabase();
    
    let whereClause = `WHERE deleted_at IS NULL`;
    const params: any[] = [];
    
    if (query) {
      // Search in content AND metadata fields
      whereClause += ` AND (
        content LIKE ? OR
        json_extract(metadata, '$.ocrText') LIKE ? OR
        json_extract(metadata, '$.aiDescription') LIKE ? OR
        json_extract(metadata, '$.title') LIKE ? OR
        json_extract(metadata, '$.description') LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Content type counts
    const typesSql = `
      SELECT content_type as value, COUNT(*) as count 
      FROM posts ${whereClause}
      GROUP BY content_type 
      ORDER BY count DESC
    `;
    const content_types = db.prepare(typesSql).all(...params) as { value: string; count: number }[];

    // Source counts
    const sourcesSql = `
      SELECT source as value, COUNT(*) as count 
      FROM posts ${whereClause}
      GROUP BY source 
      ORDER BY count DESC
    `;
    const sources = db.prepare(sourcesSql).all(...params) as { value: string; count: number }[];

    // Tag counts (top 20)
    const tagsSql = `
      SELECT t.name as value, COUNT(*) as count 
      FROM tags t
      INNER JOIN posts p ON t.post_id = p.id
      ${whereClause.replace('WHERE', 'WHERE p.')}
      GROUP BY t.name 
      ORDER BY count DESC
      LIMIT 20
    `;
    const tags = db.prepare(tagsSql).all(...params) as { value: string; count: number }[];

    // Date range
    const dateSql = `
      SELECT MIN(created_at) as min, MAX(created_at) as max 
      FROM posts ${whereClause}
    `;
    const dateResult = db.prepare(dateSql).get(...params) as { min: string; max: string } | undefined;
    const date_range = dateResult?.min ? { min: dateResult.min, max: dateResult.max } : null;

    return { content_types, sources, tags, date_range };
  },
};
