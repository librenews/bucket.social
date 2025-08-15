/**
 * Domain management routes
 * Handles domain registration, listing, and management
 */

import { Router, Response } from 'express';
import { authMiddleware, rateLimitMiddleware } from '../middleware/auth.js';
import { domainRegistry } from '../services/domain-registry.js';
import { AtProtocolService } from '../services/atprotocol.js';
import type { AuthenticatedRequest, DomainMapping } from '../types/index.js';

const router = Router();
const atpService = new AtProtocolService();

// Apply authentication and rate limiting
router.use(authMiddleware);
router.use(rateLimitMiddleware(15 * 60 * 1000, 50)); // 50 requests per 15 minutes

/**
 * Register a new domain mapping
 * POST /domains
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.atpCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      res.status(400).json({
        error: 'INVALID_DOMAIN',
        message: 'Domain is required and must be a string',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      res.status(400).json({
        error: 'INVALID_DOMAIN_FORMAT',
        message: 'Invalid domain format',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if domain is already registered
    const existingMapping = await domainRegistry.findDomainMapping(domain);
    if (existingMapping) {
      res.status(409).json({
        error: 'DOMAIN_ALREADY_REGISTERED',
        message: `Domain '${domain}' is already registered`,
        statusCode: 409,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Get user info from AT Protocol
    const agent = await atpService.getAgent(req.atpCredentials);
    if (!agent.session?.did) {
      res.status(401).json({
        error: 'INVALID_SESSION',
        message: 'Invalid AT Protocol session',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Create domain mapping
    const mapping: DomainMapping = {
      domain,
      userHandle: req.atpCredentials.identifier,
      userDid: agent.session.did,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      settings: {
        publicAccess: true,
        allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
        maxFileSize: 50 * 1024 * 1024 // 50MB
      }
    };

    // Register in Redis
    const success = await domainRegistry.registerDomain(mapping);
    if (!success) {
      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: 'Failed to register domain',
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log(`Domain registered: ${domain} -> ${req.atpCredentials.identifier}`);

    res.status(201).json({
      success: true,
      domain: mapping.domain,
      userHandle: mapping.userHandle,
      userDid: mapping.userDid,
      status: mapping.status,
      createdAt: mapping.createdAt
    });
  } catch (error) {
    console.error('Domain registration error:', error);
    res.status(500).json({
      error: 'REGISTRATION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to register domain',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * List all domain mappings for the authenticated user
 * GET /domains
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.atpCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const domains = await domainRegistry.getUserDomains(req.atpCredentials.identifier);
    
    // Get full details for each domain
    const domainDetails = await Promise.all(
      domains.map(async (domain) => {
        const details = await domainRegistry.getDomainDetails(domain);
        return details;
      })
    );

    res.json({
      success: true,
      domains: domainDetails.filter(Boolean),
      count: domainDetails.length
    });
  } catch (error) {
    console.error('Domain list error:', error);
    res.status(500).json({
      error: 'LIST_ERROR',
      message: error instanceof Error ? error.message : 'Failed to list domains',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get a specific domain mapping
 * GET /domains/:domain
 */
router.get('/:domain', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.atpCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { domain } = req.params;
    const mapping = await domainRegistry.findDomainMapping(domain);

    if (!mapping) {
      res.status(404).json({
        error: 'DOMAIN_NOT_FOUND',
        message: `Domain '${domain}' not found`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if user owns this domain
    if (mapping.userHandle !== req.atpCredentials.identifier) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to access this domain',
        statusCode: 403,
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      domain: mapping
    });
  } catch (error) {
    console.error('Domain get error:', error);
    res.status(500).json({
      error: 'GET_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get domain',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Update domain mapping settings
 * PUT /domains/:domain
 */
router.put('/:domain', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.atpCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { domain } = req.params;
    const { status, settings } = req.body;

    const mapping = await domainRegistry.findDomainMapping(domain);
    if (!mapping) {
      res.status(404).json({
        error: 'DOMAIN_NOT_FOUND',
        message: `Domain '${domain}' not found`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if user owns this domain
    if (mapping.userHandle !== req.atpCredentials.identifier) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to modify this domain',
        statusCode: 403,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Prepare updates
    const updates: Partial<DomainMapping> = {};
    if (status && ['active', 'suspended'].includes(status)) {
      updates.status = status;
    }
    if (settings) {
      updates.settings = { ...mapping.settings, ...settings };
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        error: 'NO_UPDATES',
        message: 'No valid updates provided',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Update domain
    const success = await domainRegistry.updateDomain(domain, updates);
    if (!success) {
      res.status(500).json({
        error: 'UPDATE_FAILED',
        message: 'Failed to update domain',
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Get updated mapping
    const updatedMapping = await domainRegistry.findDomainMapping(domain);

    res.json({
      success: true,
      domain: updatedMapping
    });
  } catch (error) {
    console.error('Domain update error:', error);
    res.status(500).json({
      error: 'UPDATE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to update domain',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Delete (suspend) a domain mapping
 * DELETE /domains/:domain
 */
router.delete('/:domain', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.atpCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { domain } = req.params;
    const mapping = await domainRegistry.findDomainMapping(domain);

    if (!mapping) {
      res.status(404).json({
        error: 'DOMAIN_NOT_FOUND',
        message: `Domain '${domain}' not found`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if user owns this domain
    if (mapping.userHandle !== req.atpCredentials.identifier) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to delete this domain',
        statusCode: 403,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Delete domain from Redis
    const success = await domainRegistry.deleteDomain(domain, req.atpCredentials.identifier);
    if (!success) {
      res.status(500).json({
        error: 'DELETE_FAILED',
        message: 'Failed to delete domain',
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log(`Domain deleted: ${domain} by ${req.atpCredentials.identifier}`);

    res.json({
      success: true,
      message: `Domain '${domain}' has been deleted`
    });
  } catch (error) {
    console.error('Domain delete error:', error);
    res.status(500).json({
      error: 'DELETE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to delete domain',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
