import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createPluginManager, 
  Plugin,
  createExtensionSystem
} from '@architectlm/extensions';
import { 
  DSLPluginSystem, 
  DSLPlugin 
} from '../src/dsl-plugin-system.js';
import { ComponentType } from '../src/types.js';

describe('DSLPluginSystem', () => {
  let extensionSystem: any;
  let pluginManager: any;
  let dslPluginSystem: DSLPluginSystem;
  
  beforeEach(() => {
    extensionSystem = createExtensionSystem();
    pluginManager = createPluginManager(extensionSystem);
    dslPluginSystem = new DSLPluginSystem(pluginManager);
  });
  
  describe('Plugin Registration', () => {
    it('should register a DSL plugin', () => {
      // Spy on the plugin manager
      const registerPluginSpy = vi.spyOn(pluginManager, 'registerPlugin');
      
      // Create a test plugin
      const plugin: DSLPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        eventInterceptors: []
      };
      
      // Register the plugin
      dslPluginSystem.registerPlugin(plugin);
      
      // Verify that the plugin was registered
      expect(registerPluginSpy).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({
          version: '1.0.0',
          description: 'A test plugin'
        })
      );
    });
  });
  
  describe('Plugin Filtering', () => {
    beforeEach(() => {
      // Create test plugins
      const schemaPlugin: DSLPlugin = {
        name: 'schema-plugin',
        version: '1.0.0',
        description: 'A schema plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        eventInterceptors: []
      };
      
      const commandPlugin: DSLPlugin = {
        name: 'command-plugin',
        version: '1.0.0',
        description: 'A command plugin',
        supportedComponentTypes: [ComponentType.COMMAND],
        hooks: {},
        eventInterceptors: []
      };
      
      const multiPlugin: DSLPlugin = {
        name: 'multi-plugin',
        version: '1.0.0',
        description: 'A multi-component plugin',
        supportedComponentTypes: [ComponentType.SCHEMA, ComponentType.COMMAND],
        hooks: {},
        eventInterceptors: []
      };
      
      // Register the plugins
      dslPluginSystem.registerPlugin(schemaPlugin);
      dslPluginSystem.registerPlugin(commandPlugin);
      dslPluginSystem.registerPlugin(multiPlugin);
      
      // Directly add the plugins to the plugin manager's internal map for testing
      (pluginManager as any).plugins.set('schema-plugin', schemaPlugin);
      (pluginManager as any).plugins.set('command-plugin', commandPlugin);
      (pluginManager as any).plugins.set('multi-plugin', multiPlugin);
    });
    
    it('should get plugins for a specific component type', () => {
      // Create test plugins
      const schemaPlugin: DSLPlugin = {
        name: 'schema-plugin',
        version: '1.0.0',
        description: 'A schema plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        eventInterceptors: []
      };
      
      const commandPlugin: DSLPlugin = {
        name: 'command-plugin',
        version: '1.0.0',
        description: 'A command plugin',
        supportedComponentTypes: [ComponentType.COMMAND],
        hooks: {},
        eventInterceptors: []
      };
      
      const multiPlugin: DSLPlugin = {
        name: 'multi-plugin',
        version: '1.0.0',
        description: 'A multi-component plugin',
        supportedComponentTypes: [ComponentType.SCHEMA, ComponentType.COMMAND],
        hooks: {},
        eventInterceptors: []
      };
      
      // Mock the getAllPlugins method to return our test plugins
      vi.spyOn(dslPluginSystem, 'getAllPlugins').mockReturnValue([
        schemaPlugin,
        commandPlugin,
        multiPlugin
      ]);
      
      // Get plugins for schema components
      const schemaPlugins = dslPluginSystem.getPluginsForComponentType(ComponentType.SCHEMA);
      
      // Verify that the correct plugins were returned
      expect(schemaPlugins.length).toBe(2);
      expect(schemaPlugins.map(p => p.name)).toContain('schema-plugin');
      expect(schemaPlugins.map(p => p.name)).toContain('multi-plugin');
      
      // Get plugins for command components
      const commandPlugins = dslPluginSystem.getPluginsForComponentType(ComponentType.COMMAND);
      
      // Verify that the correct plugins were returned
      expect(commandPlugins.length).toBe(2);
      expect(commandPlugins.map(p => p.name)).toContain('command-plugin');
      expect(commandPlugins.map(p => p.name)).toContain('multi-plugin');
      
      // Get plugins for event components
      const eventPlugins = dslPluginSystem.getPluginsForComponentType(ComponentType.EVENT);
      
      // Verify that no plugins were returned
      expect(eventPlugins.length).toBe(0);
    });
  });
  
  describe('Plugin Hooks', () => {
    it('should run plugin hooks for a component', async () => {
      // Create a test plugin with hooks
      const plugin: DSLPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        eventInterceptors: [],
        onComponentRegistration: vi.fn(),
        onComponentCompilation: vi.fn().mockReturnValue('// Modified code'),
        onComponentValidation: vi.fn().mockReturnValue({ isValid: true, errors: [] })
      };
      
      // Register the plugin
      dslPluginSystem.registerPlugin(plugin);
      
      // Create a test component
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
      
      // Run the component registration hook
      await dslPluginSystem.runComponentRegistrationHooks(component);
      
      // Verify that the hook was called
      expect(plugin.onComponentRegistration).toHaveBeenCalledWith(component);
      
      // Run the component compilation hook
      const code = 'function test() {}';
      const modifiedCode = await dslPluginSystem.runComponentCompilationHooks(component, code);
      
      // Verify that the hook was called and the code was modified
      expect(plugin.onComponentCompilation).toHaveBeenCalledWith(component, code);
      expect(modifiedCode).toBe('// Modified code');
      
      // Run the component validation hook
      const validationResult = await dslPluginSystem.runComponentValidationHooks(component, { isValid: false, errors: ['Error'] });
      
      // Verify that the hook was called and the validation result was modified
      expect(plugin.onComponentValidation).toHaveBeenCalledWith(component, { isValid: false, errors: ['Error'] });
      expect(validationResult).toEqual({ isValid: true, errors: [] });
    });
    
    it('should not run hooks for plugins that do not support the component type', async () => {
      // Create a test plugin with hooks
      const plugin: DSLPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        eventInterceptors: [],
        onComponentRegistration: vi.fn(),
        onComponentCompilation: vi.fn(),
        onComponentValidation: vi.fn()
      };
      
      // Register the plugin
      dslPluginSystem.registerPlugin(plugin);
      
      // Create a test component
      const component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand',
        description: 'A test command',
        input: { ref: 'TestInput' },
        output: { ref: 'TestOutput' },
        definition: {}
      };
      
      // Run the component registration hook
      await dslPluginSystem.runComponentRegistrationHooks(component);
      
      // Verify that the hook was not called
      expect(plugin.onComponentRegistration).not.toHaveBeenCalled();
      
      // Run the component compilation hook
      const code = 'function test() {}';
      await dslPluginSystem.runComponentCompilationHooks(component, code);
      
      // Verify that the hook was not called
      expect(plugin.onComponentCompilation).not.toHaveBeenCalled();
      
      // Run the component validation hook
      await dslPluginSystem.runComponentValidationHooks(component, { isValid: true, errors: [] });
      
      // Verify that the hook was not called
      expect(plugin.onComponentValidation).not.toHaveBeenCalled();
    });
  });
}); 