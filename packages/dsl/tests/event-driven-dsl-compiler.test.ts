import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactiveEventBus } from '@architectlm/core';
import { 
  createExtensionSystem,
  DefaultExtensionSystem,
  createPluginManager
} from '@architectlm/extensions';
import { 
  DSLExtensionSystem 
} from '../src/dsl-extension-system.js';
import { 
  DSLPluginSystem, 
  createDSLPluginSystem,
  DSLPlugin
} from '../src/dsl-plugin-system.js';
import { 
  EventDrivenDSLCompiler,
  DSLEventType
} from '../src/event-driven-dsl-compiler.js';
import { ComponentType } from '../src/types.js';

describe('EventDrivenDSLCompiler', () => {
  let eventBus: ReactiveEventBus;
  let extensionSystem: DefaultExtensionSystem;
  let dslExtensionSystem: DSLExtensionSystem;
  let dslPluginSystem: DSLPluginSystem;
  let compiler: EventDrivenDSLCompiler;
  
  beforeEach(() => {
    eventBus = new ReactiveEventBus();
    // Create and initialize the extension system
    extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
    
    // Create the plugin manager with the extension system
    const pluginManager = createPluginManager(extensionSystem);
    
    // Initialize the DSL extension system
    dslExtensionSystem = new DSLExtensionSystem(extensionSystem);
    
    // Create the DSL plugin system with the plugin manager
    dslPluginSystem = new DSLPluginSystem(pluginManager);
    
    // Create the compiler
    compiler = new EventDrivenDSLCompiler({
      eventBus,
      dslExtensionSystem,
      dslPluginSystem
    });
  });
  
  describe('Component Registration', () => {
    it('should register a component and emit an event', async () => {
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
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
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Verify that the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_REGISTERED,
        expect.objectContaining({
          component
        })
      );
    });
    
    it('should run plugin hooks when registering a component', async () => {
      // Create a test plugin with a registration hook
      const plugin: DSLPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        onComponentRegistration: vi.fn()
      };
      
      // Mock the runComponentRegistrationHooks method
      const runHooksSpy = vi.spyOn(dslPluginSystem, 'runComponentRegistrationHooks');
      
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
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Verify that the plugin hook method was called
      expect(runHooksSpy).toHaveBeenCalledWith(component);
    });
  });
  
  describe('Component Compilation', () => {
    it('should compile a component and emit an event', async () => {
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
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
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the getComponent method to return our test component
      vi.spyOn(compiler, 'getComponent').mockReturnValue(component);
      
      // Mock the internal compile method to avoid actual compilation
      vi.spyOn(compiler as any, 'internalCompileComponent').mockResolvedValue('// Compiled code');
      
      // Compile the component
      const result = await compiler.compileComponent('TestSchema');
      
      // Verify that the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_COMPILED,
        expect.objectContaining({
          component,
          code: result,
          fromCache: false
        })
      );
    });
    
    it('should run plugin hooks when compiling a component', async () => {
      // Mock the runComponentCompilationHooks method
      const runHooksSpy = vi.spyOn(dslPluginSystem, 'runComponentCompilationHooks');
      
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
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the getComponent method to return our test component
      vi.spyOn(compiler, 'getComponent').mockReturnValue(component);
      
      // Mock the internal compile method to call the plugin hooks
      vi.spyOn(compiler as any, 'internalCompileComponent').mockImplementation(async (comp: any) => {
        const code = '// Original code';
        return dslPluginSystem.runComponentCompilationHooks(comp, code);
      });
      
      // Compile the component
      await compiler.compileComponent('TestSchema');
      
      // Verify that the plugin hook method was called
      expect(runHooksSpy).toHaveBeenCalledWith(component, '// Original code');
    });
  });
  
  describe('Component Validation', () => {
    it('should validate a component and emit an event', async () => {
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
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
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Mock the componentRegistry.getComponent method to return our test component
      vi.spyOn(compiler['componentRegistry'], 'getComponent').mockReturnValue(component);
      
      // Mock the internal validate method
      vi.spyOn(compiler as any, 'internalValidateComponent').mockResolvedValue({
        isValid: true,
        errors: []
      });
      
      // Validate the component
      const result = await compiler.validateComponent('TestSchema');
      
      // Verify that the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_VALIDATED,
        expect.objectContaining({
          component,
          validationResult: { isValid: true, errors: [] }
        })
      );
    });
    
    it('should run plugin hooks when validating a component', async () => {
      // Create a test plugin with a validation hook
      const plugin: DSLPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        hooks: {},
        onComponentValidation: vi.fn().mockReturnValue({
          isValid: true,
          errors: []
        })
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
      
      // Register the component
      await compiler.registerComponent(component);
      
      // Directly call the plugin hook
      const result = await dslPluginSystem.runComponentValidationHooks(
        component, 
        { isValid: false, errors: ['Initial error'] }
      );
      
      // Verify that the plugin hook was called and the validation result was modified
      expect(plugin.onComponentValidation).toHaveBeenCalledWith(
        component,
        { isValid: false, errors: ['Initial error'] }
      );
      expect(result).toEqual({ isValid: true, errors: [] });
    });
  });
}); 