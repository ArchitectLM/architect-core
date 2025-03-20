/**
 * Redis Distributed Cache Provider for ArchitectLM
 * 
 * This file contains a type-safe Redis distributed cache provider implementation.
 */

import { DistributedCacheProvider } from './cache-types';
import { ConsoleLogger, Logger } from '../runtime/logger';

/**
 * Redis client interface
 * This is a minimal interface that matches the Redis client methods we use
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: string[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  info(section?: string): Promise<string>;
}

/**
 * Redis distributed cache provider implementation
 */
export class RedisDistributedCacheProvider implements DistributedCacheProvider {
  private client: RedisClient;
  private prefix: string;
  private logger: Logger;
  
  constructor(client: RedisClient, prefix: string = 'cache', logger?: Logger) {
    this.client = client;
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
   * Get a value from the distributed cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const prefixedKey = this.getKey(key);
      const value = await this.client.get(prefixedKey);
      
      if (value) {
        return JSON.parse(value) as T;
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Redis cache get error: ${error}`);
      return undefined;
    }
  }
  
  /**
   * Set a value in the distributed cache
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);
      
      if (ttlMs) {
        await this.client.set(prefixedKey, serializedValue, 'PX', ttlMs.toString());
      } else {
        await this.client.set(prefixedKey, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Redis cache set error: ${error}`);
    }
  }
  
  /**
   * Delete a value from the distributed cache
   */
  async delete(key: string): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      await this.client.del(prefixedKey);
    } catch (error) {
      this.logger.error(`Redis cache delete error: ${error}`);
    }
  }
  
  /**
   * Clear all values from the distributed cache with the current prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.prefix}:*`);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Redis cache clear error: ${error}`);
    }
  }
  
  /**
   * Check if a key exists in the distributed cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const exists = await this.client.exists(prefixedKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Redis cache has error: ${error}`);
      return false;
    }
  }
  
  /**
   * Get the number of items in the distributed cache with the current prefix
   */
  async size(): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.prefix}:*`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Redis cache size error: ${error}`);
      return 0;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keyCount: number;
    memory?: string;
    hitRate?: number;
    missRate?: number;
  }> {
    try {
      // Get key count
      const keys = await this.client.keys(`${this.prefix}:*`);
      const keyCount = keys.length;
      
      // Get memory info if available
      let memory: string | undefined;
      try {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        if (memoryMatch && memoryMatch[1]) {
          memory = memoryMatch[1].trim();
        }
      } catch (e) {
        // Ignore errors getting memory info
      }
      
      // Get hit/miss rates if available
      let hitRate: number | undefined;
      let missRate: number | undefined;
      try {
        const info = await this.client.info('stats');
        const hitsMatch = info.match(/keyspace_hits:(\d+)/);
        const missesMatch = info.match(/keyspace_misses:(\d+)/);
        
        if (hitsMatch && missesMatch) {
          const hits = parseInt(hitsMatch[1], 10);
          const misses = parseInt(missesMatch[1], 10);
          const total = hits + misses;
          
          if (total > 0) {
            hitRate = hits / total;
            missRate = misses / total;
          }
        }
      } catch (e) {
        // Ignore errors getting hit/miss rates
      }
      
      return {
        keyCount,
        memory,
        hitRate,
        missRate
      };
    } catch (error) {
      this.logger.error(`Redis cache stats error: ${error}`);
      return { keyCount: 0 };
    }
  }
} 