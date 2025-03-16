/**
 * Cache Types for ArchitectLM
 * 
 * This file contains type-safe cache interfaces and implementations.
 */

import { Logger } from '../runtime/logger';

/**
 * Cache interface for performance optimization
 */
export interface Cache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
}

/**
 * Interface for caches that support statistics
 */
export interface CacheWithStats<K, V> extends Cache<K, V> {
  getStats(): CacheStats;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
}

/**
 * LRU Cache implementation with statistics
 */
export class LRUCache<K, V> implements CacheWithStats<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(maxSize: number = 100) {
    this.cache = new Map<K, V>();
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to the end to mark as recently used
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }
  
  set(key: K, value: V): void {
    // If cache is full, remove the least recently used item (first item)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }
  
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? this.hits / total : 0;
    return { hits: this.hits, misses: this.misses, hitRatio };
  }
}

/**
 * Asynchronous cache interface for distributed caching
 */
export interface AsyncCache<K, V> {
  getAsync(key: K): Promise<V | undefined>;
  setAsync(key: K, value: V, ttlMs?: number): Promise<void>;
  hasAsync(key: K): Promise<boolean>;
  deleteAsync(key: K): Promise<boolean>;
  clearAsync(): Promise<void>;
  sizeAsync(): Promise<number>;
}

/**
 * Interface for async caches that support statistics
 */
export interface AsyncCacheWithStats<K, V> extends AsyncCache<K, V> {
  getStatsAsync(): Promise<AsyncCacheStats>;
}

/**
 * Async cache statistics
 */
export interface AsyncCacheStats {
  local: CacheStats | null;
  distributed: unknown;
}

/**
 * Distributed cache provider interface
 */
export interface DistributedCacheProvider {
  /**
   * Get a value from the distributed cache
   */
  get<T>(key: string): Promise<T | undefined>;
  
  /**
   * Set a value in the distributed cache
   */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  
  /**
   * Delete a value from the distributed cache
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear all values from the distributed cache
   */
  clear(): Promise<void>;
  
  /**
   * Check if a key exists in the distributed cache
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Get the number of items in the distributed cache
   */
  size(): Promise<number>;
  
  /**
   * Get cache statistics
   */
  getStats(): Promise<unknown>;
} 