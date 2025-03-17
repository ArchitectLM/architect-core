import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactiveEventBus } from '@architectlm/core';
import { 
  createExtensionSystem, 
  ExtensionSystem 
} from '@architectlm/extensions';
import { 
  DSLExtensionSystem 
} from '../src/dsl-extension-system.js';
import { 
  DSLPluginSystem, 
  createDSLPluginSystem 
} from '../src/dsl-plugin-system.js';
import { 
  EventDrivenDSLCompiler 
} from '../src/event-driven-dsl-compiler.js';
import { ComponentType } from '../src/types.js';

describe('EventDrivenDSLCompiler', () => {
  let eventBus: ReactiveEventBus;
  let extensionSystem: ExtensionSystem;
  let dslExtensionSystem: DSLExtensionSystem;
  let dslPluginSystem: DSLPluginSystem;
  let compiler: EventDrivenDSLCompiler;
  
  beforeEach(() => {
    eventBus = new ReactiveEventBus();
    extensionSystem = createExtensionSystem();
    dslExtensionSystem = new DSLExtensionSystem(extensionSystem);
    dslPluginSystem = createDSLPluginSystem();
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
        expect.objectContaining({
          type: 'DSL_COMPONENT_REGISTERED',
          payload: expect.objectContaining({
            component
          })
        })
      );
    });
    
    it('should run plugin hooks when registering a component', async () => {
      // Create a test plugin with a registration hook
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        extensions: [],
        interceptors: [],
        onComponentRegistration: vi.fn()
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
      
      // Verify that the plugin hook was called
      expect(plugin.onComponentRegistration).toHaveBeenCalledWith(component);
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
      
      // Compile the component
      const result = await compiler.compileComponent('TestSchema');
      
      // Verify that the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DSL_COMPONENT_COMPILED',
          payload: expect.objectContaining({
            name: 'TestSchema',
            result
          })
        })
      );
    });
    
    it('should run plugin hooks when compiling a component', async () => {
      // Create a test plugin with a compilation hook
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        extensions: [],
        interceptors: [],
        onComponentCompilation: vi.fn().mockReturnValue('// Modified code')
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
      
      // Mock the internal compile method
      vi.spyOn(compiler as any, 'internalCompileComponent').mockResolvedValue('// Original code');
      
      // Compile the component
      const result = await compiler.compileComponent('TestSchema');
      
      // Verify that the plugin hook was called and the code was modified
      expect(plugin.onComponentCompilation).toHaveBeenCalledWith(
        component,
        '// Original code'
      );
      expect(result).toBe('// Modified code');
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
      
      // Mock the internal validate method
      vi.spyOn(compiler as any, 'internalValidateComponent').mockResolvedValue({
        isValid: true,
        errors: []
      });
      
      // Validate the component
      const result = await compiler.validateComponent('TestSchema');
      
      // Verify that the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DSL_COMPONENT_VALIDATED',
          payload: expect.objectContaining({
            name: 'TestSchema',
            result
          })
        })
      );
    });
    
    it('should run plugin hooks when validating a component', async () => {
      // Create a test plugin with a validation hook
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        supportedComponentTypes: [ComponentType.SCHEMA],
        extensions: [],
        interceptors: [],
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
      
      // Mock the internal validate method
      vi.spyOn(compiler as any, 'internalValidateComponent').mockResolvedValue({
        isValid: false,
        errors: ['Error']
      });
      
      // Validate the component
      const result = await compiler.validateComponent('TestSchema');
      
      // Verify that the plugin hook was called and the validation result was modified
      expect(plugin.onComponentValidation).toHaveBeenCalledWith(
        component,
        { isValid: false, errors: ['Error'] }
      );
      expect(result).toEqual({ isValid: true, errors: [] });
    });
  });
}); 