/**
 * Blob management routes for the CAN service
 * Provides RESTful endpoints for blob CRUD operations
 */

import { Router, Response, Request } from 'express';
import multer from 'multer';
import { AtProtocolService } from '../services/atprotocol.js';
import { domainRegistry } from '../services/domain-registry.js';
import { authMiddleware, validateKeyMiddleware, rateLimitMiddleware } from '../middleware/auth.js';
import type { 
  AuthenticatedRequest, 
  CANMappingRecord, 
  BlobVersion,
  UploadBlobResponse,
  GetBlobResponse,
  ListVersionsResponse 
} from '../types/index.js';

// Extend AuthenticatedRequest to include multer file
interface AuthenticatedRequestWithFile extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  }
});

const router = Router();
const atpService = new AtProtocolService();

// Apply authentication and rate limiting to all routes
router.use(authMiddleware);
router.use(rateLimitMiddleware(15 * 60 * 1000, 100)); // 100 requests per 15 minutes

/**
 * Upload a new blob or update existing one
 * POST /blobs/:key
 */
router.post('/:key', validateKeyMiddleware, upload.single('file'), async (req: AuthenticatedRequestWithFile, res: Response) => {
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

    if (!req.file) {
      res.status(400).json({
        error: 'NO_FILE',
        message: 'No file provided in the request',
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const key = req.params.key;
    const { comment, enableVersioning } = req.body;
    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || 'application/octet-stream';

    // Check if record already exists for versioning
    const existingRecord = await atpService.getMappingRecord(req.atpCredentials, key);
    const shouldVersion = enableVersioning || existingRecord?.versioningEnabled || false;

    // Upload blob to AT Protocol
    const blobRef = await atpService.uploadBlob(req.atpCredentials, fileBuffer, mimeType);
    const blobInfo = atpService.createBlobInfo(blobRef, mimeType);

    let record: CANMappingRecord;

    if (existingRecord && shouldVersion) {
      // Create new version
      const versionId = new Date().toISOString();
      const newVersion: BlobVersion = {
        ...blobInfo,
        version: versionId,
        comment
      };

      record = {
        ...existingRecord,
        current: blobInfo,
        versions: {
          ...existingRecord.versions,
          [versionId]: newVersion
        },
        updatedAt: new Date().toISOString(),
        versioningEnabled: shouldVersion
      };
    } else if (existingRecord) {
      // Update without versioning
      record = {
        ...existingRecord,
        current: blobInfo,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Create new record
      record = {
        key,
        current: blobInfo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versioningEnabled: shouldVersion,
        ...(shouldVersion && { versions: {} })
      };
    }

    // Save the mapping record
    await atpService.putMappingRecord(req.atpCredentials, record);

    const response: UploadBlobResponse = {
      success: true,
      key,
      cid: blobInfo.cid,
      size: blobInfo.size,
      mimeType: blobInfo.mimeType,
      ...(shouldVersion && existingRecord && { version: new Date().toISOString() })
    };

    res.status(existingRecord ? 200 : 201).json(response);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: error instanceof Error ? error.message : 'Failed to upload blob',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Retrieve a blob by key
 * GET /blobs/:key[?version=versionId]
 */
router.get('/:key', validateKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // For public blob access via domain, we don't require authentication
    // The domain mapping will be handled by the domain detection middleware
    if (!req.atpCredentials && !req.domainMapping) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Determine which user's blobs to access and their PDS
    let targetCredentials = req.atpCredentials;
    let targetPdsUrl: string | null = null;

    if (req.domainMapping && !req.atpCredentials) {
      // Public access via domain - we need to determine the PDS for this user
      targetPdsUrl = await domainRegistry.getPdsForDomain(req.domainMapping.domain);
      if (!targetPdsUrl) {
        res.status(500).json({
          error: 'PDS_RESOLUTION_FAILED',
          message: 'Could not determine PDS for domain',
          statusCode: 500,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Create a minimal credential object for the target user
      // Note: This is a simplified approach - in production you might want to cache user sessions
      targetCredentials = {
        identifier: req.domainMapping.userHandle,
        password: '' // We'll need to handle this differently for public access
      };

      console.log(`Domain access: ${req.domainMapping.domain} -> ${req.domainMapping.userHandle} (PDS: ${targetPdsUrl})`);
    } else if (req.atpCredentials) {
      // Authenticated access - use the user's own PDS
      targetPdsUrl = domainRegistry.extractPdsFromHandle(req.atpCredentials.identifier);
    }

    if (!targetCredentials) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No valid credentials found',
        statusCode: 401,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const key = req.params.key;
    const version = req.query.version as string | undefined;

    // Get the mapping record from the appropriate PDS
    const record = await atpService.getMappingRecord(targetCredentials, key);
    if (!record) {
      res.status(404).json({
        error: 'BLOB_NOT_FOUND',
        message: `Blob with key '${key}' not found`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Determine which blob to retrieve
    let blobInfo = record.current;
    let selectedVersion: string | undefined;

    if (version && record.versions) {
      const versionInfo = record.versions[version];
      if (!versionInfo) {
        res.status(404).json({
          error: 'VERSION_NOT_FOUND',
          message: `Version '${version}' not found for key '${key}'`,
          statusCode: 404,
          timestamp: new Date().toISOString()
        });
        return;
      }
      blobInfo = versionInfo;
      selectedVersion = version;
    }

    // Download the blob data from the appropriate PDS
    const blobData = await atpService.downloadBlob(targetCredentials, blobInfo.cid);

    // Set appropriate headers
    res.set({
      'Content-Type': blobInfo.mimeType,
      'Content-Length': blobInfo.size.toString(),
      'Last-Modified': new Date(blobInfo.uploadedAt).toUTCString(),
      'Cache-Control': 'public, max-age=31536000', // 1 year cache for immutable content
      ...(selectedVersion && { 'X-Version': selectedVersion }),
      ...(req.domainMapping && { 'X-Domain': req.domainMapping.domain })
    });

    res.send(blobData);
  } catch (error) {
    console.error('Retrieval error:', error);
    res.status(500).json({
      error: 'RETRIEVAL_FAILED',
      message: error instanceof Error ? error.message : 'Failed to retrieve blob',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * List all versions of a blob
 * GET /blobs/:key/versions
 */
router.get('/:key/versions', validateKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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

    const key = req.params.key;

    // Get the mapping record
    const record = await atpService.getMappingRecord(req.atpCredentials, key);
    if (!record) {
      res.status(404).json({
        error: 'BLOB_NOT_FOUND',
        message: `Blob with key '${key}' not found`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const versions = record.versions ? Object.values(record.versions) : [];
    const response: ListVersionsResponse = {
      key,
      current: record.current,
      versions: versions.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    };

    res.json(response);
  } catch (error) {
    console.error('Version list error:', error);
    res.status(500).json({
      error: 'VERSION_LIST_FAILED',
      message: error instanceof Error ? error.message : 'Failed to list versions',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Delete a blob
 * DELETE /blobs/:key[?version=versionId]
 */
router.delete('/:key', validateKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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

    const key = req.params.key;
    const version = req.query.version as string | undefined;

    // Get the mapping record
    const record = await atpService.getMappingRecord(req.atpCredentials, key);
    if (!record) {
      res.status(404).json({
        error: 'BLOB_NOT_FOUND',
        message: `Blob with key '${key}' not found`,
        statusCode: 404,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (version) {
      // Delete specific version
      if (!record.versions || !record.versions[version]) {
        res.status(404).json({
          error: 'VERSION_NOT_FOUND',
          message: `Version '${version}' not found for key '${key}'`,
          statusCode: 404,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Remove the version
      delete record.versions[version];
      record.updatedAt = new Date().toISOString();

      // Update the record
      await atpService.putMappingRecord(req.atpCredentials, record);

      res.json({
        success: true,
        message: `Version '${version}' deleted for key '${key}'`
      });
    } else {
      // Delete entire blob and all versions
      await atpService.deleteMappingRecord(req.atpCredentials, key);

      res.json({
        success: true,
        message: `Blob '${key}' and all versions deleted`
      });
    }
  } catch (error) {
    console.error('Deletion error:', error);
    res.status(500).json({
      error: 'DELETION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to delete blob',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * List all blobs for the authenticated user
 * GET /blobs?limit=100&cursor=xxx
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

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    const result = await atpService.listMappingRecords(req.atpCredentials, limit, cursor);

    res.json({
      blobs: result.records.map(record => ({
        key: record.key,
        current: record.current,
        versionCount: record.versions ? Object.keys(record.versions).length : 0,
        versioningEnabled: record.versioningEnabled || false,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })),
      cursor: result.cursor,
      hasMore: !!result.cursor
    });
  } catch (error) {
    console.error('List blobs error:', error);
    res.status(500).json({
      error: 'LIST_FAILED',
      message: error instanceof Error ? error.message : 'Failed to list blobs',
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
