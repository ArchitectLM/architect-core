import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryPluginRegistry } from '../src/implementations/plugin-registry';
import { Plugin, PluginState } from '../src/models/plugin-system';

describe('InMemoryPluginRegistry', () => {
  let pluginRegistry: InMemoryPluginRegistry;
  
  beforeEach(() => {
    pluginRegistry = new InMemoryPluginRegistry();
  });
  
  describe('Plugin Registration', () => {
    it('should register a valid plugin', () => {
      // Create a mock plugin
      const mockPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      
      // Register the plugin
      const result = pluginRegistry.registerPlugin(mockPlugin);
      
      expect(result.success).toBe(true);
      
      // Get plugin to check if it exists
      const getResult = pluginRegistry.getPlugin('test-plugin');
      expect(getResult.success).toBe(true);
    });
    
    it('should reject a plugin without an ID', () => {
      // Create a mock plugin with no ID
      const mockPlugin = createMockPlugin('', 'No ID Plugin');
      
      // Try to register the plugin
      const result = pluginRegistry.registerPlugin(mockPlugin);
      
      expect(result.success).toBe(false);
      if (!result.success && result.error) {
        expect(result.error.message).toContain('must have an ID');
      }
    });
    
    it('should reject a duplicate plugin ID', () => {
      // Create and register a mock plugin
      const mockPlugin1 = createMockPlugin('test-plugin', 'Test Plugin 1');
      pluginRegistry.registerPlugin(mockPlugin1);
      
      // Create a second plugin with the same ID
      const mockPlugin2 = createMockPlugin('test-plugin', 'Test Plugin 2');
      
      // Try to register the second plugin
      const result = pluginRegistry.registerPlugin(mockPlugin2);
      
      expect(result.success).toBe(false);
      if (!result.success && result.error) {
        expect(result.error.message).toContain('already exists');
      }
    });
  });
  
  describe('Plugin Retrieval', () => {
    it('should retrieve a plugin by ID', () => {
      // Create and register a mock plugin
      const mockPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      pluginRegistry.registerPlugin(mockPlugin);
      
      // Retrieve the plugin
      const result = pluginRegistry.getPlugin('test-plugin');
      
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value.id).toBe('test-plugin');
      }
    });
    
    it('should indicate if a plugin exists', () => {
      // Create and register a mock plugin
      const mockPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      pluginRegistry.registerPlugin(mockPlugin);
      
      // Check existing plugin
      const existingResult = pluginRegistry.getPlugin('test-plugin');
      expect(existingResult.success).toBe(true);
      
      // Check non-existent plugin
      const nonExistentResult = pluginRegistry.getPlugin('non-existent');
      expect(nonExistentResult.success).toBe(false);
    });
    
    it('should return all registered plugins', () => {
      // Create and register multiple plugins
      const mockPlugin1 = createMockPlugin('plugin-1', 'Plugin 1');
      const mockPlugin2 = createMockPlugin('plugin-2', 'Plugin 2');
      
      pluginRegistry.registerPlugin(mockPlugin1);
      pluginRegistry.registerPlugin(mockPlugin2);
      
      // Get all plugins
      const plugins = pluginRegistry.getAllPlugins();
      
      expect(plugins.length).toBe(2);
      expect(plugins.some(p => p.id === 'plugin-1')).toBe(true);
      expect(plugins.some(p => p.id === 'plugin-2')).toBe(true);
    });
    
    it('should return an error for non-existent plugin ID', () => {
      // Try to retrieve a non-existent plugin
      const result = pluginRegistry.getPlugin('non-existent');
      
      expect(result.success).toBe(false);
      if (!result.success && result.error) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
  
  describe('Plugin Unregistration', () => {
    it('should unregister a plugin', () => {
      // Create and register a mock plugin
      const mockPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      pluginRegistry.registerPlugin(mockPlugin);
      
      // Unregister the plugin
      const result = pluginRegistry.unregisterPlugin('test-plugin');
      
      expect(result.success).toBe(true);
      
      // Verify the plugin is no longer registered
      const getResult = pluginRegistry.getPlugin('test-plugin');
      expect(getResult.success).toBe(false);
    });
    
    it('should return an error for unregistering non-existent plugin', () => {
      // Try to unregister a non-existent plugin
      const result = pluginRegistry.unregisterPlugin('non-existent');
      
      expect(result.success).toBe(false);
      if (!result.success && result.error) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
  
  describe('Plugin Categories and Capabilities', () => {
    it('should retrieve plugins by capability', () => {
      // Create and register plugins with different capabilities
      const mockPlugin1 = createMockPlugin('plugin-1', 'Plugin 1', 'category-1', ['capability-1']);
      const mockPlugin2 = createMockPlugin('plugin-2', 'Plugin 2', 'category-1', ['capability-2']);
      const mockPlugin3 = createMockPlugin('plugin-3', 'Plugin 3', 'category-2', ['capability-1']);
      
      pluginRegistry.registerPlugin(mockPlugin1);
      pluginRegistry.registerPlugin(mockPlugin2);
      pluginRegistry.registerPlugin(mockPlugin3);
      
      // Get plugins with capability-1
      const plugins = pluginRegistry.getPluginsWithCapability('capability-1');
      
      expect(plugins.length).toBe(2);
      expect(plugins.some(p => p.id === 'plugin-1')).toBe(true);
      expect(plugins.some(p => p.id === 'plugin-3')).toBe(true);
    });
    
    it('should return empty array for non-existent capability', () => {
      // Create and register a plugin
      const mockPlugin = createMockPlugin('test-plugin', 'Test Plugin', 'category', ['capability-1']);
      pluginRegistry.registerPlugin(mockPlugin);
      
      // Look for non-existent capability
      const plugins = pluginRegistry.getPluginsWithCapability('non-existent');
      
      expect(plugins).toEqual([]);
    });
  });
});

/**
 * Helper function to create a mock plugin for testing
 */
function createMockPlugin(
  id: string, 
  name: string, 
  category: string = 'test', 
  capabilities: string[] = []
): Plugin {
  return {
    id,
    name,
    description: `Test plugin: ${name}`,
    dependencies: [],
    lifecycle: {
      initialize: vi.fn().mockResolvedValue({ success: true }),
      start: vi.fn().mockResolvedValue({ success: true }),
      stop: vi.fn().mockResolvedValue({ success: true }),
      cleanup: vi.fn().mockResolvedValue({ success: true })
    },
    getState: vi.fn().mockReturnValue({ id, category }),
    setState: vi.fn(),
    getCapability: vi.fn(),
    hasCapability: vi.fn().mockImplementation((capability) => capabilities.includes(capability)),
    registerHook: vi.fn(),
    healthCheck: vi.fn(),
    getHooks: vi.fn(),
    getVersion: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue(capabilities)
  };
} 