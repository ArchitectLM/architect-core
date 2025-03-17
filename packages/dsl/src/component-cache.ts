/**
 * Component caching system for improved performance
 */

import { BaseComponent } from './types.js';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  /**
   * The cached value
   */
  value: T;
  
  /**
   * When the entry was created
   */
  createdAt: number;
  
  /**
   * When the entry was last accessed
   */
  lastAccessed: number;
  
  /**
   * Component version that was used to generate this cache entry
   */
  componentVersion?: string;
  
  /**
   * Hash of the component content for cache invalidation
   */
  contentHash: string;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /**
   * Maximum time to live for cache entries in milliseconds
   */
  ttl?: number;
  
  /**
   * Maximum number of entries in the cache
   */
  maxEntries?: number;
  
  /**
   * Whether to use sliding expiration (reset TTL on access)
   */
  slidingExpiration?: boolean;
}

/**
 * Component cache for storing compiled components and other artifacts
 */
export class ComponentCache<T = string> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: CacheOptions;
  
  /**
   * Create a new component cache
   * @param options Cache options
   */
  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: 3600000, // 1 hour
      maxEntries: 1000,
      slidingExpiration: true,
      ...options
    };
  }
  
  /**
   * Generate a cache key for a component
   * @param component The component
   * @param suffix Optional suffix for the key
   * @returns The cache key
   */
  private generateKey(component: BaseComponent, suffix?: string): string {
    return `${component.type}:${component.name}${suffix ? `:${suffix}` : ''}`;
  }
  
  /**
   * Generate a content hash for a component
   * @param component The component
   * @returns The content hash
   */
  private generateContentHash(component: BaseComponent): string {
    return JSON.stringify(component);
  }
  
  /**
   * Set a value in the cache
   * @param component The component
   * @param value The value to cache
   * @param suffix Optional suffix for the key
   */
  set(component: BaseComponent, value: T, suffix?: string): void {
    const key = this.generateKey(component, suffix);
    const contentHash = this.generateContentHash(component);
    
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      componentVersion: component.version,
      contentHash
    });
    
    // Enforce max entries limit
    if (this.options.maxEntries && this.cache.size > this.options.maxEntries) {
      // Sort entries by lastAccessed time and remove the oldest one
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      if (entries.length > 0) {
        this.cache.delete(entries[0][0]);
      }
    }
  }
  
  /**
   * Get a value from the cache
   * @param component The component
   * @param suffix Optional suffix for the key
   * @returns The cached value or undefined if not found
   */
  get(component: BaseComponent, suffix?: string): T | undefined {
    const key = this.generateKey(component, suffix);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    const now = Date.now();
    
    // Check if the entry has expired
    if (this.options.ttl) {
      // Use lastAccessed for sliding expiration, createdAt otherwise
      const timeToCheck = this.options.slidingExpiration ? entry.lastAccessed : entry.createdAt;
      if (now - timeToCheck > this.options.ttl) {
        this.cache.delete(key);
        return undefined;
      }
    }
    
    // Check if the component has changed
    const contentHash = this.generateContentHash(component);
    if (entry.contentHash !== contentHash) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Update last accessed time for sliding expiration
    if (this.options.slidingExpiration) {
      entry.lastAccessed = now;
    }
    
    return entry.value;
  }
  
  /**
   * Check if a value exists in the cache
   * @param component The component
   * @param suffix Optional suffix for the key
   * @returns Whether the value exists in the cache
   */
  has(component: BaseComponent, suffix?: string): boolean {
    return this.get(component, suffix) !== undefined;
  }
  
  /**
   * Remove a value from the cache
   * @param component The component
   * @param suffix Optional suffix for the key
   */
  remove(component: BaseComponent, suffix?: string): void {
    const key = this.generateKey(component, suffix);
    this.cache.delete(key);
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get the number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }
} 