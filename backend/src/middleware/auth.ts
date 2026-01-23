import { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config.js';

/**
 * Simple password authentication middleware
 * Uses CONFIG.PASSWORD from environment
 * Password can be sent via:
 * - Authorization header: Bearer <password>
 * - X-Password header: <password>
 * - Query param: ?password=<password>
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no password is configured
  if (!CONFIG.PASSWORD) {
    next();
    return;
  }

  // Check various auth methods
  let providedPassword: string | undefined;

  // 1. Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    providedPassword = authHeader.slice(7);
  }

  // 2. X-Password header
  if (!providedPassword && req.headers['x-password']) {
    providedPassword = req.headers['x-password'] as string;
  }

  // 3. Query parameter
  if (!providedPassword && req.query.password) {
    providedPassword = req.query.password as string;
  }

  // 4. Cookie (for browser sessions)
  if (!providedPassword && req.cookies?.infoboard_auth) {
    providedPassword = req.cookies.infoboard_auth;
  }

  // Validate password
  if (providedPassword === CONFIG.PASSWORD) {
    next();
    return;
  }

  // Auth failed
  res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Password required. Use Authorization: Bearer <password> header or X-Password header.',
  });
}

/**
 * Login endpoint handler - validates password and sets cookie
 */
export function loginHandler(req: Request, res: Response): void {
  const { password } = req.body;
  
  if (!CONFIG.PASSWORD) {
    res.json({ success: true, message: 'No password configured' });
    return;
  }

  if (password === CONFIG.PASSWORD) {
    // Set HTTP-only cookie for 30 days
    res.cookie('infoboard_auth', password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
}

/**
 * Logout endpoint handler - clears auth cookie
 */
export function logoutHandler(_req: Request, res: Response): void {
  res.clearCookie('infoboard_auth');
  res.json({ success: true });
}

/**
 * Check if authentication is required
 */
export function authStatusHandler(_req: Request, res: Response): void {
  res.json({ 
    authRequired: !!CONFIG.PASSWORD,
  });
}
