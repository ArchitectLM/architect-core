import { Extension } from '../extension-system.js';

/**
 * Interface for a cache
 */
export interface Cache {
  /**
   * Get a value from the cache
   * @param key The key to get
   * @returns The value or undefined if not found
   */
  get(key: string): Promise<any> | any;
  
  /**
   * Set a value in the cache
   * @param key The key to set
   * @param value The value to set
   * @param ttl The time-to-live in milliseconds
   */
  set(key: string, value: any, ttl?: number): Promise<void> | void;
  
  /**
   * Delete a value from the cache
   * @param key The key to delete
   */
  delete(key: string): Promise<void> | void;
  
  /**
   * Clear the cache
   */
  clear(): Promise<void> | void;
}

/**
 * Interface for a caching strategy
 */
export interface CachingStrategy {
  /**
   * Determine if a value should be cached
   * @param key The cache key
   * @param value The value to cache
   * @returns Whether the value should be cached
   */
  shouldCache(key: string, value: any): boolean;
  
  /**
   * Generate a cache key
   * @param context The context to generate a key for
   * @returns The generated key
   */
  generateKey(context: { method: string; args: any[] }): string;
  
  /**
   * Get a value from the cache
   * @param key The key to get
   * @returns The value or undefined if not found
   */
  get(key: string): Promise<any>;
  
  /**
   * Set a value in the cache
   * @param key The key to set
   * @param value The value to set
   */
  set(key: string, value: any): Promise<void>;
  
  /**
   * Delete a value from the cache
   * @param key The key to delete
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear the cache
   */
  clear(): Promise<void>;
}

/**
 * Interface for the context passed to the caching strategy extension point
 */
export interface CachingStrategyContext {
  /** The name of the strategy to use */
  strategyName: string;
  /** The time-to-live in milliseconds */
  ttl?: number;
  /** Additional options for the strategy */
  [key: string]: any;
}

/**
 * Interface for the context passed to the key generation extension point
 */
export interface KeyGenerationContext {
  /** The service or component generating the key */
  service: string;
  /** The method being called */
  method: string;
  /** The arguments to the method */
  args: any[];
  /** Additional context information */
  [key: string]: any;
}

/**
 * Interface for the context passed to the should cache extension point
 */
export interface ShouldCacheContext {
  /** The cache key */
  key: string;
  /** The result to potentially cache */
  result: any;
  /** Additional context information */
  [key: string]: any;
}

/**
 * Interface for the context passed to the cache access extension points
 */
export interface CacheAccessContext {
  /** The operation being performed (get, set, delete, clear) */
  operation: string;
  /** The cache key (for get, set, delete) */
  key?: string;
  /** The value being set (for set) */
  value?: any;
  /** The result of the operation (for get) */
  result?: any;
  /** The time taken to perform the operation in milliseconds */
  duration?: number;
  /** The service or component accessing the cache */
  service?: string;
  /** Additional context information */
  [key: string]: any;
}

/**
 * Type for a caching strategy provider function
 */
export type CachingStrategyProvider = (options: Record<string, any>) => CachingStrategy;

/**
 * Type for a key generator function
 */
export type KeyGenerator = (context: KeyGenerationContext) => string | null;

/**
 * Type for a caching rule function
 */
export type CachingRule = (context: ShouldCacheContext) => boolean;

/**
 * Type for a cache access hook function
 */
export type CacheAccessHook = (
  accessType: 'before' | 'after',
  context: CacheAccessContext
) => void;

/**
 * Extension that provides caching strategies
 */
export class CachingStrategyExtension implements Extension {
  name = 'caching-strategy';
  description = 'Provides caching strategies';
  
  private cache: Cache;
  private strategies: Map<string, CachingStrategyProvider> = new Map();
  private keyGenerators: Map<string, KeyGenerator> = new Map();
  private cachingRules: CachingRule[] = [];
  private accessHooks: CacheAccessHook[] = [];
  
  constructor(cache: Cache) {
    this.cache = cache;
    
    // Register built-in strategies
    this.registerCachingStrategy('time-based', this.createTimeBasedStrategy.bind(this));
    this.registerCachingStrategy('sliding-expiration', this.createSlidingExpirationStrategy.bind(this));
  }
  
  /**
   * Register a caching strategy
   * @param name The name of the strategy
   * @param provider The function that provides the strategy
   */
  registerCachingStrategy(name: string, provider: CachingStrategyProvider): void {
    this.strategies.set(name, provider);
  }
  
  /**
   * Register a key generator
   * @param service The service or component the generator is for
   * @param generator The function that generates keys
   */
  registerKeyGenerator(service: string, generator: KeyGenerator): void {
    this.keyGenerators.set(service, generator);
  }
  
  /**
   * Register a caching rule
   * @param rule The function that determines if a value should be cached
   */
  registerCachingRule(rule: CachingRule): void {
    this.cachingRules.push(rule);
  }
  
  /**
   * Register a cache access hook
   * @param hook The function that is called before and after cache access
   */
  registerCacheAccessHook(hook: CacheAccessHook): void {
    this.accessHooks.push(hook);
  }
  
