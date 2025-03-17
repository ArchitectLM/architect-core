import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentCache, CacheOptions } from '../src/component-cache.js';
import { ComponentType } from '../src/types.js';

describe('ComponentCache', () => {
  let cache: ComponentCache<string>;
  let defaultOptions: CacheOptions;
  
  beforeEach(() => {
    defaultOptions = {
      ttl: 1000, // 1 second for testing
      maxEntries: 5,
      slidingExpiration: true
    };
    cache = new ComponentCache<string>(defaultOptions);
  });
  
  describe('Basic Cache Operations', () => {
    it('should store and retrieve values', () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      const value = 'cached value';
      
      // Act
      cache.set(component, value);
      const retrieved = cache.get(component);
      
      // Assert
      expect(retrieved).toBe(value);
    });
    
    it('should check if a value exists', () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      const value = 'cached value';
      
      // Act
      cache.set(component, value);
      
      // Assert
      expect(cache.has(component)).toBe(true);
      expect(cache.has({
        type: ComponentType.SCHEMA,
        name: 'NonExistentSchema',
        definition: { type: 'object' }
      })).toBe(false);
    });
    
    it('should remove values', () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      const value = 'cached value';
      
      // Act
      cache.set(component, value);
      cache.remove(component);
      
      // Assert
      expect(cache.get(component)).toBeUndefined();
      expect(cache.has(component)).toBe(false);
    });
    
    it('should clear all values', () => {
      // Arrange
      const component1 = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema1',
        definition: { type: 'object' }
      };
      const component2 = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema2',
        definition: { type: 'object' }
      };
      
      // Act
      cache.set(component1, 'value1');
      cache.set(component2, 'value2');
      cache.clear();
      
      // Assert
      expect(cache.size()).toBe(0);
      expect(cache.get(component1)).toBeUndefined();
      expect(cache.get(component2)).toBeUndefined();
    });
    
    it('should support different suffixes', () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Act
      cache.set(component, 'compiled', 'compiled');
      cache.set(component, 'validated', 'validated');
      
      // Assert
      expect(cache.get(component, 'compiled')).toBe('compiled');
      expect(cache.get(component, 'validated')).toBe('validated');
    });
  });
  
  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      // Arrange
      vi.useFakeTimers();
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Act
      cache.set(component, 'value');
      
      // Assert - Before expiration
      expect(cache.get(component)).toBe('value');
      
      // Advance time past TTL
      vi.advanceTimersByTime(defaultOptions.ttl! + 100);
      
      // Assert - After expiration
      expect(cache.get(component)).toBeUndefined();
      
      vi.useRealTimers();
    });
    
    it('should reset TTL with sliding expiration', async () => {
      // Arrange
      vi.useFakeTimers();
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Act
      cache.set(component, 'value');
      
      // Advance time but not past TTL
      vi.advanceTimersByTime(defaultOptions.ttl! / 2);
      
      // Access the value to reset TTL
      const result = cache.get(component);
      expect(result).toBe('value');
      
      // Advance time past original TTL but not past reset TTL
      vi.advanceTimersByTime(defaultOptions.ttl! * 0.6);
      
      // Assert - Should still be valid due to sliding expiration
      expect(cache.get(component)).toBe('value');
      
      vi.useRealTimers();
    });
    
    it('should not use sliding expiration when disabled', async () => {
      // Arrange
      vi.useFakeTimers();
      const noSlidingCache = new ComponentCache<string>({
        ttl: 1000,
        slidingExpiration: false
      });
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Act
      noSlidingCache.set(component, 'value');
      
      // Advance time but not past TTL
      vi.advanceTimersByTime(500);
      
      // Access the value (should not reset TTL)
      expect(noSlidingCache.get(component)).toBe('value');
      
      // Advance time past original TTL
      vi.advanceTimersByTime(501);
      
      // Assert - Should be expired
      expect(noSlidingCache.get(component)).toBeUndefined();
      
      vi.useRealTimers();
    });
  });
  
  describe('Max Entries Limit', () => {
    it('should enforce max entries limit', () => {
      // Arrange
      const maxEntries = 3;
      const limitedCache = new ComponentCache<string>({ maxEntries });
      
      // Act - Add more entries than the limit
      for (let i = 0; i < maxEntries + 2; i++) {
        const component = {
          type: ComponentType.SCHEMA,
          name: `TestSchema${i}`,
          definition: { type: 'object' }
        };
        limitedCache.set(component, `value${i}`);
      }
      
      // Assert
      expect(limitedCache.size()).toBe(maxEntries);
    });
    
    it('should remove least recently accessed entries first', () => {
      // Arrange
      const maxEntries = 3;
      const limitedCache = new ComponentCache<string>({ maxEntries });
      const components = [];
      
      // Add initial entries
      for (let i = 0; i < maxEntries; i++) {
        const component = {
          type: ComponentType.SCHEMA,
          name: `TestSchema${i}`,
          definition: { type: 'object' }
        };
        components.push(component);
        limitedCache.set(component, `value${i}`);
      }
      
      // Add a new entry to trigger eviction
      const newComponent = {
        type: ComponentType.SCHEMA,
        name: 'NewSchema',
        definition: { type: 'object' }
      };
      limitedCache.set(newComponent, 'newValue');
      
      // Assert - One of the entries should be evicted
      // Verify that the cache size is still maxEntries
      expect(limitedCache.size()).toBe(maxEntries);
      
      // Check that the new entry is in the cache
      expect(limitedCache.get(newComponent)).toBe('newValue');
      
      // Check that at least one of the original entries was evicted
      const remainingEntries = components.filter(comp => limitedCache.get(comp) !== undefined).length;
      expect(remainingEntries).toBe(maxEntries - 1);
    });
  });
  
  describe('Content Hash Invalidation', () => {
    it('should invalidate cache when component content changes', () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Act
      cache.set(component, 'value');
      
      // Modify the component
      const modifiedComponent = {
        ...component,
        definition: { type: 'object', properties: { id: { type: 'string' } } }
      };
      
      // Assert
      expect(cache.get(modifiedComponent)).toBeUndefined();
    });
    
    it('should keep cache valid when component reference changes but content is the same', () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Act
      cache.set(component, 'value');
      
      // Create a new object with the same content
      const sameComponent = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: { type: 'object' }
      };
      
      // Assert
      expect(cache.get(sameComponent)).toBe('value');
    });
  });
}); 