/**
 * In-Memory Distributed Cache Provider for ArchitectLM
 * 
 * This file contains a type-safe in-memory distributed cache provider implementation.
 * This is useful for testing and development environments.
 */

import { DistributedCacheProvider } from './cache-types';
import { ConsoleLogger, Logger } from '../runtime/logger';

/**
 * Cache entry with optional expiry
 */
interface CacheEntry<T> {
  value: T;
  expiry?: number; // Timestamp when the entry expires
}

/**
 * In-memory distributed cache provider implementation
 */
export class InMemoryDistributedCacheProvider implements DistributedCacheProvider {
  private static cache: Map<string, CacheEntry<unknown>> = new Map();
  private prefix: string;
  private hits: number = 0;
  private misses: number = 0;
  private logger: Logger;
  
  constructor(prefix: string = 'cache', logger?: Logger) {
    this.prefix = prefix;
    this.logger = logger || new ConsoleLogger();
  }
  
  /**
   * Get a prefixed key
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
  
  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return !!entry.expiry && entry.expiry < Date.now();
  }
  
  /**
   * Get a value from the distributed cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const prefixedKey = this.getKey(key);
      const entry = InMemoryDistributedCacheProvider.cache.get(prefixedKey);
      
      if (!entry) {
        this.misses++;
        return undefined;
      }
      
      // Check if the entry has expired
      if (this.isExpired(entry)) {
        InMemoryDistributedCacheProvider.cache.delete(prefixedKey);
        this.misses++;
        return undefined;
      }
      
      this.hits++;
      return entry.value as T;
    } catch (error) {
      this.logger.error(`In-memory cache get error: ${error}`);
      return undefined;
    }
  }
  
  /**
   * Set a value in the distributed cache
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      const entry: CacheEntry<unknown> = {
        value
      };
      
      if (ttlMs) {
        entry.expiry = Date.now() + ttlMs;
      }
      
      InMemoryDistributedCacheProvider.cache.set(prefixedKey, entry);
    } catch (error) {
      this.logger.error(`In-memory cache set error: ${error}`);
    }
  }
  
  /**
   * Delete a value from the distributed cache
   */
  async delete(key: string): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      InMemoryDistributedCacheProvider.cache.delete(prefixedKey);
    } catch (error) {
      this.logger.error(`In-memory cache delete error: ${error}`);
    }
  }
  
  /**
   * Clear all values from the distributed cache with the current prefix
   */
  async clear(): Promise<void> {
    try {
      // Delete all keys with the current prefix
      for (const key of InMemoryDistributedCacheProvider.cache.keys()) {
        if (key.startsWith(`${this.prefix}:`)) {
          InMemoryDistributedCacheProvider.cache.delete(key);
        }
      }
    } catch (error) {
      this.logger.error(`In-memory cache clear error: ${error}`);
    }
  }
  
  /**
   * Check if a key exists in the distributed cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const entry = InMemoryDistributedCacheProvider.cache.get(prefixedKey);
      
      if (!entry) {
        return false;
      }
      
      // Check if the entry has expired
      if (this.isExpired(entry)) {
        InMemoryDistributedCacheProvider.cache.delete(prefixedKey);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`In-memory cache has error: ${error}`);
      return false;
    }
  }
  
  /**
   * Get the number of items in the distributed cache with the current prefix
   */
  async size(): Promise<number> {
    try {
      let count = 0;
      const now = Date.now();
      
      // Count all non-expired keys with the current prefix
      for (const [key, entry] of InMemoryDistributedCacheProvider.cache.entries()) {
        if (key.startsWith(`${this.prefix}:`)) {
          if (!entry.expiry || entry.expiry > now) {
            count++;
          } else {
            // Clean up expired entries
            InMemoryDistributedCacheProvider.cache.delete(key);
          }
        }
      }
      
      return count;
    } catch (error) {
      this.logger.error(`In-memory cache size error: ${error}`);
      return 0;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    hits: number;
    misses: number;
    hitRatio: number;
    memoryUsage: {
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  }> {
    try {
      const size = await this.size();
      const total = this.hits + this.misses;
      const hitRatio = total > 0 ? this.hits / total : 0;
      
      // Get memory usage if available
      const memoryUsage = process.memoryUsage ? {
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external
      } : {
        heapTotal: 0,
        heapUsed: 0,
        external: 0
      };
      
      return {
        size,
        hits: this.hits,
        misses: this.misses,
        hitRatio,
        memoryUsage
      };
    } catch (error) {
      this.logger.error(`In-memory cache stats error: ${error}`);
      return {
        size: 0,
        hits: 0,
        misses: 0,
        hitRatio: 0,
        memoryUsage: {
          heapTotal: 0,
          heapUsed: 0,
          external: 0
        }
      };
    }
  }
} 