  /**
   * Create a time-based caching strategy
   * @param options Options for the strategy
   * @returns A caching strategy
   */
  private createTimeBasedStrategy(options: Record<string, any>): CachingStrategy {
    const ttl = options.ttl || 3600000; // Default to 1 hour
    
    return {
      shouldCache: (key: string, value: any) => {
        // Don't cache null or undefined
        if (value === null || value === undefined) {
          return false;
        }
        
        return true;
      },
      
      generateKey: (context: { method: string; args: any[] }) => {
        // Generate a key based on the method name and arguments
        const { method, args } = context;
        return `${method}:${args.map(arg => String(arg)).join(':')}`;
      },
      
      get: async (key: string) => {
        const startTime = Date.now();
        let result;
        
        // Call before hooks
        for (const hook of this.accessHooks) {
          hook('before', { operation: 'get', key });
        }
        
        try {
          result = await this.cache.get(key);
        } finally {
          const duration = Date.now() - startTime;
          
          // Call after hooks
          for (const hook of this.accessHooks) {
            hook('after', {
              operation: 'get',
              key,
              result,
              duration
            });
          }
        }
        
        return result;
      },
      
      set: async (key: string, value: any) => {
        const startTime = Date.now();
        
        // Call before hooks
        for (const hook of this.accessHooks) {
          hook('before', { operation: 'set', key, value });
        }
        
        try {
          await this.cache.set(key, value, ttl);
        } finally {
          const duration = Date.now() - startTime;
          
          // Call after hooks
          for (const hook of this.accessHooks) {
            hook('after', {
              operation: 'set',
              key,
              value,
              duration
            });
          }
        }
      },
      
      delete: async (key: string) => {
        const startTime = Date.now();
        
        // Call before hooks
        for (const hook of this.accessHooks) {
          hook('before', { operation: 'delete', key });
        }
        
        try {
          await this.cache.delete(key);
        } finally {
          const duration = Date.now() - startTime;
          
          // Call after hooks
          for (const hook of this.accessHooks) {
            hook('after', {
              operation: 'delete',
              key,
              duration
            });
          }
        }
      },
      
      clear: async () => {
        const startTime = Date.now();
        
        // Call before hooks
        for (const hook of this.accessHooks) {
          hook('before', { operation: 'clear' });
        }
        
        try {
          await this.cache.clear();
        } finally {
          const duration = Date.now() - startTime;
          
          // Call after hooks
          for (const hook of this.accessHooks) {
            hook('after', {
              operation: 'clear',
              duration
            });
          }
        }
      }
    };
  }
  
  /**
   * Create a sliding expiration caching strategy
   * @param options Options for the strategy
   * @returns A caching strategy
   */
  private createSlidingExpirationStrategy(options: Record<string, any>): CachingStrategy {
    const ttl = options.ttl || 3600000; // Default to 1 hour
    const resetTtlOnAccess = options.resetTtlOnAccess !== false; // Default to true
    
    // Start with a time-based strategy
    const baseStrategy = this.createTimeBasedStrategy(options);
    
    // Override the get method to reset TTL on access
    return {
      ...baseStrategy,
      
      get: async (key: string) => {
        const startTime = Date.now();
        let result;
        
        // Call before hooks
        for (const hook of this.accessHooks) {
          hook('before', { operation: 'get', key });
        }
        
        try {
          result = await this.cache.get(key);
          
          // Reset TTL if value exists and resetTtlOnAccess is true
          if (result !== undefined && result !== null && resetTtlOnAccess) {
            await this.cache.set(key, result, ttl);
          }
        } finally {
          const duration = Date.now() - startTime;
          
          // Call after hooks
          for (const hook of this.accessHooks) {
            hook('after', {
              operation: 'get',
              key,
              result,
              duration
            });
          }
        }
        
        return result;
      }
    };
  }
  
  hooks = {
    'cache.getStrategy': (context: CachingStrategyContext) => {
      const { strategyName, ...options } = context;
      
      // Check if we have a strategy with this name
      if (this.strategies.has(strategyName)) {
        const provider = this.strategies.get(strategyName);
        return provider?.(options);
      }
      
      // Return null if no strategy is found
      return null;
    },
    
    'cache.generateKey': (context: KeyGenerationContext) => {
      const { service } = context;
      
      // Check if we have a key generator for this service
      if (this.keyGenerators.has(service)) {
        const generator = this.keyGenerators.get(service);
        return generator?.(context);
      }
      
      // Return null if no generator is found
      return null;
    },
    
    'cache.shouldCache': (context: ShouldCacheContext) => {
      // Apply all caching rules
      for (const rule of this.cachingRules) {
        if (!rule(context)) {
          return false;
        }
      }
      
      // If no rules rejected caching, allow it
      return true;
    },
    
    'cache.beforeAccess': (context: CacheAccessContext) => {
      // Call all access hooks with 'before'
      for (const hook of this.accessHooks) {
        hook('before', context);
      }
      
      return context;
    },
    
    'cache.afterAccess': (context: CacheAccessContext) => {
      // Call all access hooks with 'after'
      for (const hook of this.accessHooks) {
        hook('after', context);
      }
      
      return context;
    }
  };
} 