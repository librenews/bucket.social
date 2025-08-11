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

// Import routes
import blobsRouter from './routes/blobs.js';

// Load environment variables
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false // Allow blob downloads
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    service: 'bucket.social CAN service'
  });
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
      'GET /blobs': 'List all blobs for authenticated user'
    },
    authentication: 'Basic Auth using AT Protocol handle and app password',
    documentation: 'https://github.com/librenews/bucket.social'
  });
});

// Mount blob routes
app.use('/blobs', blobsRouter);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CAN Service started on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
