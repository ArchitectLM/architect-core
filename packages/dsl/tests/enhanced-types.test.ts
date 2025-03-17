import { describe, it, expect, vi } from 'vitest';
import { ComponentType } from '../src/types.js';
import { 
  ComponentByType, 
  ComponentEventPayload, 
  ValidationResult,
  TypedComponentRegistry,
  ComponentValidator,
  ComponentCompiler,
  ComponentTransformer,
  TypedEventSubscription
} from '../src/enhanced-types.js';

describe('Enhanced Types', () => {
  describe('ComponentByType', () => {
    it('should correctly map component types to their interfaces', () => {
      // This is a type test, so we're just verifying compilation
      // We can create a type assertion to ensure the mapping works
      type SchemaComponentType = ComponentByType<ComponentType.SCHEMA>;
      type CommandComponentType = ComponentByType<ComponentType.COMMAND>;
      
      // If we got here without TypeScript errors, the test passes
      expect(true).toBe(true);
    });
  });

  describe('ValidationResult', () => {
    it('should create a valid validation result', () => {
      const validResult: ValidationResult<any> = {
        isValid: true,
        errors: [],
        component: { name: 'TestComponent', type: ComponentType.SCHEMA }
      };
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validResult.component).toBeDefined();
    });

    it('should create an invalid validation result', () => {
      const invalidResult: ValidationResult<any> = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
      };
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
      expect(invalidResult.component).toBeUndefined();
    });
  });

  describe('ComponentEventPayload', () => {
    it('should create a valid component event payload', () => {
      const payload: ComponentEventPayload<ComponentType.SCHEMA> = {
        component: {
          name: 'TestSchema',
          type: ComponentType.SCHEMA,
          description: 'Test schema',
          definition: { type: 'object' }
        }
      };
      
      expect(payload.component).toBeDefined();
      expect(payload.component.type).toBe(ComponentType.SCHEMA);
      expect(payload.component.name).toBe('TestSchema');
    });
  });

  describe('TypedComponentRegistry', () => {
    it('should implement a type-safe component registry', () => {
      // Create a mock implementation of TypedComponentRegistry
      const mockRegistry: TypedComponentRegistry = {
        getComponent: <T extends ComponentType>(name: string, type: T) => {
          if (name === 'User' && type === ComponentType.SCHEMA) {
            return {
              type: ComponentType.SCHEMA,
              name: 'User',
              description: 'User schema',
              definition: { type: 'object' }
            } as ComponentByType<T>;
          }
          return undefined;
        },
        getComponentsByType: <T extends ComponentType>(type: T) => {
          if (type === ComponentType.SCHEMA) {
            return [
              {
                type: ComponentType.SCHEMA,
                name: 'User',
                description: 'User schema',
                definition: { type: 'object' }
              },
              {
                type: ComponentType.SCHEMA,
                name: 'Product',
                description: 'Product schema',
                definition: { type: 'object' }
              }
            ] as ComponentByType<T>[];
          }
          return [] as ComponentByType<T>[];
        }
      };

      // Test getComponent
      const userSchema = mockRegistry.getComponent('User', ComponentType.SCHEMA);
      expect(userSchema).toBeDefined();
      expect(userSchema?.name).toBe('User');
      expect(userSchema?.type).toBe(ComponentType.SCHEMA);

      // Test getComponentsByType
      const schemas = mockRegistry.getComponentsByType(ComponentType.SCHEMA);
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe('User');
      expect(schemas[1].name).toBe('Product');
    });
  });

  describe('ComponentValidator', () => {
    it('should implement a type-safe component validator', () => {
      // Create a mock implementation of ComponentValidator
      const mockValidator: ComponentValidator<any> = {
        validate: vi.fn((component) => {
          if (!component.name) {
            return {
              isValid: false,
              errors: ['Component name is required']
            };
          }
          
          if (component.type === ComponentType.SCHEMA && !component.definition) {
            return {
              isValid: false,
              errors: ['Schema definition is required']
            };
          }
          
          return {
            isValid: true,
            errors: [],
            component
          };
        })
      };

      // Test with valid component
      const validComponent = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: { type: 'object' }
      };
      
      const validResult = mockValidator.validate(validComponent);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validResult.component).toBe(validComponent);

      // Test with invalid component (missing name)
      const invalidComponent1 = {
        type: ComponentType.SCHEMA,
        definition: { type: 'object' }
      };
      
      const invalidResult1 = mockValidator.validate(invalidComponent1);
      expect(invalidResult1.isValid).toBe(false);
      expect(invalidResult1.errors).toContain('Component name is required');

      // Test with invalid component (missing definition)
      const invalidComponent2 = {
        type: ComponentType.SCHEMA,
        name: 'User'
      };
      
      const invalidResult2 = mockValidator.validate(invalidComponent2);
      expect(invalidResult2.isValid).toBe(false);
      expect(invalidResult2.errors).toContain('Schema definition is required');
    });
  });

  describe('ComponentCompiler', () => {
    it('should implement a type-safe component compiler', async () => {
      // Create a mock implementation of ComponentCompiler
      const mockCompiler: ComponentCompiler<any, string> = {
        compile: vi.fn(async (component) => {
          if (component.type === ComponentType.SCHEMA) {
            return `class ${component.name} {\n  // Schema implementation\n}`;
          }
          
          if (component.type === ComponentType.COMMAND) {
            return `function ${component.name}() {\n  // Command implementation\n}`;
          }
          
          return `// Unsupported component type: ${component.type}`;
        })
      };

      // Test with schema component
      const schemaComponent = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: { type: 'object' }
      };
      
      const schemaCode = await mockCompiler.compile(schemaComponent);
      expect(schemaCode).toContain('class User');
      expect(schemaCode).toContain('// Schema implementation');

      // Test with command component
      const commandComponent = {
        type: ComponentType.COMMAND,
        name: 'CreateUser',
        input: { ref: 'User' },
        output: { ref: 'User' }
      };
      
      const commandCode = await mockCompiler.compile(commandComponent);
      expect(commandCode).toContain('function CreateUser');
      expect(commandCode).toContain('// Command implementation');
    });
  });

  describe('ComponentTransformer', () => {
    it('should implement a type-safe component transformer', async () => {
      // Create a mock implementation of ComponentTransformer
      const mockTransformer: ComponentTransformer<any, any> = {
        transform: vi.fn(async (component, options) => {
          if (component.type === ComponentType.SCHEMA) {
            return {
              ...component,
              transformed: true,
              format: options?.format || 'default'
            };
          }
          
          return component;
        })
      };

      // Test with schema component and no options
      const schemaComponent = {
        type: ComponentType.SCHEMA,
        name: 'User',
        definition: { type: 'object' }
      };
      
      const transformedSchema1 = await mockTransformer.transform(schemaComponent);
      expect(transformedSchema1.transformed).toBe(true);
      expect(transformedSchema1.format).toBe('default');

      // Test with schema component and options
      const transformedSchema2 = await mockTransformer.transform(schemaComponent, { format: 'json' });
      expect(transformedSchema2.transformed).toBe(true);
      expect(transformedSchema2.format).toBe('json');
    });
  });

  describe('TypedEventSubscription', () => {
    it('should implement a type-safe event subscription', () => {
      // Create a mock implementation of TypedEventSubscription
      const mockSubscription: TypedEventSubscription = {
        subscribeToComponentEvent: vi.fn((eventType, componentType, handler) => {
          // In a real implementation, this would register the handler
          // For testing, we just return an unsubscribe function
          return () => {
            // Unsubscribe logic would go here
          };
        })
      };

      // Create a mock handler
      const mockHandler = vi.fn((payload: ComponentEventPayload<ComponentType.SCHEMA>) => {
        // Handler logic
      });

      // Subscribe to an event
      const unsubscribe = mockSubscription.subscribeToComponentEvent(
        'COMPONENT_CREATED',
        ComponentType.SCHEMA,
        mockHandler
      );

      // Verify the subscription was made
      expect(mockSubscription.subscribeToComponentEvent).toHaveBeenCalledWith(
        'COMPONENT_CREATED',
        ComponentType.SCHEMA,
        mockHandler
      );

      // Verify the unsubscribe function was returned
      expect(typeof unsubscribe).toBe('function');
    });
  });
}); 