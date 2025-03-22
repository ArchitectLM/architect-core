import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimplePluginRegistry } from '../src/implementations/plugin-registry';
import { Plugin, PluginState } from '../src/models/plugin-system';

describe('SimplePluginRegistry', () => {
  let pluginRegistry: SimplePluginRegistry;
  
  beforeEach(() => {
    pluginRegistry = new SimplePluginRegistry();
  });
  
  describe('Plugin Registration', () => {
    it('should register a valid plugin', () => {
      // Create a mock plugin
      const mockPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      
      // Register the plugin
      const result = pluginRegistry.registerPlugin(mockPlugin);
      
      expect(result.success).toBe(true);
      expect(pluginRegistry.hasPlugin('test-plugin')).toBe(true);
    });
    
    it('should reject a plugin without an ID', () => {
      // Create a mock plugin with no ID
      const mockPlugin = createMockPlugin('', 'No ID Plugin');
      
      // Try to register the plugin
      const result = pluginRegistry.registerPlugin(mockPlugin);
      
      expect(result.success).toBe(false);
      if (!result.success) {
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
      if (!result.success) {
        expect(result.error.message).toContain('already registered');
      }
    });
  });
  
  describe('Plugin Retrieval', () => {
    let testPlugin: Plugin;
    
    beforeEach(() => {
      // Register a test plugin
      testPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      pluginRegistry.registerPlugin(testPlugin);
    });
    
    it('should retrieve a plugin by ID', () => {
      const result = pluginRegistry.getPlugin('test-plugin');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.getState().id).toBe('test-plugin');
      }
    });
    
    it('should indicate if a plugin exists', () => {
      expect(pluginRegistry.hasPlugin('test-plugin')).toBe(true);
      expect(pluginRegistry.hasPlugin('non-existent')).toBe(false);
    });
    
    it('should return all registered plugins', () => {
      // Register another plugin
      const anotherPlugin = createMockPlugin('another-plugin', 'Another Plugin');
      pluginRegistry.registerPlugin(anotherPlugin);
      
      const allPlugins = pluginRegistry.getAllPlugins();
      
      expect(allPlugins).toHaveLength(2);
      expect(allPlugins.some(p => p.getState().id === 'test-plugin')).toBe(true);
      expect(allPlugins.some(p => p.getState().id === 'another-plugin')).toBe(true);
    });
    
    it('should return an error for non-existent plugin ID', () => {
      const result = pluginRegistry.getPlugin('non-existent');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
  
  describe('Plugin Unregistration', () => {
    beforeEach(() => {
      // Register a test plugin
      const testPlugin = createMockPlugin('test-plugin', 'Test Plugin');
      pluginRegistry.registerPlugin(testPlugin);
    });
    
    it('should unregister a plugin', () => {
      const result = pluginRegistry.unregisterPlugin('test-plugin');
      
      expect(result.success).toBe(true);
      expect(pluginRegistry.hasPlugin('test-plugin')).toBe(false);
    });
    
    it('should return an error for unregistering non-existent plugin', () => {
      const result = pluginRegistry.unregisterPlugin('non-existent');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
  
  describe('Plugin Categories and Capabilities', () => {
    beforeEach(() => {
      // Register plugins with different categories and capabilities
      const plugin1 = createMockPlugin('plugin1', 'Plugin 1', 'category1', ['capability1', 'capability2']);
      const plugin2 = createMockPlugin('plugin2', 'Plugin 2', 'category1', ['capability2']);
      const plugin3 = createMockPlugin('plugin3', 'Plugin 3', 'category2', ['capability1']);
      
      pluginRegistry.registerPlugin(plugin1);
      pluginRegistry.registerPlugin(plugin2);
      pluginRegistry.registerPlugin(plugin3);
    });
    
    it('should retrieve plugins by category', () => {
      const category1Plugins = pluginRegistry.getPluginsByCategory('category1');
      const category2Plugins = pluginRegistry.getPluginsByCategory('category2');
      
      expect(category1Plugins).toHaveLength(2);
      expect(category1Plugins.some(p => p.getState().id === 'plugin1')).toBe(true);
      expect(category1Plugins.some(p => p.getState().id === 'plugin2')).toBe(true);
      
      expect(category2Plugins).toHaveLength(1);
      expect(category2Plugins[0].getState().id).toBe('plugin3');
    });
    
    it('should retrieve plugins by capability', () => {
      const capability1Plugins = pluginRegistry.getPluginsWithCapability('capability1');
      const capability2Plugins = pluginRegistry.getPluginsWithCapability('capability2');
      
      expect(capability1Plugins).toHaveLength(2);
      expect(capability1Plugins.some(p => p.getState().id === 'plugin1')).toBe(true);
      expect(capability1Plugins.some(p => p.getState().id === 'plugin3')).toBe(true);
      
      expect(capability2Plugins).toHaveLength(2);
      expect(capability2Plugins.some(p => p.getState().id === 'plugin1')).toBe(true);
      expect(capability2Plugins.some(p => p.getState().id === 'plugin2')).toBe(true);
    });
    
    it('should return empty array for non-existent category', () => {
      const nonExistentCategoryPlugins = pluginRegistry.getPluginsByCategory('non-existent');
      expect(nonExistentCategoryPlugins).toHaveLength(0);
    });
    
    it('should return empty array for non-existent capability', () => {
      const nonExistentCapabilityPlugins = pluginRegistry.getPluginsWithCapability('non-existent');
      expect(nonExistentCapabilityPlugins).toHaveLength(0);
    });
  });
});

// Helper function to create a mock plugin
function createMockPlugin(
  id: string, 
  name: string, 
  category: string = 'test', 
  capabilities: string[] = []
): Plugin {
  const state: PluginState = {
    id,
    status: { enabled: true },
    config: {},
    data: { category }
  };
  
  const capabilities_map = new Map();
  capabilities.forEach(cap => {
    capabilities_map.set(cap, { id: cap, name: cap, implementation: {} });
  });
  
  return {
    name,
    id,
    description: `Description for ${name}`,
    dependencies: [],
    
    lifecycle: {
      initialize: vi.fn().mockResolvedValue({ success: true, value: undefined }),
      start: vi.fn().mockResolvedValue({ success: true, value: undefined }),
      stop: vi.fn().mockResolvedValue({ success: true, value: undefined }),
      cleanup: vi.fn().mockResolvedValue({ success: true, value: undefined })
    },
    
    getState: vi.fn().mockReturnValue(state),
    setState: vi.fn().mockReturnValue({ success: true, value: undefined }),
    
    getCapability: vi.fn().mockImplementation((capabilityId) => {
      if (capabilities_map.has(capabilityId)) {
        return { success: true, value: capabilities_map.get(capabilityId) };
      }
      return { success: false, error: new Error(`Capability ${capabilityId} not found`) };
    }),
    
    hasCapability: vi.fn().mockImplementation((capabilityId) => capabilities.includes(capabilityId)),
    
    registerHook: vi.fn().mockReturnValue({ success: true, value: undefined }),
    
    healthCheck: vi.fn().mockReturnValue({ 
      success: true, 
      value: { status: 'healthy', details: {} } 
    })
  } as unknown as Plugin;
} 