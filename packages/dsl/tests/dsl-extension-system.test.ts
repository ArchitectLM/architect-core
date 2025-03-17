import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createExtensionSystem, 
  Extension, 
  ExtensionPoint 
} from '@architectlm/extensions';
import { 
  DSLExtensionSystem, 
  DSL_EXTENSION_POINTS 
} from '../src/dsl-extension-system.js';
import { ComponentType } from '../src/types.js';

describe('DSLExtensionSystem', () => {
  let extensionSystem: any;
  let dslExtensionSystem: DSLExtensionSystem;
  
  beforeEach(() => {
    extensionSystem = createExtensionSystem();
    dslExtensionSystem = new DSLExtensionSystem(extensionSystem);
  });
  
  describe('Extension Points', () => {
    it('should register DSL extension points', () => {
      // Spy on the extension system
      const registerExtensionPointSpy = vi.spyOn(extensionSystem, 'registerExtensionPoint');
      
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Verify that all DSL extension points were registered
      expect(registerExtensionPointSpy).toHaveBeenCalledWith(
        {
          name: DSL_EXTENSION_POINTS.VALIDATE_COMPONENT,
          description: 'Validates a DSL component'
        }
      );
      
      expect(registerExtensionPointSpy).toHaveBeenCalledWith(
        {
          name: DSL_EXTENSION_POINTS.COMPILE_COMPONENT,
          description: 'Compiles a DSL component'
        }
      );
      
      expect(registerExtensionPointSpy).toHaveBeenCalledWith(
        {
          name: DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT,
          description: 'Transforms a DSL component'
        }
      );
    });
  });
  
  describe('Component Validation', () => {
    it('should trigger the component validation extension point', async () => {
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Spy on the extension system
      const triggerExtensionPointSpy = vi.spyOn(extensionSystem, 'triggerExtensionPoint');
      
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
      
      // Create a validation context
      const validationContext = {
        component,
        validationResult: {
          isValid: true,
          errors: []
        }
      };
      
      // Validate the component
      await dslExtensionSystem.validateComponent(component, validationContext);
      
      // Verify that the extension point was triggered
      expect(triggerExtensionPointSpy).toHaveBeenCalledWith(
        DSL_EXTENSION_POINTS.VALIDATE_COMPONENT,
        validationContext
      );
    });
    
    it('should allow extensions to modify the validation result', async () => {
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Create a validation extension
      const validationExtension: Extension = {
        name: 'test-validation-extension',
        description: 'A test validation extension',
        hooks: {
          [DSL_EXTENSION_POINTS.VALIDATE_COMPONENT]: (context: any) => {
            // Add a validation error
            context.validationResult.isValid = false;
            context.validationResult.errors.push('Test validation error');
            return context;
          }
        }
      };
      
      // Register the extension
      extensionSystem.registerExtension(validationExtension);
      
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
      
      // Create a validation context
      const validationContext = {
        component,
        validationResult: {
          isValid: true,
          errors: []
        }
      };
      
      // Validate the component
      const result = await dslExtensionSystem.validateComponent(component, validationContext);
      
      // Verify that the extension modified the validation result
      expect(result.validationResult.isValid).toBe(false);
      expect(result.validationResult.errors).toContain('Test validation error');
    });
  });
  
  describe('Component Compilation', () => {
    it('should trigger the component compilation extension point', async () => {
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Spy on the extension system
      const triggerExtensionPointSpy = vi.spyOn(extensionSystem, 'triggerExtensionPoint');
      
      // Create a test component
      const component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand',
        description: 'A test command',
        input: { ref: 'TestInput' },
        output: { ref: 'TestOutput' },
        definition: {}
      };
      
      // Create a compilation context
      const compilationContext = {
        component,
        code: '',
        options: { targetLanguage: 'typescript' }
      };
      
      // Compile the component
      await dslExtensionSystem.compileComponent(component, compilationContext);
      
      // Verify that the extension point was triggered
      expect(triggerExtensionPointSpy).toHaveBeenCalledWith(
        DSL_EXTENSION_POINTS.COMPILE_COMPONENT,
        compilationContext
      );
    });
    
    it('should allow extensions to modify the compilation result', async () => {
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Create a compilation extension
      const compilationExtension: Extension = {
        name: 'test-compilation-extension',
        description: 'A test compilation extension',
        hooks: {
          [DSL_EXTENSION_POINTS.COMPILE_COMPONENT]: (context: any) => {
            // Add code to the compilation result
            context.code = '// Generated by test-compilation-extension\n' + context.code;
            return context;
          }
        }
      };
      
      // Register the extension
      extensionSystem.registerExtension(compilationExtension);
      
      // Create a test component
      const component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand',
        description: 'A test command',
        input: { ref: 'TestInput' },
        output: { ref: 'TestOutput' },
        definition: {}
      };
      
      // Create a compilation context
      const compilationContext = {
        component,
        code: 'function testCommand() {}',
        options: { targetLanguage: 'typescript' }
      };
      
      // Compile the component
      const result = await dslExtensionSystem.compileComponent(component, compilationContext);
      
      // Verify that the extension modified the compilation result
      expect(result.code).toContain('// Generated by test-compilation-extension');
      expect(result.code).toContain('function testCommand() {}');
    });
  });
  
  describe('Component Transformation', () => {
    it('should trigger the component transformation extension point', async () => {
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Spy on the extension system
      const triggerExtensionPointSpy = vi.spyOn(extensionSystem, 'triggerExtensionPoint');
      
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
      
      // Create a transformation context
      const transformationContext = {
        component,
        transformedComponent: { ...component }
      };
      
      // Transform the component
      await dslExtensionSystem.transformComponent(component, transformationContext);
      
      // Verify that the extension point was triggered
      expect(triggerExtensionPointSpy).toHaveBeenCalledWith(
        DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT,
        transformationContext
      );
    });
    
    it('should allow extensions to modify the transformation result', async () => {
      // Initialize the DSL extension system
      dslExtensionSystem.initialize();
      
      // Create a transformation extension
      const transformationExtension: Extension = {
        name: 'test-transformation-extension',
        description: 'A test transformation extension',
        hooks: {
          [DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT]: (context: any) => {
            // Add a tag to the transformed component
            context.transformedComponent.tags = ['transformed'];
            return context;
          }
        }
      };
      
      // Register the extension
      extensionSystem.registerExtension(transformationExtension);
      
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
      
      // Create a transformation context
      const transformationContext = {
        component,
        transformedComponent: { ...component }
      };
      
      // Transform the component
      const result = await dslExtensionSystem.transformComponent(component, transformationContext);
      
      // Verify that the extension modified the transformation result
      expect(result.transformedComponent.tags).toContain('transformed');
    });
  });
}); 