/**
 * Domain detection and routing middleware
 * Handles CNAME-based domain mappings to user accounts
 */

import { Request, Response, NextFunction } from 'express';
import { AtProtocolService } from '../services/atprotocol.js';
import { domainRegistry } from '../services/domain-registry.js';
import type { DomainMapping, AuthenticatedRequest } from '../types/index.js';

const atpService = new AtProtocolService();

/**
 * Middleware to detect domain and lookup user mapping
 */
export async function domainDetectionMiddleware(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const host = req.get('host') || req.get('x-forwarded-host');
    
    if (!host) {
      // No host header, continue with normal flow
      next();
      return;
    }

    // Extract domain from host (remove port if present)
    const domain = host.split(':')[0];
    
    // Skip localhost and internal domains
    if (domain === 'localhost' || domain === '127.0.0.1' || domain.includes('bucket.social')) {
      next();
      return;
    }

    console.log('Domain detection - checking domain:', domain);
    
    // Look up domain mapping using Redis
    const mapping = await domainRegistry.findDomainMapping(domain);
    
    if (mapping) {
      console.log('Domain mapping found:', mapping.domain, '->', mapping.userHandle);
      
      // Attach domain info to request
      req.domainMapping = mapping;
      req.userDid = mapping.userDid;
      
      // For public blob access, we don't need full authentication
      if (req.method === 'GET' && req.path.startsWith('/blobs/')) {
        // Allow public access to blobs
        next();
        return;
      }
      
      // For other operations, require authentication
      if (!req.atpCredentials) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required for domain operations',
          statusCode: 401,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Verify the authenticated user owns this domain
      if (req.atpCredentials.identifier !== mapping.userHandle) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to access this domain',
          statusCode: 403,
          timestamp: new Date().toISOString()
        });
        return;
      }
    } else {
      // Domain not registered - reject the request
      console.log('Domain not registered:', domain);
      res.status(404).json({
        error: 'DOMAIN_NOT_REGISTERED',
        message: `Domain '${domain}' is not registered with this service`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
        help: 'To register your domain, visit https://bucket.social/playground'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Domain detection error:', error);
    res.status(500).json({
      error: 'DOMAIN_DETECTION_ERROR',
      message: 'Error processing domain request',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Find domain mapping by searching through all registered domains
 * This is a simplified approach - in production you might want a more efficient lookup
 */
async function findDomainMapping(domain: string): Promise<DomainMapping | null> {
  try {
    // Use Redis-based domain registry
    return await domainRegistry.findDomainMapping(domain);
  } catch (error) {
    console.error('Error finding domain mapping:', error);
    return null;
  }
}

/**
 * Register a new domain mapping
 */
export async function registerDomainMapping(
  credentials: { identifier: string; password: string },
  domain: string
): Promise<DomainMapping> {
  const agent = await atpService.getAgent(credentials);
  
  if (!agent.session?.did) {
    throw new Error('No authenticated session');
  }
  
  const mapping: DomainMapping = {
    domain,
    userHandle: credentials.identifier,
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
    throw new Error('Failed to register domain in Redis');
  }

  return mapping;
}

/**
 * Get all domain mappings for a user
 */
export async function getUserDomainMappings(
  credentials: { identifier: string; password: string }
): Promise<string[]> {
  return await domainRegistry.getUserDomains(credentials.identifier);
}
