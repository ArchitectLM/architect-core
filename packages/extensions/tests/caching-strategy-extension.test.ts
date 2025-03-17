import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { CachingStrategyExtension } from '../src/extensions/caching-strategy.js';

describe('CachingStrategyExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let cachingStrategyExtension: CachingStrategyExtension;
  let mockCache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    };

    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'cache.getStrategy',
      description: 'Provides caching strategies'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'cache.generateKey',
      description: 'Generates cache keys'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'cache.shouldCache',
      description: 'Determines if a result should be cached'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'cache.beforeAccess',
      description: 'Called before cache access'
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'cache.afterAccess',
      description: 'Called after cache access'
    });
    
    // Create the caching strategy extension
    cachingStrategyExtension = new CachingStrategyExtension(mockCache);
    
    // Register the extension
    extensionSystem.registerExtension(cachingStrategyExtension);
  });

  describe('GIVEN a request for a time-based caching strategy', () => {
    it('SHOULD return a strategy with the specified TTL', async () => {
      // WHEN requesting a time-based strategy
      const context = {
        strategyName: 'time-based',
        ttl: 60000 // 1 minute
      };
      
      const strategy = await extensionSystem.triggerExtensionPoint('cache.getStrategy', context);
      
      // THEN a strategy should be returned
      expect(strategy).toBeDefined();
      expect(typeof strategy.shouldCache).toBe('function');
      expect(typeof strategy.generateKey).toBe('function');
      
      // AND the strategy should use the specified TTL
      const mockSet = mockCache.set as jest.Mock;
      
      // Test the strategy
      const key = strategy.generateKey({ method: 'getUser', args: [123] });
      expect(key).toBe('getUser:123');
      
      const result = { id: 123, name: 'Test User' };
      strategy.set(key, result);
      
      // Check that the cache was set with the correct TTL
      expect(mockSet).toHaveBeenCalledWith(key, result, 60000);
    });
  });

  describe('GIVEN a request for a sliding expiration strategy', () => {
    it('SHOULD extend TTL on access', async () => {
      // WHEN requesting a sliding expiration strategy
      const context = {
        strategyName: 'sliding-expiration',
        ttl: 60000, // 1 minute
        resetTtlOnAccess: true
      };
      
      const strategy = await extensionSystem.triggerExtensionPoint('cache.getStrategy', context);
      
      // THEN a strategy should be returned
      expect(strategy).toBeDefined();
      
      // Test the strategy
      const key = 'test-key';
      const result = { data: 'test-data' };
      
      // Mock that the item exists in cache
      mockCache.get.mockReturnValueOnce(result);
      
      // WHEN getting an item from cache
      const cachedResult = await strategy.get(key);
      
      // THEN the item should be returned
      expect(cachedResult).toBe(result);
      
      // AND the TTL should be reset
      expect(mockCache.set).toHaveBeenCalledWith(key, result, 60000);
    });
  });

  describe('GIVEN a request for a content-based caching strategy', () => {
    it('SHOULD cache based on content type', async () => {
      // Register a content-based strategy
      cachingStrategyExtension.registerCachingStrategy('content-based', (options) => {
        return {
          shouldCache: (key, value) => {
            // Only cache user objects
            return value && typeof value === 'object' && 'userId' in value;
          },
          generateKey: (context) => {
            // Generate key based on method and first argument
            return `${context.method}:${context.args[0]}`;
          },
          get: async (key) => mockCache.get(key),
          set: async (key, value) => mockCache.set(key, value, options.ttl || 3600000),
          delete: async (key) => mockCache.delete(key),
          clear: async () => mockCache.clear()
        };
      });
      
      // WHEN requesting a content-based strategy
      const context = {
        strategyName: 'content-based',
        ttl: 3600000 // 1 hour
      };
      
      const strategy = await extensionSystem.triggerExtensionPoint('cache.getStrategy', context);
      
      // THEN a strategy should be returned
      expect(strategy).toBeDefined();
      
      // Test the shouldCache function
      expect(strategy.shouldCache('user:123', { userId: 123, name: 'Test' })).toBe(true);
      expect(strategy.shouldCache('product:456', { productId: 456, name: 'Product' })).toBe(false);
    });
  });

  describe('GIVEN a request for a custom key generation strategy', () => {
    it('SHOULD generate keys based on registered generators', async () => {
      // Register custom key generators
      cachingStrategyExtension.registerKeyGenerator('user-service', (context) => {
        if (context.method === 'getUser') {
          return `user:${context.args[0]}`;
        }
        if (context.method === 'getUserByEmail') {
          return `user:email:${context.args[0]}`;
        }
        return null;
      });
      
      cachingStrategyExtension.registerKeyGenerator('product-service', (context) => {
        if (context.method === 'getProduct') {
          return `product:${context.args[0]}`;
        }
        return null;
      });
      
      // WHEN generating keys for different contexts
      const userContext = {
        service: 'user-service',
        method: 'getUser',
        args: [123]
      };
      
      const emailContext = {
        service: 'user-service',
        method: 'getUserByEmail',
        args: ['test@example.com']
      };
      
      const productContext = {
        service: 'product-service',
        method: 'getProduct',
        args: [456]
      };
      
      const userKey = await extensionSystem.triggerExtensionPoint('cache.generateKey', userContext);
      const emailKey = await extensionSystem.triggerExtensionPoint('cache.generateKey', emailContext);
      const productKey = await extensionSystem.triggerExtensionPoint('cache.generateKey', productContext);
      
      // THEN appropriate keys should be generated
      expect(userKey).toBe('user:123');
      expect(emailKey).toBe('user:email:test@example.com');
      expect(productKey).toBe('product:456');
    });
    
    it('SHOULD return null for unknown contexts', async () => {
      // WHEN generating a key for an unknown context
      const unknownContext = {
        service: 'unknown-service',
        method: 'unknownMethod',
        args: []
      };
      
      const key = await extensionSystem.triggerExtensionPoint('cache.generateKey', unknownContext);
      
      // THEN null should be returned
      expect(key).toBeNull();
    });
  });

  describe('GIVEN cache access hooks', () => {
    it('SHOULD track cache metrics', async () => {
      // Create a mock metrics collector
      const metricsCollector = {
        recordCounter: vi.fn(),
        recordGauge: vi.fn(),
        recordHistogram: vi.fn()
      };
      
      // Register cache access hooks
      cachingStrategyExtension.registerCacheAccessHook((accessType, context) => {
        if (accessType === 'before') {
          // Record cache access attempt
          metricsCollector.recordCounter('cache.access.attempts', 1, {
            operation: context.operation,
            service: context.service
          });
        } else if (accessType === 'after') {
          // Record cache hit/miss
          const metricName = context.result ? 'cache.hits' : 'cache.misses';
          metricsCollector.recordCounter(metricName, 1, {
            operation: context.operation,
            service: context.service
          });
          
          // Record latency
          if (context.duration) {
            metricsCollector.recordHistogram('cache.latency', context.duration, {
              operation: context.operation,
              service: context.service
            });
          }
        }
      });
      
      // WHEN accessing the cache
      const beforeContext = {
        operation: 'get',
        key: 'user:123',
        service: 'user-service'
      };
      
      const afterContext = {
        operation: 'get',
        key: 'user:123',
        service: 'user-service',
        result: { id: 123, name: 'Test User' },
        duration: 5
      };
      
      await extensionSystem.triggerExtensionPoint('cache.beforeAccess', beforeContext);
      await extensionSystem.triggerExtensionPoint('cache.afterAccess', afterContext);
      
      // THEN metrics should be recorded
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith('cache.access.attempts', 1, {
        operation: 'get',
        service: 'user-service'
      });
      
      expect(metricsCollector.recordCounter).toHaveBeenCalledWith('cache.hits', 1, {
        operation: 'get',
        service: 'user-service'
      });
      
      expect(metricsCollector.recordHistogram).toHaveBeenCalledWith('cache.latency', 5, {
        operation: 'get',
        service: 'user-service'
      });
    });
  });

  describe('GIVEN conditional caching rules', () => {
    it('SHOULD determine if a result should be cached based on rules', async () => {
      // Register caching rules
      cachingStrategyExtension.registerCachingRule((context) => {
        // Don't cache errors
        if (context.result instanceof Error) {
          return false;
        }
        
        // Don't cache empty results
        if (Array.isArray(context.result) && context.result.length === 0) {
          return false;
        }
        
        // Don't cache null or undefined
        if (context.result === null || context.result === undefined) {
          return false;
        }
        
        // Cache everything else
        return true;
      });
      
      // WHEN checking if various results should be cached
      const errorContext = { key: 'test', result: new Error('Test error') };
      const emptyArrayContext = { key: 'test', result: [] };
      const nullContext = { key: 'test', result: null };
      const validContext = { key: 'test', result: { id: 123 } };
      
      const shouldCacheError = await extensionSystem.triggerExtensionPoint('cache.shouldCache', errorContext);
      const shouldCacheEmptyArray = await extensionSystem.triggerExtensionPoint('cache.shouldCache', emptyArrayContext);
      const shouldCacheNull = await extensionSystem.triggerExtensionPoint('cache.shouldCache', nullContext);
      const shouldCacheValid = await extensionSystem.triggerExtensionPoint('cache.shouldCache', validContext);
      
      // THEN appropriate decisions should be made
      expect(shouldCacheError).toBe(false);
      expect(shouldCacheEmptyArray).toBe(false);
      expect(shouldCacheNull).toBe(false);
      expect(shouldCacheValid).toBe(true);
    });
  });
}); 