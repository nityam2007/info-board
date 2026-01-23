import { Router, type Router as RouterType, Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.js';

const router: RouterType = Router();

// Export all data as JSON
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const includeFiles = _req.query.includeFiles !== 'false';
    const data = exportService.exportAll(includeFiles);
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="infoboard-export-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Import data from JSON
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const overwrite = req.query.overwrite === 'true';
    
    // Validate import data
    if (!data.version || !data.posts) {
      res.status(400).json({ error: 'Invalid import data format' });
      return;
    }
    
    const result = exportService.importAll(data, overwrite);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
