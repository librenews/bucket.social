/**
 * Authentication middleware for AT Protocol credentials
 * Handles Basic Auth and extracts user credentials for each request
 */

import { Request, Response, NextFunction } from 'express';
import type { AtpCredentials, AuthenticatedRequest } from '../types/index.js';
import { whitelist } from '../services/whitelist.js';

/**
 * Middleware to extract and validate AT Protocol credentials from Basic Auth
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header. Use Basic Auth with AT Protocol handle and app password.',
      statusCode: 401,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  try {
    // Decode Basic Auth credentials
    const base64Credentials = authHeader.slice('Basic '.length);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [identifier, password] = credentials.split(':');
    
    console.log('Auth debug - identifier:', identifier, 'password length:', password?.length);
    
    if (!identifier || !password) {
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid Basic Auth format. Expected handle:password.',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Validate AT Protocol handle format (basic validation)
    if (!isValidAtpHandle(identifier)) {
      console.log('Auth debug - invalid handle format:', identifier);
      res.status(400).json({
        error: 'INVALID_HANDLE',
        message: 'Invalid AT Protocol handle format.',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    console.log('Auth debug - handle validation passed:', identifier);
    
    // Check whitelist if enabled
    if (!whitelist.isUserWhitelisted(identifier.trim())) {
      console.log('Auth debug - user not whitelisted:', identifier);
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'Your handle is not authorized to use this service. Please contact the administrator to request access.',
        statusCode: 403,
        timestamp: new Date().toISOString(),
        help: 'If you believe this is an error, please contact support with your handle.'
      });
      return;
    }
    
    console.log('Auth debug - user whitelisted:', identifier);
    
    // Attach credentials to request
    req.atpCredentials = {
      identifier: identifier.trim(),
      password: password.trim()
    };
    
    next();
  } catch (error) {
    console.error('Auth debug - error parsing header:', error);
    res.status(400).json({
      error: 'INVALID_AUTH_HEADER',
      message: 'Failed to parse Authorization header.',
      statusCode: 400,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Basic validation for AT Protocol handles
 */
function isValidAtpHandle(identifier: string): boolean {
  // Handle can be a domain (handle.domain.tld) or a DID (did:plc:xxx)
  const handleRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const didRegex = /^did:[a-z]+:[a-zA-Z0-9.-_]+$/;
  
  return handleRegex.test(identifier) || didRegex.test(identifier);
}

/**
 * Optional middleware to rate limit requests per user
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.atpCredentials) {
      next();
      return;
    }
    
    const identifier = req.atpCredentials.identifier;
    const now = Date.now();
    const userLimit = rateLimitMap.get(identifier);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit window
      rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }
    
    if (userLimit.count >= maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.`,
        statusCode: 429,
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
      return;
    }
    
    userLimit.count++;
    next();
  };
}

/**
 * Middleware to validate blob keys
 */
export function validateKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.params.key || req.body?.key;
  
  if (!key) {
    res.status(400).json({
      error: 'MISSING_KEY',
      message: 'Blob key is required.',
      statusCode: 400,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  if (typeof key !== 'string') {
    res.status(400).json({
      error: 'INVALID_KEY_TYPE',
      message: 'Blob key must be a string.',
      statusCode: 400,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  if (key.length > 255) {
    res.status(400).json({
      error: 'KEY_TOO_LONG',
      message: 'Blob key must be 255 characters or less.',
      statusCode: 400,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(key)) {
    res.status(400).json({
      error: 'INVALID_KEY_CHARACTERS',
      message: 'Blob key contains invalid characters.',
      statusCode: 400,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
}
