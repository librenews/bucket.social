/**
 * Custom AT Protocol lexicon definitions for CAN service
 * Defines the schema for blob mapping records
 */

export const CANLexicon = {
  lexicon: 1,
  id: 'social.bucket.can',
  defs: {
    mapping: {
      type: 'record',
      description: 'Maps user-friendly keys to AT Protocol blob CIDs with optional versioning',
      key: 'any',
      record: {
        type: 'object',
        required: ['key', 'current', 'createdAt', 'updatedAt'],
        properties: {
          key: {
            type: 'string',
            maxLength: 255,
            description: 'User-friendly key for the blob'
          },
          current: {
            type: 'ref',
            ref: '#blobInfo',
            description: 'Current version of the blob'
          },
          versions: {
            type: 'object',
            description: 'Map of version IDs to blob versions',
            additionalProperties: {
              type: 'ref',
              ref: '#blobVersion'
            }
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'ISO datetime when the mapping was created'
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'ISO datetime when the mapping was last updated'
          },
          versioningEnabled: {
            type: 'boolean',
            description: 'Whether versioning is enabled for this blob'
          }
        }
      }
    },
    
    blobInfo: {
      type: 'object',
      description: 'Information about a stored blob',
      required: ['cid', 'mimeType', 'size', 'uploadedAt'],
      properties: {
        cid: {
          type: 'string',
          description: 'Content identifier (CID) of the blob in AT Protocol'
        },
        mimeType: {
          type: 'string',
          description: 'MIME type of the blob content'
        },
        size: {
          type: 'integer',
          minimum: 0,
          description: 'Size of the blob in bytes'
        },
        uploadedAt: {
          type: 'string',
          format: 'datetime',
          description: 'ISO datetime when the blob was uploaded'
        }
      }
    },
    
    blobVersion: {
      type: 'object',
      description: 'A specific version of a blob',
      required: ['cid', 'mimeType', 'size', 'uploadedAt', 'version'],
      properties: {
        cid: {
          type: 'string',
          description: 'Content identifier (CID) of the blob in AT Protocol'
        },
        mimeType: {
          type: 'string',
          description: 'MIME type of the blob content'
        },
        size: {
          type: 'integer',
          minimum: 0,
          description: 'Size of the blob in bytes'
        },
        uploadedAt: {
          type: 'string',
          format: 'datetime',
          description: 'ISO datetime when the blob was uploaded'
        },
        version: {
          type: 'string',
          description: 'Version identifier (typically ISO datetime)'
        },
        comment: {
          type: 'string',
          maxLength: 500,
          description: 'Optional comment describing this version'
        }
      }
    },
    
    domainMapping: {
      type: 'record',
      description: 'Maps custom domains to user handles for CDN integration',
      key: 'any',
      record: {
        type: 'object',
        required: ['domain', 'userHandle', 'createdAt'],
        properties: {
          domain: {
            type: 'string',
            maxLength: 253,
            description: 'Custom domain name (e.g., mybucket.example.com)'
          },
          userHandle: {
            type: 'string',
            description: 'AT Protocol handle of the domain owner'
          },
          cdnEnabled: {
            type: 'boolean',
            description: 'Whether CDN caching is enabled for this domain'
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'ISO datetime when the domain mapping was created'
          },
          verificationToken: {
            type: 'string',
            description: 'Token used to verify domain ownership'
          },
          verified: {
            type: 'boolean',
            description: 'Whether the domain ownership has been verified'
          }
        }
      }
    }
  }
} as const;

/**
 * Validation utilities for lexicon records
 */
export class LexiconValidator {
  /**
   * Validate a CAN mapping record
   */
  static validateMappingRecord(record: any): boolean {
    if (!record || typeof record !== 'object') return false;
    
    // Check required fields
    if (!record.key || typeof record.key !== 'string') return false;
    if (!record.current || typeof record.current !== 'object') return false;
    if (!record.createdAt || typeof record.createdAt !== 'string') return false;
    if (!record.updatedAt || typeof record.updatedAt !== 'string') return false;
    
    // Validate current blob info
    if (!this.validateBlobInfo(record.current)) return false;
    
    // Validate versions if present
    if (record.versions) {
      if (typeof record.versions !== 'object') return false;
      for (const [versionId, version] of Object.entries(record.versions)) {
        if (!this.validateBlobVersion(version as any)) return false;
      }
    }
    
    return true;
  }
  
  /**
   * Validate blob info object
   */
  static validateBlobInfo(blobInfo: any): boolean {
    if (!blobInfo || typeof blobInfo !== 'object') return false;
    
    return (
      typeof blobInfo.cid === 'string' &&
      typeof blobInfo.mimeType === 'string' &&
      typeof blobInfo.size === 'number' &&
      blobInfo.size >= 0 &&
      typeof blobInfo.uploadedAt === 'string'
    );
  }
  
  /**
   * Validate blob version object
   */
  static validateBlobVersion(version: any): boolean {
    if (!this.validateBlobInfo(version)) return false;
    
    return (
      typeof version.version === 'string' &&
      (version.comment === undefined || typeof version.comment === 'string')
    );
  }
  
  /**
   * Validate domain mapping record
   */
  static validateDomainMapping(record: any): boolean {
    if (!record || typeof record !== 'object') return false;
    
    return (
      typeof record.domain === 'string' &&
      record.domain.length <= 253 &&
      typeof record.userHandle === 'string' &&
      typeof record.createdAt === 'string' &&
      (record.cdnEnabled === undefined || typeof record.cdnEnabled === 'boolean') &&
      (record.verified === undefined || typeof record.verified === 'boolean') &&
      (record.verificationToken === undefined || typeof record.verificationToken === 'string')
    );
  }
}
