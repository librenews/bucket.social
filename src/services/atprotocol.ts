/**
 * AT Protocol service for managing blobs and lexicon records
 * Handles authentication, blob storage, and CAN mapping records
 */

import { AtpAgent, BlobRef } from '@atproto/api';
import type { 
  AtpCredentials, 
  BlobInfo, 
  CANMappingRecord
} from '../types/index.js';
import { 
  CAN_LEXICON_NAMESPACE,
  CANRecordType 
} from '../types/index.js';

export class AtProtocolService {
  private agents: Map<string, AtpAgent> = new Map();

  /**
   * Create authenticated AT Protocol agent for a user
   */
  async createAgent(credentials: AtpCredentials, serviceUrl: string = 'https://bsky.social'): Promise<AtpAgent> {
    console.log('AT Protocol debug - attempting login for:', credentials.identifier, 'service:', serviceUrl);
    
    const agent = new AtpAgent({ service: serviceUrl });
    
    try {
      const loginResult = await agent.login({
        identifier: credentials.identifier,
        password: credentials.password
      });
      
      console.log('AT Protocol debug - login successful for:', credentials.identifier, 'DID:', loginResult.data.did);
      
      // Cache the agent for this session
      this.agents.set(credentials.identifier, agent);
      return agent;
    } catch (error) {
      console.error('AT Protocol debug - login failed for:', credentials.identifier, 'error:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create an authenticated agent for a user
   */
  async getAgent(credentials: AtpCredentials, serviceUrl?: string): Promise<AtpAgent> {
    const cached = this.agents.get(credentials.identifier);
    if (cached && cached.session) {
      return cached;
    }
    
    // Determine service URL from handle if not provided
    if (!serviceUrl && credentials.identifier.includes('.')) {
      const parts = credentials.identifier.split('.');
      if (parts.length >= 2) {
        // Extract domain from handle (e.g., user.bsky.social -> https://bsky.social)
        const domain = parts.slice(-2).join('.');
        serviceUrl = `https://${domain}`;
        console.log('AT Protocol debug - inferred service URL:', serviceUrl, 'from handle:', credentials.identifier);
      }
    }
    
    return this.createAgent(credentials, serviceUrl);
  }

  /**
   * Upload a blob to AT Protocol PDS
   */
  async uploadBlob(
    credentials: AtpCredentials,
    data: Buffer,
    mimeType: string = 'application/octet-stream'
  ): Promise<BlobRef> {
    const agent = await this.getAgent(credentials);
    
    try {
      const response = await agent.uploadBlob(data, { encoding: mimeType });
      return response.data.blob;
    } catch (error) {
      throw new Error(`Failed to upload blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a blob from AT Protocol PDS
   */
  async downloadBlob(
    credentials: AtpCredentials,
    cid: string
  ): Promise<Buffer> {
    const agent = await this.getAgent(credentials);
    
    try {
      // For AT Protocol blob downloads, we need to use the proper blob API
      // This is a simplified approach - in production you'd use the proper blob endpoint
      const response = await agent.api.com.atproto.sync.getBlob({
        did: agent.session?.did!,
        cid
      });
      
      if (response.data instanceof ArrayBuffer) {
        return Buffer.from(response.data);
      } else if (Buffer.isBuffer(response.data)) {
        return response.data;
      } else if (typeof response.data === 'string') {
        return Buffer.from(response.data, 'base64');
      } else {
        throw new Error('Unexpected blob data format');
      }
    } catch (error) {
      throw new Error(`Failed to download blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update a CAN mapping record in the user's repo
   */
  async putMappingRecord(
    credentials: AtpCredentials,
    record: CANMappingRecord
  ): Promise<string> {
    const agent = await this.getAgent(credentials);
    
    try {
      const rkey = this.sanitizeKey(record.key);
      const collection = `${CAN_LEXICON_NAMESPACE}.${CANRecordType.MAPPING}`;
      
      const response = await agent.api.com.atproto.repo.putRecord({
        repo: agent.session?.did!,
        collection,
        rkey,
        record: {
          $type: collection,
          ...record
        }
      });
      
      return response.data.uri;
    } catch (error) {
      throw new Error(`Failed to create mapping record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a CAN mapping record from the user's repo
   */
  async getMappingRecord(
    credentials: AtpCredentials,
    key: string
  ): Promise<CANMappingRecord | null> {
    const agent = await this.getAgent(credentials);
    
    try {
      const rkey = this.sanitizeKey(key);
      const collection = `${CAN_LEXICON_NAMESPACE}.${CANRecordType.MAPPING}`;
      
      const response = await agent.api.com.atproto.repo.getRecord({
        repo: agent.session?.did!,
        collection,
        rkey
      });
      
      return response.data.value as unknown as CANMappingRecord;
    } catch (error) {
      console.log('getMappingRecord debug - error for key:', key, 'error:', error);
      
      // Handle various "not found" error messages
      if (error instanceof Error && (
        error.message.includes('RecordNotFound') ||
        error.message.includes('Could not locate record') ||
        error.message.includes('Record not found')
      )) {
        console.log('getMappingRecord debug - record not found, returning null');
        return null;
      }
      
      throw new Error(`Failed to get mapping record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }





  /**
   * Delete a CAN mapping record from the user's repo
   */
  async deleteMappingRecord(
    credentials: AtpCredentials,
    key: string
  ): Promise<void> {
    const agent = await this.getAgent(credentials);
    
    try {
      const rkey = this.sanitizeKey(key);
      const collection = `${CAN_LEXICON_NAMESPACE}.${CANRecordType.MAPPING}`;
      
      await agent.api.com.atproto.repo.deleteRecord({
        repo: agent.session?.did!,
        collection,
        rkey
      });
    } catch (error) {
      throw new Error(`Failed to delete mapping record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all CAN mapping records for a user
   */
  async listMappingRecords(
    credentials: AtpCredentials,
    limit: number = 100,
    cursor?: string
  ): Promise<{ records: CANMappingRecord[]; cursor?: string }> {
    const agent = await this.getAgent(credentials);
    
    try {
      const collection = `${CAN_LEXICON_NAMESPACE}.${CANRecordType.MAPPING}`;
      
      const response = await agent.api.com.atproto.repo.listRecords({
        repo: agent.session?.did!,
        collection,
        limit,
        cursor
      });
      
      const records = response.data.records.map(r => r.value as unknown as CANMappingRecord);
      
      return {
        records,
        cursor: response.data.cursor
      };
    } catch (error) {
      throw new Error(`Failed to list mapping records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sanitize a key for use as an AT Protocol record key
   */
  private sanitizeKey(key: string): string {
    // Convert to lowercase, replace invalid characters with hyphens
    return key
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 64); // Limit length
  }

  /**
   * Create BlobInfo from BlobRef and additional metadata
   */
  createBlobInfo(blobRef: BlobRef, mimeType: string): BlobInfo {
    return {
      cid: blobRef.ref.toString(),
      mimeType,
      size: blobRef.size,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Clean up cached agents (call on server shutdown)
   */
  cleanup(): void {
    this.agents.clear();
  }
}
