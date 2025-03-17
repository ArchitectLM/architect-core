import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  DefaultExtensionSystem, 
  createExtensionSystem, 
  Plugin, 
  Extension, 
  ExtensionEvent 
} from '../src/extension-system.js';
import { 
  PluginManager, 
  createPluginManager, 
  PluginMetadata 
} from '../src/plugin-management.js';

describe('PluginManager', () => {
  let extensionSystem: DefaultExtensionSystem;
  let pluginManager: PluginManager;

  beforeEach(() => {
    // Create and configure the extension system
    extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'test.point',
      description: 'Test extension point',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'another.point',
      description: 'Another test extension point',
      handlers: []
    });
    
    // Create the plugin manager
    pluginManager = createPluginManager(extensionSystem);
  });

  describe('GIVEN a plugin manager', () => {
    it('SHOULD register a plugin with metadata', () => {
      // Create a test plugin
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {
          'test.point': (context) => context
        }
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin, {
        version: '1.0.0',
        author: 'Test Author'
      });
      
      // THEN the plugin should be registered
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
      
      // AND the plugin should be enabled by default
      expect(pluginManager.isPluginEnabled('test-plugin')).toBe(true);
      
      // AND the plugin should be retrievable
      const plugin = pluginManager.getPlugin('test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('test-plugin');
      expect(plugin?.version).toBe('1.0.0');
      expect(plugin?.author).toBe('Test Author');
      expect(plugin?.description).toBe('A test plugin');
    });
    
    it('SHOULD register the plugin with the extension system', async () => {
      // Create a mock hook handler
      const mockHandler = vi.fn().mockImplementation(context => context);
      
      // Create a test plugin
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {
          'test.point': mockHandler
        }
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin);
      
      // Trigger the extension point
      const context = { data: 'test' };
      await extensionSystem.triggerExtensionPoint('test.point', context);
      
      // THEN the hook handler should be called
      expect(mockHandler).toHaveBeenCalledWith(context);
    });
    
    it('SHOULD register event interceptors from the plugin', () => {
      // Create mock interceptor functions
      const beforeFn = vi.fn().mockImplementation(event => event);
      const afterFn = vi.fn().mockImplementation(event => event);
      
      // Create a test plugin with event interceptors
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {},
        eventInterceptors: [
          {
            before: beforeFn,
            after: afterFn
          }
        ]
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin);
      
      // Create a test event
      const testEvent: ExtensionEvent = {
        type: 'test.point',
        context: { data: 'test' },
        timestamp: Date.now()
      };
      
      // Process the event through interceptors
      extensionSystem.processEventThroughInterceptors(testEvent);
      
      // THEN the interceptor functions should be called
      expect(beforeFn).toHaveBeenCalledWith(testEvent);
      expect(afterFn).toHaveBeenCalled();
    });
    
    it('SHOULD call the plugin setup function', () => {
      // Create a mock setup function
      const setupFn = vi.fn();
      
      // Create a test plugin with a setup function
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {},
        setup: setupFn
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin);
      
      // THEN the setup function should be called with the extension system
      expect(setupFn).toHaveBeenCalledWith(extensionSystem);
    });
  });

  describe('GIVEN plugins with dependencies', () => {
    it('SHOULD register plugins with dependencies', () => {
      // Create a base plugin
      const basePlugin: Plugin = {
        name: 'base-plugin',
        description: 'A base plugin',
        hooks: {}
      };
      
      // Create a dependent plugin
      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        description: 'A dependent plugin',
        hooks: {}
      };
      
      // Register the base plugin
      pluginManager.registerPlugin(basePlugin, {
        version: '1.0.0'
      });
      
      // Register the dependent plugin with a dependency on the base plugin
      pluginManager.registerPlugin(dependentPlugin, {
        version: '1.0.0',
        dependencies: {
          'base-plugin': '1.0.0'
        }
      });
      
      // THEN both plugins should be registered
      expect(pluginManager.hasPlugin('base-plugin')).toBe(true);
      expect(pluginManager.hasPlugin('dependent-plugin')).toBe(true);
      
      // AND the dependent plugin should have the base plugin as a dependency
      const dependencies = pluginManager.getPluginDependencies('dependent-plugin');
      expect(dependencies).toContain('base-plugin');
    });
    
    it('SHOULD throw an error when registering a plugin with unsatisfied dependencies', () => {
      // Create a plugin with a dependency that doesn't exist
      const plugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {}
      };
      
      // THEN registering the plugin should throw an error
      expect(() => {
        pluginManager.registerPlugin(plugin, {
          dependencies: {
            'non-existent-plugin': '1.0.0'
          }
        });
      }).toThrow(/unsatisfied dependencies/);
    });
    
    it('SHOULD throw an error when disabling a plugin that others depend on', () => {
      // Create a base plugin
      const basePlugin: Plugin = {
        name: 'base-plugin',
        description: 'A base plugin',
        hooks: {}
      };
      
      // Create a dependent plugin
      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        description: 'A dependent plugin',
        hooks: {}
      };
      
      // Register the plugins
      pluginManager.registerPlugin(basePlugin);
      pluginManager.registerPlugin(dependentPlugin, {
        dependencies: {
          'base-plugin': '1.0.0'
        }
      });
      
      // THEN disabling the base plugin should throw an error
      expect(() => {
        pluginManager.disablePlugin('base-plugin');
      }).toThrow(/depends on it/);
    });
  });

  describe('GIVEN plugin lifecycle management', () => {
    it('SHOULD enable and disable plugins', () => {
      // Create a test plugin
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {}
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin);
      
      // THEN the plugin should be enabled by default
      expect(pluginManager.isPluginEnabled('test-plugin')).toBe(true);
      
      // Disable the plugin
      const disableResult = pluginManager.disablePlugin('test-plugin');
      
      // THEN the plugin should be disabled
      expect(disableResult).toBe(true);
      expect(pluginManager.isPluginEnabled('test-plugin')).toBe(false);
      
      // Enable the plugin
      const enableResult = pluginManager.enablePlugin('test-plugin');
      
      // THEN the plugin should be enabled again
      expect(enableResult).toBe(true);
      expect(pluginManager.isPluginEnabled('test-plugin')).toBe(true);
    });
    
    it('SHOULD unregister plugins', () => {
      // Create a test plugin
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {}
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin);
      
      // THEN the plugin should be registered
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
      
      // Unregister the plugin
      const unregisterResult = pluginManager.unregisterPlugin('test-plugin');
      
      // THEN the plugin should be unregistered
      expect(unregisterResult).toBe(true);
      expect(pluginManager.hasPlugin('test-plugin')).toBe(false);
    });
    
    it('SHOULD throw an error when unregistering a plugin that others depend on', () => {
      // Create a base plugin
      const basePlugin: Plugin = {
        name: 'base-plugin',
        description: 'A base plugin',
        hooks: {}
      };
      
      // Create a dependent plugin
      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        description: 'A dependent plugin',
        hooks: {}
      };
      
      // Register the plugins
      pluginManager.registerPlugin(basePlugin);
      pluginManager.registerPlugin(dependentPlugin, {
        dependencies: {
          'base-plugin': '1.0.0'
        }
      });
      
      // THEN unregistering the base plugin should throw an error
      expect(() => {
        pluginManager.unregisterPlugin('base-plugin');
      }).toThrow(/depends on it/);
    });
  });

  describe('GIVEN plugin utility functions', () => {
    it('SHOULD create a plugin from an extension', () => {
      // Create a simple extension
      const extension: Extension = {
        name: 'test-extension',
        description: 'A test extension',
        hooks: {
          'test.point': (context) => context
        }
      };
      
      // Create a plugin from the extension
      const plugin = pluginManager.createPluginFromExtension(extension, {
        version: '1.0.0',
        author: 'Test Author'
      });
      
      // THEN a plugin should be created and registered
      expect(pluginManager.hasPlugin('test-extension')).toBe(true);
      expect(plugin.name).toBe('test-extension');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.author).toBe('Test Author');
      expect(plugin.eventInterceptors).toEqual([]);
    });
    
    it('SHOULD add an event interceptor to a plugin', () => {
      // Create a test plugin
      const testPlugin: Plugin = {
        name: 'test-plugin',
        description: 'A test plugin',
        hooks: {}
      };
      
      // Register the plugin
      pluginManager.registerPlugin(testPlugin);
      
      // Create a mock interceptor function
      const interceptorFn = vi.fn().mockImplementation(event => event);
      
      // Add the interceptor to the plugin
      const addResult = pluginManager.addInterceptorToPlugin('test-plugin', interceptorFn);
      
      // THEN the interceptor should be added
      expect(addResult).toBe(true);
      
      // AND the plugin should have the interceptor
      const plugin = pluginManager.getPlugin('test-plugin');
      expect(plugin?.eventInterceptors).toContain(interceptorFn);
      
      // Create a test event
      const testEvent: ExtensionEvent = {
        type: 'test.point',
        context: { data: 'test' },
        timestamp: Date.now()
      };
      
      // Process the event through interceptors
      extensionSystem.processEventThroughInterceptors(testEvent);
      
      // THEN the interceptor function should be called
      expect(interceptorFn).toHaveBeenCalledWith(testEvent);
    });
  });
}); 