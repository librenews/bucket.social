/**
 * Type definitions for the CAN (Content Addressable Network) service
 * using AT Protocol as the backend blob store.
 */

import { BlobRef } from '@atproto/api';
import { Request } from 'express';

/**
 * AT Protocol credentials for user authentication
 */
export interface AtpCredentials {
  identifier: string; // AT Protocol handle or DID
  password: string;   // App password
}

/**
 * Blob information stored in AT Protocol
 */
export interface BlobInfo {
  cid: string;
  mimeType: string;
  size: number;
  uploadedAt: string; // ISO date string
}

/**
 * Version information for blob versioning
 */
export interface BlobVersion extends BlobInfo {
  version: string;
  comment?: string;
}

/**
 * CAN mapping record stored in AT Protocol lexicon
 * Maps user-friendly keys to blob CIDs with optional versioning
 */
export interface CANMappingRecord {
  key: string;
  current: BlobInfo;
  versions?: Record<string, BlobVersion>;
  createdAt: string;
  updatedAt: string;
  versioningEnabled?: boolean;
}

/**
 * Request body for uploading a blob
 */
export interface UploadBlobRequest {
  key: string;
  data: Buffer;
  mimeType?: string;
  comment?: string;
  enableVersioning?: boolean;
}

/**
 * Response for blob upload
 */
export interface UploadBlobResponse {
  success: boolean;
  key: string;
  cid: string;
  size: number;
  mimeType: string;
  version?: string;
}

/**
 * Response for blob retrieval
 */
export interface GetBlobResponse {
  key: string;
  data: Buffer;
  mimeType: string;
  size: number;
  version?: string;
  lastModified: string;
}

/**
 * Request parameters for retrieving a specific blob version
 */
export interface GetBlobRequest {
  key: string;
  version?: string;
}

/**
 * Response for listing blob versions
 */
export interface ListVersionsResponse {
  key: string;
  current: BlobInfo;
  versions: BlobVersion[];
}

/**
 * Domain mapping configuration stored in AT Protocol
 */
export interface DomainMapping {
  domain: string;
  userHandle: string;
  userDid: string;
  cdnEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'pending' | 'suspended';
  settings?: {
    publicAccess?: boolean;
    allowedMimeTypes?: string[];
    maxFileSize?: number;
  };
}

/**
 * API error response
 */
export interface APIError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

/**
 * Configuration for the CAN service
 */
export interface CANConfig {
  port: number;
  atProtocolService: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  maxBlobSizeBytes: number;
  supportedMimeTypes: string[];
  defaultVersioningEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Custom lexicon namespace for CAN records
 */
export const CAN_LEXICON_NAMESPACE = 'social.bucket.can';

/**
 * Record types in the CAN lexicon
 */
export enum CANRecordType {
  MAPPING = 'mapping',
  DOMAIN = 'domain'
}

/**
 * Extended Express Request with AT Protocol credentials and domain mapping
 */
export interface AuthenticatedRequest extends Request {
  atpCredentials?: AtpCredentials;
  userDid?: string;
  domainMapping?: DomainMapping;
}
