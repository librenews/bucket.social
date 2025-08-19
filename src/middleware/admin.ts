/**
 * Admin authorization middleware
 * Checks if the authenticated user is an admin
 */

import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Middleware to check if the authenticated user is an admin
 * Requires authMiddleware to be called first
 */
export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated
    if (!req.atpCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Get admin handle from environment
    const adminHandle = process.env.ADMIN_HANDLE;
    
    if (!adminHandle) {
      console.error('ADMIN_HANDLE not configured in environment');
      res.status(500).json({
        error: 'ADMIN_NOT_CONFIGURED',
        message: 'Admin access not properly configured',
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if the authenticated user is the admin
    const userHandle = req.atpCredentials.identifier.toLowerCase();
    const configuredAdmin = adminHandle.toLowerCase();

    if (userHandle !== configuredAdmin) {
      console.log(`Admin access denied for: ${userHandle}, admin is: ${configuredAdmin}`);
      res.status(403).json({
        error: 'ADMIN_ACCESS_DENIED',
        message: 'Admin privileges required for this operation',
        statusCode: 403,
        timestamp: new Date().toISOString(),
        help: 'Only the configured admin can perform this action'
      });
      return;
    }

    console.log(`Admin access granted for: ${userHandle}`);
    next();
  } catch (error) {
    console.error('Error in admin middleware:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to verify admin privileges',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
};
