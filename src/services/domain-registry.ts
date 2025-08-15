/**
 * Redis-based Domain Registry Service
 * Handles domain mapping lookups and PDS resolution for domain-based blob access
 */

import { createClient, RedisClientType } from 'redis';
import type { DomainMapping } from '../types/index.js';

// Redis key patterns
const DOMAIN_MAPPING_KEY = 'domain:mapping:';
const USER_DOMAINS_KEY = 'user:domains:';
const ALL_DOMAINS_KEY = 'domains:all';

export class DomainRegistryService {
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
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis client disconnected');
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
   * Find domain mapping by domain name
   */
  async findDomainMapping(domain: string): Promise<DomainMapping | null> {
    try {
      await this.connect();
      
      const key = `${DOMAIN_MAPPING_KEY}${domain}`;
      const mappingData = await this.client.get(key);
      
      if (!mappingData) {
        return null;
      }

      return JSON.parse(mappingData) as DomainMapping;
    } catch (error) {
      console.error('Error finding domain mapping:', error);
      return null;
    }
  }

  /**
   * Get PDS URL for a domain mapping
   */
  async getPdsForDomain(domain: string): Promise<string | null> {
    const mapping = await this.findDomainMapping(domain);
    if (!mapping) {
      return null;
    }

    return this.extractPdsFromHandle(mapping.userHandle);
  }

  /**
   * Extract PDS URL from AT Protocol handle
   */
  extractPdsFromHandle(handle: string): string {
    if (handle.includes('.')) {
      const parts = handle.split('.');
      if (parts.length >= 2) {
        // Extract domain from handle (e.g., user.bsky.social -> https://bsky.social)
        const domain = parts.slice(-2).join('.');
        return `https://${domain}`;
      }
    }
    
    // Default to bsky.social
    return 'https://bsky.social';
  }

  /**
   * Register a new domain mapping
   */
  async registerDomain(mapping: DomainMapping): Promise<boolean> {
    try {
      await this.connect();
      
      const domainKey = `${DOMAIN_MAPPING_KEY}${mapping.domain}`;
      const userKey = `${USER_DOMAINS_KEY}${mapping.userHandle}`;
      
      // Use Redis transaction for atomicity
      const multi = this.client.multi();
      
      // Store domain mapping
      multi.setEx(domainKey, 86400 * 365, JSON.stringify(mapping)); // 1 year TTL
      
      // Add to user's domain list
      multi.sAdd(userKey, mapping.domain);
      multi.expire(userKey, 86400 * 365); // 1 year TTL
      
      // Add to global domain set
      multi.sAdd(ALL_DOMAINS_KEY, mapping.domain);
      
      await multi.exec();
      
      console.log(`Domain registered: ${mapping.domain} -> ${mapping.userHandle}`);
      return true;
    } catch (error) {
      console.error('Error registering domain:', error);
      return false;
    }
  }

  /**
   * Update domain mapping
   */
  async updateDomain(domain: string, updates: Partial<DomainMapping>): Promise<boolean> {
    try {
      await this.connect();
      
      const existing = await this.findDomainMapping(domain);
      if (!existing) {
        return false;
      }

      const updated: DomainMapping = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const domainKey = `${DOMAIN_MAPPING_KEY}${domain}`;
      await this.client.setEx(domainKey, 86400 * 365, JSON.stringify(updated));
      
      return true;
    } catch (error) {
      console.error('Error updating domain:', error);
      return false;
    }
  }

  /**
   * Delete domain mapping
   */
  async deleteDomain(domain: string, userHandle: string): Promise<boolean> {
    try {
      await this.connect();
      
      const domainKey = `${DOMAIN_MAPPING_KEY}${domain}`;
      const userKey = `${USER_DOMAINS_KEY}${userHandle}`;
      
      const multi = this.client.multi();
      
      // Remove domain mapping
      multi.del(domainKey);
      
      // Remove from user's domain list
      multi.sRem(userKey, domain);
      
      // Remove from global domain set
      multi.sRem(ALL_DOMAINS_KEY, domain);
      
      await multi.exec();
      
      console.log(`Domain deleted: ${domain}`);
      return true;
    } catch (error) {
      console.error('Error deleting domain:', error);
      return false;
    }
  }

  /**
   * Get all domains for a user
   */
  async getUserDomains(userHandle: string): Promise<string[]> {
    try {
      await this.connect();
      
      const userKey = `${USER_DOMAINS_KEY}${userHandle}`;
      const domains = await this.client.sMembers(userKey);
      
      return domains;
    } catch (error) {
      console.error('Error getting user domains:', error);
      return [];
    }
  }

  /**
   * Get all registered domains (for debugging/admin)
   */
  async getAllDomains(): Promise<string[]> {
    try {
      await this.connect();
      
      const domains = await this.client.sMembers(ALL_DOMAINS_KEY);
      return domains;
    } catch (error) {
      console.error('Error getting all domains:', error);
      return [];
    }
  }

  /**
   * Check if domain is registered
   */
  async isDomainRegistered(domain: string): Promise<boolean> {
    try {
      await this.connect();
      
      const key = `${DOMAIN_MAPPING_KEY}${domain}`;
      const exists = await this.client.exists(key);
      
      return exists === 1;
    } catch (error) {
      console.error('Error checking domain registration:', error);
      return false;
    }
  }

  /**
   * Get domain mapping with full details
   */
  async getDomainDetails(domain: string): Promise<DomainMapping | null> {
    return await this.findDomainMapping(domain);
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
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all domain data (for testing)
   */
  async clearAll(): Promise<void> {
    try {
      await this.connect();
      
      const allDomains = await this.getAllDomains();
      const multi = this.client.multi();
      
      // Delete all domain mappings
      for (const domain of allDomains) {
        const domainKey = `${DOMAIN_MAPPING_KEY}${domain}`;
        multi.del(domainKey);
      }
      
      // Delete global domain set
      multi.del(ALL_DOMAINS_KEY);
      
      // Delete all user domain sets
      const userKeys = await this.client.keys(`${USER_DOMAINS_KEY}*`);
      for (const key of userKeys) {
        multi.del(key);
      }
      
      await multi.exec();
      console.log('All domain data cleared');
    } catch (error) {
      console.error('Error clearing domain data:', error);
    }
  }
}

// Export singleton instance
export const domainRegistry = new DomainRegistryService();
