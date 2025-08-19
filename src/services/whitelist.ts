/**
 * Whitelist Service for Access Control
 * Manages authorized users to prevent abusive use of the service
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Whitelist file path
const WHITELIST_FILE = join(process.cwd(), 'data', 'whitelist.json');

// Whitelist data structure
interface WhitelistData {
  enabled: boolean;
  users: string[];
  lastUpdated: string;
}

// Default whitelist data
const DEFAULT_WHITELIST: WhitelistData = {
  enabled: false,
  users: [],
  lastUpdated: new Date().toISOString()
};

export class WhitelistService {
  private whitelist: WhitelistData;

  constructor() {
    this.whitelist = this.loadWhitelist();
  }

  /**
   * Load whitelist from file or create default
   */
  private loadWhitelist(): WhitelistData {
    try {
      if (existsSync(WHITELIST_FILE)) {
        const data = readFileSync(WHITELIST_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Validate structure
        if (parsed && typeof parsed.enabled === 'boolean' && Array.isArray(parsed.users)) {
          return {
            enabled: parsed.enabled,
            users: parsed.users.map((user: any) => String(user).toLowerCase()),
            lastUpdated: parsed.lastUpdated || new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.error('Error loading whitelist:', error);
    }

    // Create default whitelist file
    this.saveWhitelist(DEFAULT_WHITELIST);
    return DEFAULT_WHITELIST;
  }

  /**
   * Save whitelist to file
   */
  private saveWhitelist(data: WhitelistData): void {
    try {
      // Ensure data directory exists
      const dataDir = join(process.cwd(), 'data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      writeFileSync(WHITELIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
      console.log('Whitelist saved successfully');
    } catch (error) {
      console.error('Error saving whitelist:', error);
    }
  }

  /**
   * Check if a user is whitelisted
   */
  isUserWhitelisted(handle: string): boolean {
    if (!this.whitelist.enabled) {
      return true; // If whitelist is disabled, allow all users
    }

    const normalizedHandle = handle.toLowerCase();
    return this.whitelist.users.includes(normalizedHandle);
  }

  /**
   * Add a user to the whitelist
   */
  addUser(handle: string): boolean {
    const normalizedHandle = handle.toLowerCase();
    
    if (this.whitelist.users.includes(normalizedHandle)) {
      return false; // User already exists
    }

    this.whitelist.users.push(normalizedHandle);
    this.whitelist.lastUpdated = new Date().toISOString();
    this.saveWhitelist(this.whitelist);
    
    console.log(`User added to whitelist: ${handle}`);
    return true;
  }

  /**
   * Remove a user from the whitelist
   */
  removeUser(handle: string): boolean {
    const normalizedHandle = handle.toLowerCase();
    const initialLength = this.whitelist.users.length;
    
    this.whitelist.users = this.whitelist.users.filter(user => user !== normalizedHandle);
    
    if (this.whitelist.users.length === initialLength) {
      return false; // User wasn't in the list
    }

    this.whitelist.lastUpdated = new Date().toISOString();
    this.saveWhitelist(this.whitelist);
    
    console.log(`User removed from whitelist: ${handle}`);
    return true;
  }

  /**
   * Enable or disable the whitelist
   */
  setEnabled(enabled: boolean): void {
    this.whitelist.enabled = enabled;
    this.whitelist.lastUpdated = new Date().toISOString();
    this.saveWhitelist(this.whitelist);
    
    console.log(`Whitelist ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get all whitelisted users
   */
  getUsers(): string[] {
    return [...this.whitelist.users];
  }

  /**
   * Get whitelist status
   */
  getStatus(): WhitelistData {
    return { ...this.whitelist };
  }

  /**
   * Check if whitelist is enabled
   */
  isEnabled(): boolean {
    return this.whitelist.enabled;
  }

  /**
   * Reload whitelist from file
   */
  reload(): void {
    this.whitelist = this.loadWhitelist();
    console.log('Whitelist reloaded');
  }

  /**
   * Get whitelist file path
   */
  getFilePath(): string {
    return WHITELIST_FILE;
  }
}

// Export singleton instance
export const whitelist = new WhitelistService();
