/**
 * Whitelist management routes
 * Provides API endpoints for managing authorized users
 */

import { Router, Request, Response } from 'express';
import { whitelist } from '../services/whitelist.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

/**
 * GET /whitelist/status
 * Get whitelist status and configuration
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = whitelist.getStatus();
    res.json({
      success: true,
      data: {
        enabled: status.enabled,
        userCount: status.users.length,
        lastUpdated: status.lastUpdated,
        filePath: whitelist.getFilePath()
      }
    });
  } catch (error) {
    console.error('Error getting whitelist status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get whitelist status',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /whitelist/users
 * Get all whitelisted users (requires admin authentication)
 */
router.get('/users', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = whitelist.getUsers();
    res.json({
      success: true,
      data: {
        users,
        count: users.length
      }
    });
  } catch (error) {
    console.error('Error getting whitelist users:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get whitelist users',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /whitelist/users
 * Add a user to the whitelist (requires admin authentication)
 */
router.post('/users', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { handle } = req.body;
    
    if (!handle || typeof handle !== 'string') {
      res.status(400).json({
        error: 'MISSING_HANDLE',
        message: 'Handle is required and must be a string',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Basic handle validation
    const handleRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const didRegex = /^did:[a-z]+:[a-zA-Z0-9.-_]+$/;
    
    if (!handleRegex.test(handle) && !didRegex.test(handle)) {
      res.status(400).json({
        error: 'INVALID_HANDLE',
        message: 'Invalid handle format',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const added = whitelist.addUser(handle);
    
    if (added) {
      res.json({
        success: true,
        message: `User ${handle} added to whitelist`,
        data: {
          handle,
          totalUsers: whitelist.getUsers().length
        }
      });
    } else {
      res.status(409).json({
        error: 'USER_EXISTS',
        message: `User ${handle} is already in the whitelist`,
        statusCode: 409,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error adding user to whitelist:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to add user to whitelist',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /whitelist/users/:handle
 * Remove a user from the whitelist (requires admin authentication)
 */
router.delete('/users/:handle', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { handle } = req.params;
    
    if (!handle) {
      res.status(400).json({
        error: 'MISSING_HANDLE',
        message: 'Handle parameter is required',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const removed = whitelist.removeUser(handle);
    
    if (removed) {
      res.json({
        success: true,
        message: `User ${handle} removed from whitelist`,
        data: {
          handle,
          totalUsers: whitelist.getUsers().length
        }
      });
    } else {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: `User ${handle} is not in the whitelist`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error removing user from whitelist:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to remove user from whitelist',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /whitelist/enable
 * Enable the whitelist (requires admin authentication)
 */
router.post('/enable', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    whitelist.setEnabled(true);
    res.json({
      success: true,
      message: 'Whitelist enabled',
      data: {
        enabled: true,
        userCount: whitelist.getUsers().length
      }
    });
  } catch (error) {
    console.error('Error enabling whitelist:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to enable whitelist',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /whitelist/disable
 * Disable the whitelist (requires admin authentication)
 */
router.post('/disable', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    whitelist.setEnabled(false);
    res.json({
      success: true,
      message: 'Whitelist disabled',
      data: {
        enabled: false,
        userCount: whitelist.getUsers().length
      }
    });
  } catch (error) {
    console.error('Error disabling whitelist:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to disable whitelist',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /whitelist/reload
 * Reload whitelist from file (requires admin authentication)
 */
router.post('/reload', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    whitelist.reload();
    const status = whitelist.getStatus();
    
    res.json({
      success: true,
      message: 'Whitelist reloaded successfully',
      data: {
        enabled: status.enabled,
        userCount: status.users.length,
        lastUpdated: status.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error reloading whitelist:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to reload whitelist',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
