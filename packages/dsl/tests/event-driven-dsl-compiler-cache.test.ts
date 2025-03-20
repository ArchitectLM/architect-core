import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactiveEventBus } from '@architectlm/core';
import { createExtensionSystem, createPluginManager } from '@architectlm/extensions';
import { DSLExtensionSystem } from '../src/dsl-extension-system.js';
import { DSLPluginSystem } from '../src/dsl-plugin-system.js';
import { EventDrivenDSLCompiler, DSLEventType } from '../src/event-driven-dsl-compiler.js';
import { ComponentType } from '../src/types.js';

describe('EventDrivenDSLCompiler with Caching', () => {
  let eventBus: ReactiveEventBus;
  let extensionSystem: any;
  let dslExtensionSystem: DSLExtensionSystem;
  let dslPluginSystem: DSLPluginSystem;
  let compiler: EventDrivenDSLCompiler;
  
  beforeEach(() => {
    eventBus = new ReactiveEventBus();
    extensionSystem = createExtensionSystem();
    dslExtensionSystem = new DSLExtensionSystem(extensionSystem);
    
    // Create the plugin manager with the extension system
    const pluginManager = createPluginManager(extensionSystem);
    
    // Create the DSL plugin system with the plugin manager
    dslPluginSystem = new DSLPluginSystem(pluginManager);
    
    // Create compiler with caching enabled
    compiler = new EventDrivenDSLCompiler({
      eventBus,
      dslExtensionSystem,
      dslPluginSystem,
      cacheOptions: {
        enabled: true,
        ttl: 1000, // 1 second for testing
        maxEntries: 10,
        slidingExpiration: true
      }
    });
  });
  
  describe('Component Compilation Caching', () => {
    it('should cache compiled components', async () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Mock the internal compile method
      const internalCompileSpy = vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Act - First compilation (should call internal compile)
      const firstResult = await compiler.compileComponent('TestSchema');
      
      // Act - Second compilation (should use cache)
      const secondResult = await compiler.compileComponent('TestSchema');
      
      // Assert
      expect(firstResult).toBe('compiled code');
      expect(secondResult).toBe('compiled code');
      expect(internalCompileSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should emit events with fromCache flag', async () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Mock the internal compile method
      vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Act - First compilation
      await compiler.compileComponent('TestSchema');
      
      // Reset the spy to focus on the second compilation
      publishSpy.mockClear();
      
      // Act - Second compilation (should use cache)
      await compiler.compileComponent('TestSchema');
      
      // Assert - Check that the event was published with fromCache=true
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_COMPILED,
        expect.objectContaining({
          component,
          code: 'compiled code',
          fromCache: true
        })
      );
    });
    
    it('should invalidate cache when component is updated', async () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Mock the internal compile method
      const internalCompileSpy = vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Act - First compilation (should call internal compile)
      await compiler.compileComponent('TestSchema');
      
      // Update the component
      const updatedComponent = {
        ...component,
        description: 'Updated description'
      };
      
      // Mock the componentRegistry.getComponent method to return our updated component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(updatedComponent);
      
      // Update the component
      await compiler.updateComponent(updatedComponent);
      
      // Act - Second compilation (should call internal compile again)
      await compiler.compileComponent('TestSchema');
      
      // Assert
      expect(internalCompileSpy).toHaveBeenCalledTimes(2);
    });
    
    it('should manually invalidate cache', async () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Mock the internal compile method
      const internalCompileSpy = vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Act - First compilation (should call internal compile)
      await compiler.compileComponent('TestSchema');
      
      // Invalidate the cache
      compiler.invalidateCache('TestSchema');
      
      // Act - Second compilation (should call internal compile again)
      await compiler.compileComponent('TestSchema');
      
      // Assert
      expect(internalCompileSpy).toHaveBeenCalledTimes(2);
    });
    
    it('should clear the entire cache', async () => {
      // Arrange
      const schema1 = {
        type: ComponentType.SCHEMA,
        name: 'Schema1',
        description: 'Schema 1',
        definition: { type: 'object' }
      };
      
      const schema2 = {
        type: ComponentType.SCHEMA,
        name: 'Schema2',
        description: 'Schema 2',
        definition: { type: 'object' }
      };
      
      // Mock the internal compile method
      const internalCompileSpy = vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the components
      await compiler.registerComponent(schema1);
      await compiler.registerComponent(schema2);
      
      // Mock the componentRegistry.getComponent method to return our test components
      vi.spyOn(compiler['componentRegistry'], 'getComponent')
        .mockImplementation((name) => {
          if (name === 'Schema1') return schema1;
          if (name === 'Schema2') return schema2;
          return undefined;
        });
      
      // Act - Compile both components
      await compiler.compileComponent('Schema1');
      await compiler.compileComponent('Schema2');
      
      // Clear the cache
      compiler.clearCache();
      
      // Act - Compile both components again
      await compiler.compileComponent('Schema1');
      await compiler.compileComponent('Schema2');
      
      // Assert
      expect(internalCompileSpy).toHaveBeenCalledTimes(4);
    });
    
    it('should report cache statistics', async () => {
      // Arrange
      const schema1 = {
        type: ComponentType.SCHEMA,
        name: 'Schema1',
        description: 'Schema 1',
        definition: { type: 'object' }
      };
      
      const schema2 = {
        type: ComponentType.SCHEMA,
        name: 'Schema2',
        description: 'Schema 2',
        definition: { type: 'object' }
      };
      
      // Mock the internal compile method
      vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the components
      await compiler.registerComponent(schema1);
      await compiler.registerComponent(schema2);
      
      // Mock the componentRegistry.getComponent method to return our test components
      vi.spyOn(compiler['componentRegistry'], 'getComponent')
        .mockImplementation((name) => {
          if (name === 'Schema1') return schema1;
          if (name === 'Schema2') return schema2;
          return undefined;
        });
      
      // Act - Compile both components
      await compiler.compileComponent('Schema1');
      await compiler.compileComponent('Schema2');
      
      // Get cache stats
      const stats = compiler.getCacheStats();
      
      // Assert
      expect(stats.size).toBe(2);
      
      // Act - Compile both components again (should use cache)
      await compiler.compileComponent('Schema1');
      await compiler.compileComponent('Schema2');
      
      // Get updated cache stats
      const updatedStats = compiler.getCacheStats();
      
      // Assert - size should still be 2
      expect(updatedStats.size).toBe(2);
    });
  });
  
  describe('Cache Expiration', () => {
    it('should recompile after cache expiration', async () => {
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Mock the internal compile method
      const internalCompileSpy = vi.spyOn(compiler as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Act - First compilation (should call internal compile)
      await compiler.compileComponent('TestSchema');
      
      // Wait for cache to expire (TTL is 1000ms)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Act - Second compilation (should call internal compile again)
      await compiler.compileComponent('TestSchema');
      
      // Assert
      expect(internalCompileSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Disabled Caching', () => {
    it('should not use cache when disabled', async () => {
      // Create a compiler with caching disabled
      const compilerWithoutCache = new EventDrivenDSLCompiler({
        eventBus,
        dslExtensionSystem,
        dslPluginSystem,
        cacheOptions: {
          enabled: false
        }
      });
      
      // Arrange
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Mock the internal compile method
      const internalCompileSpy = vi.spyOn(compilerWithoutCache as any, 'internalCompileComponent')
        .mockResolvedValue('compiled code');
      
      // Register the component
      await compilerWithoutCache.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compilerWithoutCache['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Act - First compilation
      await compilerWithoutCache.compileComponent('TestSchema');
      
      // Act - Second compilation (should call internal compile again)
      await compilerWithoutCache.compileComponent('TestSchema');
      
      // Assert
      expect(internalCompileSpy).toHaveBeenCalledTimes(2);
    });
  });
}); 