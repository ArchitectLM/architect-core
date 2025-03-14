import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  Cache, 
  LRUCache, 
  DistributedCache, 
  DistributedCacheProvider,
  InMemoryDistributedCacheProvider,
  ConsoleLogger
} from '../reactive-runtime';

describe('Distributed Cache', () => {
  let localCache: LRUCache<string, string>;
  let provider: DistributedCacheProvider;
  let distributedCache: DistributedCache<string, string>;
  let logger: ConsoleLogger;
  
  beforeEach(() => {
    localCache = new LRUCache<string, string>(10);
    provider = new InMemoryDistributedCacheProvider('test');
    logger = new ConsoleLogger();
    
    // Spy on logger methods
    vi.spyOn(logger, 'warn');
    vi.spyOn(logger, 'error');
    
    distributedCache = new DistributedCache<string, string>(
      localCache,
      provider,
      'test',
      undefined,
      logger
    );
  });
  
  describe('Synchronous operations', () => {
    it('should get and set values synchronously', () => {
      distributedCache.set('key1', 'value1');
      
      expect(distributedCache.get('key1')).toBe('value1');
      expect(localCache.get('key1')).toBe('value1');
    });
    
    it('should check if a key exists synchronously', () => {
      distributedCache.set('key1', 'value1');
      
      expect(distributedCache.has('key1')).toBe(true);
      expect(distributedCache.has('key2')).toBe(false);
    });
    
    it('should delete a key synchronously', () => {
      distributedCache.set('key1', 'value1');
      expect(distributedCache.has('key1')).toBe(true);
      
      distributedCache.delete('key1');
      expect(distributedCache.has('key1')).toBe(false);
    });
    
    it('should clear the cache synchronously', () => {
      distributedCache.set('key1', 'value1');
      distributedCache.set('key2', 'value2');
      
      distributedCache.clear();
      
      expect(distributedCache.has('key1')).toBe(false);
      expect(distributedCache.has('key2')).toBe(false);
      expect(distributedCache.size()).toBe(0);
    });
    
    it('should return the size of the cache synchronously', () => {
      expect(distributedCache.size()).toBe(0);
      
      distributedCache.set('key1', 'value1');
      distributedCache.set('key2', 'value2');
      
      expect(distributedCache.size()).toBe(2);
    });
  });
  
  describe('Asynchronous operations', () => {
    it('should get and set values asynchronously', async () => {
      await distributedCache.setAsync('key1', 'value1');
      
      const value = await distributedCache.getAsync('key1');
      expect(value).toBe('value1');
    });
    
    it('should check if a key exists asynchronously', async () => {
      // Mock the provider.has method
      vi.spyOn(provider, 'has').mockImplementation(async (key: string) => {
        return key === 'test:key1';
      });
      
      await distributedCache.setAsync('key1', 'value1');
      
      expect(await distributedCache.hasAsync('key1')).toBe(true);
      expect(await distributedCache.hasAsync('key2')).toBe(false);
    });
    
    it('should delete a key asynchronously', async () => {
      await distributedCache.setAsync('key1', 'value1');
      expect(await distributedCache.hasAsync('key1')).toBe(true);
      
      await distributedCache.deleteAsync('key1');
      expect(await distributedCache.hasAsync('key1')).toBe(false);
    });
    
    it('should clear the cache asynchronously', async () => {
      await distributedCache.setAsync('key1', 'value1');
      await distributedCache.setAsync('key2', 'value2');
      
      await distributedCache.clearAsync();
      
      expect(await distributedCache.hasAsync('key1')).toBe(false);
      expect(await distributedCache.hasAsync('key2')).toBe(false);
      expect(await distributedCache.sizeAsync()).toBe(0);
    });
    
    it('should return the size of the cache asynchronously', async () => {
      expect(await distributedCache.sizeAsync()).toBe(0);
      
      await distributedCache.setAsync('key1', 'value1');
      await distributedCache.setAsync('key2', 'value2');
      
      expect(await distributedCache.sizeAsync()).toBe(2);
    });
    
    it('should get cache statistics asynchronously', async () => {
      await distributedCache.setAsync('key1', 'value1');
      
      // Get the value to increment hit counter
      await distributedCache.getAsync('key1');
      
      // Try to get a non-existent value to increment miss counter
      await distributedCache.getAsync('key2');
      
      const stats = await distributedCache.getStatsAsync();
      
      expect(stats).toBeDefined();
      expect(stats.local).toBeDefined();
      expect(stats.local.hits).toBe(1);
      expect(stats.local.misses).toBe(1);
      expect(stats.distributed).toBeDefined();
    });
  });
  
  describe('Error handling', () => {
    it('should handle errors in getAsync', async () => {
      // Create a provider that throws an error
      const errorProvider = {
        get: () => Promise.reject(new Error('Test error')),
        set: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        clear: () => Promise.resolve(),
        has: () => Promise.resolve(false),
        size: () => Promise.resolve(0),
        getStats: () => Promise.resolve({})
      } as DistributedCacheProvider;
      
      // Create a cache with the error provider
      const errorCache = new DistributedCache<string, string>(
        localCache,
        errorProvider,
        'test'
      );
      
      // Set a value in local cache
      localCache.set('key1', 'local-value');
      
      // Should fall back to local cache
      const value = await errorCache.getAsync('key1');
      
      // Verify the value is from local cache
      expect(value).toBe('local-value');
    });
    
    it('should handle errors in setAsync', async () => {
      const errorProvider = {
        get: vi.fn(),
        set: vi.fn().mockRejectedValue(new Error('Test error')),
        delete: vi.fn(),
        clear: vi.fn(),
        has: vi.fn(),
        size: vi.fn(),
        getStats: vi.fn()
      } as unknown as DistributedCacheProvider;
      
      const errorCache = new DistributedCache<string, string>(
        localCache,
        errorProvider,
        'test',
        undefined,
        logger
      );
      
      // Should not throw
      await errorCache.setAsync('key1', 'value1');
      
      // Should still set in local cache
      expect(localCache.get('key1')).toBe('value1');
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('Integration with ReactiveRuntime', () => {
    it('should work with both local and distributed caches', async () => {
      // This test would integrate with ReactiveRuntime
      // For now, we'll just verify that the cache works as expected
      
      // Set in local cache
      localCache.set('local-key', 'local-value');
      
      // Set in distributed cache
      await provider.set('test:distributed-key', 'distributed-value');
      
      // Get from local cache
      expect(distributedCache.get('local-key')).toBe('local-value');
      
      // Get from distributed cache
      expect(await distributedCache.getAsync('distributed-key')).toBe('distributed-value');
      
      // Set in distributed cache via the wrapper
      await distributedCache.setAsync('both-key', 'both-value');
      
      // Should be in both caches
      expect(localCache.get('both-key')).toBe('both-value');
      expect(await provider.get('test:both-key')).toBe('both-value');
    });
  });
}); 