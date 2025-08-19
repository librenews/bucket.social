/**
 * Main application entry point for the CAN (Content Addressable Network) service
 * AT Protocol blob management system with RESTful API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import routes and services
import blobsRouter from './routes/blobs.js';
import domainsRouter from './routes/domains.js';
import whitelistRouter from './routes/whitelist.js';
import { domainDetectionMiddleware } from './middleware/domain.js';
import { domainRegistry } from './services/domain-registry.js';
import { blobCache } from './services/blob-cache.js';

// Load environment variables
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow blob downloads
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files from public directory
app.use(express.static(join(__dirname, '../public')));

// Domain detection middleware (must come before routes)
app.use(domainDetectionMiddleware);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connections
    const domainRedisHealthy = await domainRegistry.healthCheck();
    const blobCacheHealthy = await blobCache.healthCheck();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'bucket.social CAN service',
      redis: {
        domainRegistry: {
          status: domainRedisHealthy ? 'connected' : 'disconnected',
          healthy: domainRedisHealthy
        },
        blobCache: {
          status: blobCacheHealthy ? 'connected' : 'disconnected',
          healthy: blobCacheHealthy
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'bucket.social CAN service',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API documentation endpoint - serve HTML page for browsers, JSON for API clients
app.get('/', (req, res) => {
  // Always serve the HTML documentation page for the root route
  res.sendFile(join(__dirname, '../public/index.html'));
});

// JSON API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'bucket.social CAN Service',
    description: 'AT Protocol blob management system with Content Addressable Network functionality',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      'POST /blobs/:key': 'Upload a blob with the given key',
      'GET /blobs/:key': 'Retrieve a blob by key (add ?version=id for specific version)',
      'GET /blobs/:key/versions': 'List all versions of a blob',
      'DELETE /blobs/:key': 'Delete a blob (add ?version=id to delete specific version)',
      'GET /blobs': 'List all blobs for authenticated user',
      'POST /domains': 'Register a new domain mapping',
      'GET /domains': 'List all domains for authenticated user',
      'GET /domains/:domain': 'Get specific domain mapping',
      'PUT /domains/:domain': 'Update domain mapping settings',
      'DELETE /domains/:domain': 'Delete domain mapping',
      'GET /whitelist/status': 'Get whitelist status (no auth required)',
      'GET /whitelist/users': 'List all whitelisted users (admin only)',
      'POST /whitelist/users': 'Add user to whitelist (admin only)',
      'DELETE /whitelist/users/:handle': 'Remove user from whitelist (admin only)',
      'POST /whitelist/enable': 'Enable whitelist (admin only)',
      'POST /whitelist/disable': 'Disable whitelist (admin only)',
      'POST /whitelist/reload': 'Reload whitelist from file (admin only)'
    },
    authentication: 'Basic Auth using AT Protocol handle and app password',
    documentation: 'https://github.com/librenews/bucket.social'
  });
});

// Mount blob routes
app.use('/blobs', blobsRouter);

// Mount domain routes
app.use('/domains', domainsRouter);

// Mount whitelist routes
app.use('/whitelist', whitelistRouter);

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    statusCode: 500,
    timestamp: new Date().toISOString()
  });
});

// Initialize Redis and start server
async function startServer() {
  try {
    // Initialize Redis connections
    console.log('🔌 Initializing Redis connections...');
    await domainRegistry.connect();
    await blobCache.connect();
    console.log('✅ Redis services connected successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 CAN Service started on port ${PORT}`);
      console.log(`📝 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API docs: http://localhost:${PORT}/`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await domainRegistry.disconnect();
  await blobCache.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await domainRegistry.disconnect();
  await blobCache.disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;
