import { describe, it, expect, beforeEach, vi } from 'vitest';
import { System } from '../src/system-api.js';
import { ComponentType, Component } from '../src/types.js';

describe('System API', () => {
  beforeEach(() => {
    // Reset the System API before each test
    System.reset();
  });

  describe('component', () => {
    it('should register a schema component', () => {
      // Act
      const component = System.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Represents a customer order in the system',
        tags: ['order', 'commerce', 'core'],
        version: '1.0.0',
        authors: ['team-commerce'],
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique order identifier' }
          }
        },
        examples: [
          {
            id: 'order-123'
          }
        ]
      });

      // Assert
      expect(component).toBeDefined();
      expect(component.name).toBe('Order');
      expect(component.type).toBe(ComponentType.SCHEMA);
      expect(System.getComponent('Order')).toEqual(component);
    });

    it('should register a command component', () => {
      // Arrange
      System.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        definition: { type: 'object' }
      });

      System.component('OrderInput', {
        type: ComponentType.SCHEMA,
        description: 'Order input schema',
        definition: { type: 'object' }
      });

      // Act
      const component = System.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Creates a new order in the system',
        tags: ['order', 'commerce', 'write'],
        version: '1.0.0',
        input: { ref: 'OrderInput', description: 'Request to create a new order' },
        output: { ref: 'Order', description: 'The created order' },
        plugins: {
          storage: {
            ref: 'PostgresPlugin',
            description: 'For persisting order data',
            operations: ['insert', 'update']
          }
        },
        extensionPoints: {
          beforeCreate: {
            description: 'Called before creating the order',
            parameters: ['order', 'context'],
            examples: ['validateInventory', 'applyDiscounts']
          }
        },
        produces: [
          {
            event: 'OrderCreated',
            description: 'Published when an order is successfully created'
          }
        ],
        relatedComponents: [
          { ref: 'Order', relationship: 'creates' },
          { ref: 'GetOrder', relationship: 'complementary' }
        ]
      });

      // Assert
      expect(component).toBeDefined();
      expect(component.name).toBe('CreateOrder');
      expect(component.type).toBe(ComponentType.COMMAND);
      expect(component.input.ref).toBe('OrderInput');
      expect(component.output.ref).toBe('Order');
      expect(System.getComponent('CreateOrder')).toEqual(component);
    });

    it('should throw an error when registering a component with a duplicate name', () => {
      // Arrange
      System.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        definition: { type: 'object' }
      });

      // Act & Assert
      expect(() => {
        System.component('Order', {
          type: ComponentType.SCHEMA,
          description: 'Another order schema',
          definition: { type: 'object' }
        });
      }).toThrow('Component with name Order already exists');
    });
  });

  describe('define', () => {
    it('should define a system', () => {
      // Arrange
      System.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        definition: { type: 'object' }
      });

      System.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      });

      // Act
      const system = System.define('OrderSystem', {
        description: 'Order processing system',
        version: '1.0.0',
        tags: ['e-commerce', 'order-processing'],
        components: {
          schemas: [
            { ref: 'Order', required: true }
          ],
          commands: [
            { ref: 'CreateOrder', required: true }
          ]
        }
      });

      // Assert
      expect(system).toBeDefined();
      expect(system.name).toBe('OrderSystem');
      expect(system.components.schemas).toHaveLength(1);
      expect(system.components.commands).toHaveLength(1);
      expect(System.getSystem('OrderSystem')).toEqual(system);
    });

    it('should throw an error if a required component is missing', () => {
      // Act & Assert
      expect(() => {
        System.define('OrderSystem', {
          description: 'Order processing system',
          components: {
            schemas: [
              { ref: 'Order', required: true }
            ]
          }
        });
      }).toThrow('Required component Order not found');
    });
  });

  describe('implement', () => {
    it('should implement a component', () => {
      // Arrange
      System.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      });

      // Act
      const implementation = System.implement<{ customerId: string }, { id: string }>('CreateOrder', 
        async (input: { customerId: string }, context: any) => {
          return { id: 'order-123' };
        }, 
        {
          complexity: 'medium',
          estimatedLatency: 'low',
          sideEffects: ['database-write', 'event-publishing'],
          testCases: [
            {
              description: 'Successfully creates an order',
              input: { customerId: 'cust-456' },
              expectedOutput: { id: 'order-123' }
            }
          ]
        }
      );

      // Assert
      expect(implementation).toBeDefined();
      expect(implementation.componentName).toBe('CreateOrder');
      expect(typeof implementation.implementation).toBe('function');
      expect(implementation.metadata?.complexity).toBe('medium');
      expect(System.getImplementation('CreateOrder')).toEqual(implementation);
    });

    it('should throw an error if the component does not exist', () => {
      // Act & Assert
      expect(() => {
        System.implement('NonExistentComponent', async (input: any, context: any) => {
          return { success: true };
        });
      }).toThrow('Component NonExistentComponent not found');
    });
  });

  describe('execute', () => {
    it('should execute a component implementation', async () => {
      // Arrange
      System.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      });

      System.implement<{ customerId: string }, { id: string, customerId: string }>('CreateOrder', 
        async (input: { customerId: string }, context: any) => {
          return { id: 'order-123', customerId: input.customerId };
        }
      );

      // Act
      const result = await System.execute<{ customerId: string }, { id: string, customerId: string }>('CreateOrder', { customerId: 'cust-456' });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('order-123');
      expect(result.customerId).toBe('cust-456');
    });

    it('should throw an error if the component does not exist', async () => {
      // Act & Assert
      await expect(System.execute('NonExistentComponent', {})).rejects.toThrow(
        'Component NonExistentComponent not found'
      );
    });

    it('should throw an error if the component has no implementation', async () => {
      // Arrange
      System.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      });

      // Act & Assert
      await expect(System.execute('CreateOrder', {})).rejects.toThrow(
        'No implementation found for component CreateOrder'
      );
    });
  });

  describe('findComponents', () => {
    it('should find components by type', () => {
      // Arrange
      System.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        definition: { type: 'object' }
      });

      System.component('Customer', {
        type: ComponentType.SCHEMA,
        description: 'Customer schema',
        definition: { type: 'object' }
      });

      System.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      });

      // Act
      const schemas = System.findComponents({ type: ComponentType.SCHEMA });
      const commands = System.findComponents({ type: ComponentType.COMMAND });

      // Assert
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe('Order');
      expect(schemas[1].name).toBe('Customer');
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('CreateOrder');
    });

    it('should find components by tags', () => {
      // Arrange
      System.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        tags: ['order', 'commerce'],
        definition: { type: 'object' }
      });

      System.component('Product', {
        type: ComponentType.SCHEMA,
        description: 'Product schema',
        tags: ['product', 'commerce'],
        definition: { type: 'object' }
      });

      // Act
      const orderComponents = System.findComponents({ tags: ['order'] });
      const commerceComponents = System.findComponents({ tags: ['commerce'] });

      // Assert
      expect(orderComponents).toHaveLength(1);
      expect(orderComponents[0].name).toBe('Order');
      expect(commerceComponents).toHaveLength(2);
      expect(commerceComponents.map((c: Component) => c.name)).toContain('Order');
      expect(commerceComponents.map((c: Component) => c.name)).toContain('Product');
    });
  });
}); 