/**
 * Distributed Cache Implementation for ArchitectLM
 * 
 * This file contains a type-safe distributed cache implementation.
 */

import { 
  Cache, 
  AsyncCache, 
  CacheWithStats, 
  AsyncCacheWithStats, 
  CacheStats, 
  AsyncCacheStats, 
  DistributedCacheProvider 
} from './cache-types';
import { ConsoleLogger, Logger } from '../runtime/logger';

/**
 * Type guard to check if a cache supports statistics
 */
function isCacheWithStats<K, V>(cache: Cache<K, V>): cache is CacheWithStats<K, V> {
  return 'getStats' in cache && typeof (cache as CacheWithStats<K, V>).getStats === 'function';
}

/**
 * Distributed cache implementation that wraps a local cache with a distributed cache provider
 */
export class DistributedCache<K, V> implements Cache<K, V>, AsyncCache<K, V>, AsyncCacheWithStats<K, V> {
  private localCache: Cache<K, V>;
  private provider: DistributedCacheProvider;
  private prefix: string;
  private ttlMs?: number;
  private logger: Logger;
  
  constructor(
    localCache: Cache<K, V>,
    provider: DistributedCacheProvider,
    prefix: string = '',
    ttlMs?: number,
    logger?: Logger
  ) {
    this.localCache = localCache;
    this.provider = provider;
    this.prefix = prefix;
    this.ttlMs = ttlMs;
    this.logger = logger || new ConsoleLogger();
  }
  
  /**
   * Generate a distributed cache key
   */
  private getDistributedKey(key: K): string {
    return `${this.prefix}:${String(key)}`;
  }
  
  /**
   * Get a value from the cache asynchronously
   */
  async getAsync(key: K): Promise<V | undefined> {
    // Check local cache first
    const localValue = this.localCache.get(key);
    if (localValue !== undefined) {
      return localValue;
    }
    
    try {
      // Try to get from distributed cache
      const distributedKey = this.getDistributedKey(key);
      const distributedValue = await this.provider.get<V>(distributedKey);
      
      if (distributedValue !== undefined) {
        // Update local cache
        this.localCache.set(key, distributedValue);
        return distributedValue;
      }
    } catch (error) {
      this.logger.warn(`Error getting value from distributed cache: ${error}`);
    }
    
    return undefined;
  }
  
  /**
   * Get a value from the cache synchronously (falls back to local cache only)
   */
  get(key: K): V | undefined {
    return this.localCache.get(key);
  }
  
  /**
   * Set a value in the cache asynchronously
   */
  async setAsync(key: K, value: V, ttlMs?: number): Promise<void> {
    // Update local cache
    this.localCache.set(key, value);
    
    try {
      // Update distributed cache
      const distributedKey = this.getDistributedKey(key);
      await this.provider.set(distributedKey, value, ttlMs || this.ttlMs);
    } catch (error) {
      this.logger.warn(`Error setting value in distributed cache: ${error}`);
    }
  }
  
  /**
   * Set a value in the cache synchronously (updates local cache only)
   */
  set(key: K, value: V): void {
    this.localCache.set(key, value);
    
    // Asynchronously update the distributed cache
    const distributedKey = this.getDistributedKey(key);
    this.provider.set(distributedKey, value, this.ttlMs).catch(error => {
      this.logger.warn(`Error setting value in distributed cache: ${error}`);
    });
  }
  
  /**
   * Check if a key exists in the cache asynchronously
   */
  async hasAsync(key: K): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return true;
    }
    
    try {
      // Check distributed cache
      const distributedKey = this.getDistributedKey(key);
      return await this.provider.has(distributedKey);
    } catch (error) {
      this.logger.warn(`Error checking key in distributed cache: ${error}`);
      return false;
    }
  }
  
  /**
   * Check if a key exists in the cache synchronously (falls back to local cache only)
   */
  has(key: K): boolean {
    return this.localCache.has(key);
  }
  
  /**
   * Delete a value from the cache asynchronously
   */
  async deleteAsync(key: K): Promise<boolean> {
    // Delete from local cache
    const localResult = this.localCache.delete(key);
    
    try {
      // Delete from distributed cache
      const distributedKey = this.getDistributedKey(key);
      await this.provider.delete(distributedKey);
    } catch (error) {
      this.logger.warn(`Error deleting value from distributed cache: ${error}`);
    }
    
    return localResult;
  }
  
  /**
   * Delete a value from the cache synchronously (updates local cache only)
   */
  delete(key: K): boolean {
    const result = this.localCache.delete(key);
    
    // Asynchronously delete from the distributed cache
    const distributedKey = this.getDistributedKey(key);
    this.provider.delete(distributedKey).catch(error => {
      this.logger.warn(`Error deleting value from distributed cache: ${error}`);
    });
    
    return result;
  }
  
  /**
   * Clear the cache asynchronously
   */
  async clearAsync(): Promise<void> {
    // Clear local cache
    this.localCache.clear();
    
    try {
      // Clear distributed cache (only keys with our prefix)
      await this.provider.clear();
    } catch (error) {
      this.logger.warn(`Error clearing distributed cache: ${error}`);
    }
  }
  
  /**
   * Clear the cache synchronously (clears local cache only)
   */
  clear(): void {
    this.localCache.clear();
    
    // Asynchronously clear the distributed cache
    this.provider.clear().catch(error => {
      this.logger.warn(`Error clearing distributed cache: ${error}`);
    });
  }
  
  /**
   * Get the number of items in the cache asynchronously
   */
  async sizeAsync(): Promise<number> {
    try {
      // Get size from distributed cache
      return await this.provider.size();
    } catch (error) {
      this.logger.warn(`Error getting size from distributed cache: ${error}`);
      return this.localCache.size();
    }
  }
  
  /**
   * Get the number of items in the cache synchronously (falls back to local cache only)
   */
  size(): number {
    return this.localCache.size();
  }
  
  /**
   * Get cache statistics asynchronously
   */
  async getStatsAsync(): Promise<AsyncCacheStats> {
    try {
      // Get stats from distributed cache
      const distributedStats = await this.provider.getStats();
      
      // Get stats from local cache if it supports statistics
      let localStats: CacheStats | null = null;
      if (isCacheWithStats(this.localCache)) {
        localStats = this.localCache.getStats();
      }
      
      return {
        local: localStats,
        distributed: distributedStats
      };
    } catch (error) {
      this.logger.warn(`Error getting stats from distributed cache: ${error}`);
      
      // Get stats from local cache if it supports statistics
      let localStats: CacheStats | null = null;
      if (isCacheWithStats(this.localCache)) {
        localStats = this.localCache.getStats();
      }
      
      return {
        local: localStats,
        distributed: null
      };
    }
  }
} 