/**
 * Query extension for the DSL
 * 
 * Adds caching and validation capabilities to query components.
 */
import { defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { ComponentType, QueryComponentDefinition } from '../models/component.js';

/**
 * Query extension options
 */
export interface QueryExtensionOptions {
  /**
   * Default cache TTL in milliseconds
   */
  defaultCacheTtl?: number;
  
  /**
   * Whether to enable caching by default
   */
  enableCaching?: boolean;
  
  /**
   * Maximum number of items to cache
   */
  maxCacheItems?: number;
  
  /**
   * Whether to enable automatic input validation
   */
  autoValidateInput?: boolean;
  
  /**
   * Whether to enable automatic output validation
   */
  autoValidateOutput?: boolean;
}

/**
 * Simple in-memory cache implementation
 */
class QueryCache {
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private maxItems: number;
  
  constructor(maxItems: number = 1000) {
    this.maxItems = maxItems;
  }
  
  /**
   * Set a cache item
   */
  set(key: string, data: any, ttl: number): void {
    // Evict oldest items if cache is full
    if (this.cache.size >= this.maxItems) {
      const oldestKey = Array.from(this.cache.entries())
        .reduce((oldest, [k, v]) => {
          if (!oldest || v.expires < this.cache.get(oldest)!.expires) {
            return k;
          }
          return oldest;
        }, null as string | null);
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Set the cache item with expiration
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
  }
  
  /**
   * Get a cache item
   */
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    // Return null if item doesn't exist or is expired
    if (!item || item.expires < Date.now()) {
      if (item) {
        this.cache.delete(key); // Remove expired item
      }
      return null;
    }
    
    return item.data;
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Query extension setup
 */
export function setupQueryExtension(dsl: DSL, options: QueryExtensionOptions = {}): void {
  // Create a shared cache instance
  const cache = new QueryCache(options.maxCacheItems);
  
  // TODO: Implement a way to get all query components from the DSL
  // For now, this is a placeholder
}

/**
 * Extend a query component with caching and validation capabilities
 */
function extendQueryComponent(query: QueryComponentDefinition, options: QueryExtensionOptions, dsl: DSL, cache: QueryCache): void {
  // Get the implementation for this query
  const implementation = dsl.getImplementation(query.id);
  
  // Skip if no implementation is found
  if (!implementation) {
    console.warn(`No implementation found for query: ${query.id}`);
    return;
  }
  
  // Get the input and output schemas if they exist
  const inputSchema = query.input?.ref ? dsl.getComponent(query.input.ref) : null;
  const outputSchema = query.output?.ref ? dsl.getComponent(query.output.ref) : null;
  
  // Create an execute method that validates input and output
  (query as any).execute = async (input: any, context: any = {}) => {
    // Validate input if auto-validation is enabled and input schema exists
    if (options.autoValidateInput && inputSchema && (inputSchema as any).validate) {
      const validation = (inputSchema as any).validate(input);
      if (!validation.valid) {
        throw new Error(`Invalid input for query ${query.id}: ${JSON.stringify(validation.errors)}`);
      }
    }
    
    // Create execution context
    const executionContext = {
      ...context,
      query: query.id,
      startTime: Date.now()
    };
    
    // Check if caching is enabled for this query
    const cachingEnabled = context.cache !== false && 
      (context.cache === true || options.enableCaching);
    
    // Generate cache key if caching is enabled
    let cacheKey = null;
    if (cachingEnabled) {
      cacheKey = `${query.id}:${JSON.stringify(input)}`;
      
      // Check cache
      const cachedResult = cache.get(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }
    }
    
    // Execute the query
    const result = await implementation.handler(input, executionContext);
    
    // Validate output if auto-validation is enabled and output schema exists
    if (options.autoValidateOutput && outputSchema && (outputSchema as any).validate) {
      const validation = (outputSchema as any).validate(result);
      if (!validation.valid) {
        throw new Error(`Invalid output from query ${query.id}: ${JSON.stringify(validation.errors)}`);
      }
    }
    
    // Cache the result if caching is enabled
    if (cachingEnabled && cacheKey) {
      const ttl = context.cacheTtl || options.defaultCacheTtl || 60000; // Default 1 minute
      cache.set(cacheKey, result, ttl);
    }
    
    return result;
  };
}

/**
 * Define the query extension
 */
export const queryExtension = defineExtension({
  id: 'query',
  name: 'Query Extension',
  description: 'Adds caching and validation capabilities to query components',
  
  async setup(options?: QueryExtensionOptions) {
    // This will be called when the extension is initialized
    console.log('Query extension setup with options:', options);
  }
}); 