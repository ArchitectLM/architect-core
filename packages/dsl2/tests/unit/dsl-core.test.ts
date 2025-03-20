import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

describe('DSL Core', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Component Definition', () => {
    it('should define a component with basic properties', () => {
      const schema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string', description: 'Unique user identifier' },
          name: { type: 'string', description: 'User name' },
          email: { type: 'string', description: 'User email', format: 'email' }
        },
        required: ['id', 'name', 'email']
      });

      expect(schema).toBeDefined();
      expect(schema.id).toBe('User');
      expect(schema.type).toBe(ComponentType.SCHEMA);
      expect(schema.description).toBe('User schema definition');
      expect(schema.version).toBe('1.0.0');
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('email');
      expect(schema.required).toContain('id');
    });

    it('should define a command component', () => {
      const command = dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create a new user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' },
        produces: [{ event: 'UserCreated', description: 'Event emitted when user is created' }]
      });

      expect(command).toBeDefined();
      expect(command.id).toBe('CreateUser');
      expect(command.type).toBe(ComponentType.COMMAND);
      expect(command.input).toEqual({ ref: 'CreateUserInput' });
      expect(command.output).toEqual({ ref: 'User' });
      expect(command.produces).toHaveLength(1);
      expect(command.produces[0].event).toBe('UserCreated');
    });

    it('should enforce required properties for components', () => {
      expect(() => dsl.component('Invalid', {
        // Missing type
        description: 'This will fail'
      } as any)).toThrow(/type is required/i);
    });
  });

  describe('Component Registration and Retrieval', () => {
    it('should register components and allow retrieval by ID', () => {
      const schema = dsl.component('Product', {
        type: ComponentType.SCHEMA,
        description: 'Product schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' }
        }
      });

      const retrievedSchema = dsl.getComponent('Product');
      expect(retrievedSchema).toBeDefined();
      expect(retrievedSchema).toEqual(schema);
    });

    it('should return undefined for unknown component', () => {
      const unknown = dsl.getComponent('Unknown');
      expect(unknown).toBeUndefined();
    });
  });

  describe('Component Implementation', () => {
    it('should implement a command with business logic', async () => {
      // First define the command
      dsl.component('CreateProduct', {
        type: ComponentType.COMMAND,
        description: 'Create a new product',
        version: '1.0.0',
        input: { ref: 'CreateProductInput' },
        output: { ref: 'Product' }
      });

      // Then implement it
      const implementation = async (input: any, context: any) => {
        return {
          id: 'prod-123',
          name: input.name,
          price: input.price,
          createdAt: new Date().toISOString()
        };
      };

      const impl = dsl.implement('CreateProduct', implementation);
      
      expect(impl).toBeDefined();
      expect(typeof impl).toBe('function');
      
      // Test the implementation
      const result = await implementation({ name: 'Test Product', price: 29.99 }, {});
      expect(result.id).toBe('prod-123');
      expect(result.name).toBe('Test Product');
      expect(result.price).toBe(29.99);
    });

    it('should throw an error when implementing an undefined component', () => {
      const implementation = async (input: any, context: any) => {
        return { success: true };
      };

      expect(() => dsl.implement('NonExistentCommand', implementation))
        .toThrow(/component not found/i);
    });
  });

  describe('System Definition', () => {
    it('should define a system with components and workflows', () => {
      // First define some components
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { id: { type: 'string' }, name: { type: 'string' } }
      });
      
      dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create a user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' }
      });

      // Define a system
      const system = dsl.system('UserManagement', {
        description: 'User management system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'User' }],
          commands: [{ ref: 'CreateUser' }]
        },
        workflows: [
          {
            name: 'UserRegistration',
            description: 'User registration workflow',
            initialState: 'started',
            transitions: [
              { from: 'started', to: 'completed', on: 'USER_CREATED' }
            ]
          }
        ]
      });

      expect(system).toBeDefined();
      expect(system.id).toBe('UserManagement');
      expect(system.description).toBe('User management system');
      expect(system.components.schemas).toHaveLength(1);
      expect(system.components.commands).toHaveLength(1);
      expect(system.workflows).toHaveLength(1);
      expect(system.workflows[0].name).toBe('UserRegistration');
    });
  });
}); 