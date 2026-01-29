import { Router, type Router as RouterType } from 'express';
import { searchService, type FacetedSearchParams } from '../services/search.js';

export const searchRouter: RouterType = Router();

// Faceted search with filters
searchRouter.get('/', async (req, res) => {
  try {
    // Parse array params (e.g., content_type=text&content_type=image)
    const parseArrayParam = (param: unknown): string | string[] | undefined => {
      if (Array.isArray(param)) return param as string[];
      if (typeof param === 'string') return param;
      return undefined;
    };

    const params: FacetedSearchParams = {
      q: req.query.q as string,
      content_type: parseArrayParam(req.query.content_type),
      tag: parseArrayParam(req.query.tag),
      source: parseArrayParam(req.query.source),
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    };
    
    const result = searchService.facetedSearch(params);
    res.json({ 
      success: true, 
      data: result.posts, 
      facets: result.facets,
      total: result.total,
      count: result.posts.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get facets only (for filter UI initialization)
searchRouter.get('/facets', async (req, res) => {
  try {
    const q = req.query.q as string | undefined;
    const facets = searchService.getFacets(q);
    res.json({ success: true, data: facets });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
