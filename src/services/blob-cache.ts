/**
 * Redis-based Blob Cache Service
 * Handles blob mapping caching and cache invalidation for fast blob lookups
 */

import { createClient, RedisClientType } from 'redis';
import type { BlobInfo, CANMappingRecord } from '../types/index.js';

// Redis key patterns
const BLOB_MAPPING_KEY = 'blob:mapping:';
const USER_BLOBS_KEY = 'user:blobs:';
const BLOB_METADATA_KEY = 'blob:metadata:';

// Cache TTL settings (in seconds)
const BLOB_MAPPING_TTL = 3600; // 1 hour
const BLOB_METADATA_TTL = 1800; // 30 minutes
const USER_BLOBS_TTL = 300; // 5 minutes

export class BlobCacheService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Blob Cache Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis blob cache client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis blob cache client disconnected');
      this.isConnected = false;
    });
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  /**
   * Get blob mapping from cache
   */
  async getBlobMapping(userHandle: string, key: string): Promise<CANMappingRecord | null> {
    try {
      await this.connect();
      
      const cacheKey = `${BLOB_MAPPING_KEY}${userHandle}:${key}`;
      const mappingData = await this.client.get(cacheKey);
      
      if (!mappingData) {
        return null;
      }

      return JSON.parse(mappingData) as CANMappingRecord;
    } catch (error) {
      console.error('Error getting blob mapping from cache:', error);
      return null;
    }
  }

  /**
   * Set blob mapping in cache
   */
  async setBlobMapping(userHandle: string, key: string, mapping: CANMappingRecord): Promise<boolean> {
    try {
      await this.connect();
      
      const cacheKey = `${BLOB_MAPPING_KEY}${userHandle}:${key}`;
      const userBlobsKey = `${USER_BLOBS_KEY}${userHandle}`;
      
      const multi = this.client.multi();
      
      // Store blob mapping
      multi.setEx(cacheKey, BLOB_MAPPING_TTL, JSON.stringify(mapping));
      
      // Add to user's blob list for cache invalidation
      multi.sAdd(userBlobsKey, key);
      multi.expire(userBlobsKey, USER_BLOBS_TTL);
      
      await multi.exec();
      
      console.log(`Blob mapping cached: ${userHandle}:${key}`);
      return true;
    } catch (error) {
      console.error('Error setting blob mapping in cache:', error);
      return false;
    }
  }

  /**
   * Get blob metadata from cache
   */
  async getBlobMetadata(userHandle: string, key: string): Promise<BlobInfo | null> {
    try {
      await this.connect();
      
      const cacheKey = `${BLOB_METADATA_KEY}${userHandle}:${key}`;
      const metadataData = await this.client.get(cacheKey);
      
      if (!metadataData) {
        return null;
      }

      return JSON.parse(metadataData) as BlobInfo;
    } catch (error) {
      console.error('Error getting blob metadata from cache:', error);
      return null;
    }
  }

  /**
   * Set blob metadata in cache
   */
  async setBlobMetadata(userHandle: string, key: string, metadata: BlobInfo): Promise<boolean> {
    try {
      await this.connect();
      
      const cacheKey = `${BLOB_METADATA_KEY}${userHandle}:${key}`;
      await this.client.setEx(cacheKey, BLOB_METADATA_TTL, JSON.stringify(metadata));
      
      console.log(`Blob metadata cached: ${userHandle}:${key}`);
      return true;
    } catch (error) {
      console.error('Error setting blob metadata in cache:', error);
      return false;
    }
  }

  /**
   * Invalidate blob mapping cache
   */
  async invalidateBlobMapping(userHandle: string, key: string): Promise<boolean> {
    try {
      await this.connect();
      
      const cacheKey = `${BLOB_MAPPING_KEY}${userHandle}:${key}`;
      const metadataKey = `${BLOB_METADATA_KEY}${userHandle}:${key}`;
      
      const multi = this.client.multi();
      
      // Remove blob mapping
      multi.del(cacheKey);
      
      // Remove blob metadata
      multi.del(metadataKey);
      
      // Remove from user's blob list
      const userBlobsKey = `${USER_BLOBS_KEY}${userHandle}`;
      multi.sRem(userBlobsKey, key);
      
      await multi.exec();
      
      console.log(`Blob mapping cache invalidated: ${userHandle}:${key}`);
      return true;
    } catch (error) {
      console.error('Error invalidating blob mapping cache:', error);
      return false;
    }
  }

  /**
   * Invalidate all blobs for a user (when user data changes)
   */
  async invalidateUserBlobs(userHandle: string): Promise<boolean> {
    try {
      await this.connect();
      
      const userBlobsKey = `${USER_BLOBS_KEY}${userHandle}`;
      const userBlobs = await this.client.sMembers(userBlobsKey);
      
      if (userBlobs.length === 0) {
        return true;
      }
      
      const multi = this.client.multi();
      
      // Remove all blob mappings for this user
      for (const key of userBlobs) {
        const mappingKey = `${BLOB_MAPPING_KEY}${userHandle}:${key}`;
        const metadataKey = `${BLOB_METADATA_KEY}${userHandle}:${key}`;
        multi.del(mappingKey);
        multi.del(metadataKey);
      }
      
      // Remove user's blob list
      multi.del(userBlobsKey);
      
      await multi.exec();
      
      console.log(`All blob caches invalidated for user: ${userHandle} (${userBlobs.length} blobs)`);
      return true;
    } catch (error) {
      console.error('Error invalidating user blobs cache:', error);
      return false;
    }
  }

  /**
   * Get cached blob list for a user
   */
  async getUserBlobKeys(userHandle: string): Promise<string[]> {
    try {
      await this.connect();
      
      const userBlobsKey = `${USER_BLOBS_KEY}${userHandle}`;
      const blobKeys = await this.client.sMembers(userBlobsKey);
      
      return blobKeys;
    } catch (error) {
      console.error('Error getting user blob keys from cache:', error);
      return [];
    }
  }

  /**
   * Update blob mapping in cache (for edits)
   */
  async updateBlobMapping(userHandle: string, key: string, mapping: CANMappingRecord): Promise<boolean> {
    try {
      await this.connect();
      
      const cacheKey = `${BLOB_MAPPING_KEY}${userHandle}:${key}`;
      const userBlobsKey = `${USER_BLOBS_KEY}${userHandle}`;
      
      const multi = this.client.multi();
      
      // Update blob mapping with new TTL
      multi.setEx(cacheKey, BLOB_MAPPING_TTL, JSON.stringify(mapping));
      
      // Ensure it's in user's blob list
      multi.sAdd(userBlobsKey, key);
      multi.expire(userBlobsKey, USER_BLOBS_TTL);
      
      await multi.exec();
      
      console.log(`Blob mapping cache updated: ${userHandle}:${key}`);
      return true;
    } catch (error) {
      console.error('Error updating blob mapping in cache:', error);
      return false;
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.connect();
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Blob cache health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all blob cache data (for testing)
   */
  async clearAll(): Promise<void> {
    try {
      await this.connect();
      
      const multi = this.client.multi();
      
      // Get all blob-related keys
      const mappingKeys = await this.client.keys(`${BLOB_MAPPING_KEY}*`);
      const metadataKeys = await this.client.keys(`${BLOB_METADATA_KEY}*`);
      const userBlobsKeys = await this.client.keys(`${USER_BLOBS_KEY}*`);
      
      // Delete all blob-related keys
      for (const key of [...mappingKeys, ...metadataKeys, ...userBlobsKeys]) {
        multi.del(key);
      }
      
      await multi.exec();
      console.log('All blob cache data cleared');
    } catch (error) {
      console.error('Error clearing blob cache data:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    mappingKeys: number;
    metadataKeys: number;
    userBlobSets: number;
  }> {
    try {
      await this.connect();
      
      const mappingKeys = await this.client.keys(`${BLOB_MAPPING_KEY}*`);
      const metadataKeys = await this.client.keys(`${BLOB_METADATA_KEY}*`);
      const userBlobsKeys = await this.client.keys(`${USER_BLOBS_KEY}*`);
      
      return {
        mappingKeys: mappingKeys.length,
        metadataKeys: metadataKeys.length,
        userBlobSets: userBlobsKeys.length
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        mappingKeys: 0,
        metadataKeys: 0,
        userBlobSets: 0
      };
    }
  }
}

// Export singleton instance
export const blobCache = new BlobCacheService();
