import { Extension, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';

/**
 * Options for the caching plugin
 */
export interface CachingOptions {
  /** Default TTL (time-to-live) for cache entries in milliseconds */
  defaultTTL: number;
  
  /** Maximum number of items to store in the cache */
  maxSize: number;
}

/**
 * Options for caching a specific task
 */
export interface TaskCacheOptions {
  /** Whether this task's results should be cached */
  cacheable?: boolean;
  
  /** Custom TTL for this task's cache entries */
  ttl?: number;
}

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  /** The cached result */
  value: any;
  
  /** When this entry was created */
  createdAt: number;
  
  /** When this entry expires */
  expiresAt: number;
  
  /** When this entry was last accessed */
  lastAccessed: number;
}

/**
 * A plugin that caches task execution results to improve performance
 */
export class CachingPlugin implements Extension {
  name = 'caching';
  description = 'Caches task execution results to improve performance';
  id = 'caching-plugin';
  dependencies: string[] = [];
  
  /** The cache storage */
  private cache: Map<string, CacheEntry> = new Map();
  
  /** Options for the caching plugin */
  private options: CachingOptions;
  
  /** Custom cache options per task */
  private taskOptions: Map<string, TaskCacheOptions> = new Map();
  
  constructor(options: CachingOptions) {
    this.options = {
      defaultTTL: options.defaultTTL || 60000, // 1 minute default
      maxSize: options.maxSize || 1000         // 1000 items default
    };
  }
  
  // Implement Extension interface methods
  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return Object.entries(this.hooks).map(([pointName, hook]) => ({
      pointName: pointName as ExtensionPointName,
      hook,
      priority: 0
    }));
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['caching'];
  }
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const taskType = context.taskType;
      const input = context.input;
      
      // Check if this task is cacheable
      if (!this.isTaskCacheable(taskType)) {
        return context;
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(taskType, input);
      
      // Check if we have a valid cache entry
      const entry = this.cache.get(cacheKey);
      if (entry && !this.isExpired(entry)) {
        // Update last accessed time
        entry.lastAccessed = Date.now();
        
        // Skip execution and return cached result
        return {
          ...context,
          skipExecution: true,
          result: entry.value
        };
      }
      
      // No cache hit, store the cache key for later use
      return {
        ...context,
        _cache: {
          key: cacheKey
        }
      };
    },
    
    'task:afterExecution': async (context: any) => {
      const taskType = context.taskType;
      const result = context.result;
      const cacheKey = context._cache?.key;
      
      // If we have a cache key and this task is cacheable, store the result
      if (cacheKey && this.isTaskCacheable(taskType)) {
        this.store(cacheKey, result, this.getTaskTTL(taskType));
      }
      
      return context;
    }
  };
  
  /**
   * Set caching options for a specific task
   */
  setTaskCacheOptions(taskType: string, options: TaskCacheOptions): void {
    this.taskOptions.set(taskType, options);
  }
  
  /**
   * Invalidate a specific cache entry
   */
  invalidate(taskType: string, input: any): void {
    const cacheKey = this.generateCacheKey(taskType, input);
    this.cache.delete(cacheKey);
  }
  
  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Generate a cache key from task type and input
   */
  private generateCacheKey(taskType: string, input: any): string {
    // Simple key generation - taskType + JSON stringified input
    // A more robust implementation might use a hash function
    return `${taskType}:${JSON.stringify(input)}`;
  }
  
  /**
   * Check if a task is cacheable
   */
  private isTaskCacheable(taskType: string): boolean {
    const options = this.taskOptions.get(taskType);
    return options?.cacheable !== false; // Default to true
  }
  
  /**
   * Get the TTL for a specific task
   */
  private getTaskTTL(taskType: string): number {
    const options = this.taskOptions.get(taskType);
    return options?.ttl || this.options.defaultTTL;
  }
  
  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }
  
  /**
   * Store a value in the cache
   */
  private store(key: string, value: any, ttl: number): void {
    // Ensure we don't exceed max size
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }
    
    const now = Date.now();
    
    this.cache.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccessed: now
    });
  }
  
  /**
   * Evict the oldest entry from the cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    // Find the least recently accessed entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    // Delete the oldest entry
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Create a new caching plugin
 */
export function createCachingPlugin(options: CachingOptions): Extension {
  return new CachingPlugin(options);
} 