import { describe, it, expect, beforeEach } from 'vitest';
import { 
  VectorDBAdapter, 
  VectorDBAdapterConfig, 
  Component, 
  ComponentType, 
  ComponentImplementation,
  ComponentSearchCriteria
} from '../src/types.js';
import { 
  DefaultVectorDBAdapterFactory, 
  vectorDBAdapterFactory 
} from '../src/vector-db-factory.js';
import { 
  MemoryVectorDBAdapter, 
  MemoryVectorDBAdapterOptions 
} from '../src/memory-vector-db-adapter.js';

describe('VectorDBAdapterFactory', () => {
  let factory: DefaultVectorDBAdapterFactory;

  beforeEach(() => {
    factory = new DefaultVectorDBAdapterFactory();
    factory.registerAdapterType('memory', MemoryVectorDBAdapter);
  });

  it('should register and list adapter types', () => {
    // Act
    const types = factory.getAvailableAdapterTypes();

    // Assert
    expect(types).toContain('memory');
    expect(types.length).toBe(1);
  });

  it('should create an adapter of the specified type', () => {
    // Arrange
    const config: VectorDBAdapterConfig = {
      type: 'memory',
      options: { name: 'test-db' }
    };

    // Act
    const adapter = factory.createAdapter(config);

    // Assert
    expect(adapter).toBeInstanceOf(MemoryVectorDBAdapter);
  });

  it('should throw an error for unknown adapter types', () => {
    // Arrange
    const config: VectorDBAdapterConfig = {
      type: 'unknown',
      options: {}
    };

    // Act & Assert
    expect(() => factory.createAdapter(config)).toThrow('Unknown adapter type: unknown');
  });
});

describe('MemoryVectorDBAdapter', () => {
  let adapter: VectorDBAdapter;

  beforeEach(() => {
    adapter = new MemoryVectorDBAdapter({ name: 'test-memory-db' });
  });

  it('should store and retrieve components', async () => {
    // Arrange
    const component: Component = {
      type: ComponentType.SCHEMA,
      name: 'TestSchema',
      description: 'A test schema',
      tags: ['test', 'schema'],
      definition: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    };

    // Act
    const id = await adapter.storeComponent(component);
    const results = await adapter.searchComponents('TestSchema');

    // Assert
    expect(id).toBeDefined();
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('TestSchema');
  });

  it('should store and retrieve implementations', async () => {
    // Arrange
    const implementation: ComponentImplementation = {
      componentName: 'TestCommand',
      implementation: async () => ({ success: true }),
      metadata: {
        complexity: 'low',
        testCases: [
          {
            description: 'Test case',
            input: {},
            expectedOutput: { success: true }
          }
        ]
      }
    };

    // Act
    const id = await adapter.storeImplementation(implementation);

    // Assert
    expect(id).toBeDefined();
    expect(id).toContain('implementation-TestCommand');
  });

  it('should store and retrieve relationships', async () => {
    // Arrange
    const orderComponent: Component = {
      type: ComponentType.SCHEMA,
      name: 'Order',
      description: 'Order schema',
      definition: { type: 'object' }
    };
    
    const createOrderComponent: Component = {
      type: ComponentType.COMMAND,
      name: 'CreateOrder',
      description: 'Create order command',
      input: { ref: 'OrderInput' },
      output: { ref: 'Order' }
    };

    // Act
    const orderId = await adapter.storeComponent(orderComponent);
    const createOrderId = await adapter.storeComponent(createOrderComponent);
    
    await adapter.storeRelationship(
      createOrderId, 
      orderId, 
      'creates', 
      'CreateOrder creates an Order'
    );
    
    const relatedComponents = await adapter.getRelatedComponents('CreateOrder');

    // Assert
    expect(relatedComponents.length).toBe(1);
    expect(relatedComponents[0].name).toBe('Order');
  });

  it('should filter search results by type', async () => {
    // Arrange
    const schemaComponent: Component = {
      type: ComponentType.SCHEMA,
      name: 'TestSchema',
      description: 'A test schema',
      definition: { type: 'object' }
    };
    
    const commandComponent: Component = {
      type: ComponentType.COMMAND,
      name: 'TestCommand',
      description: 'A test command',
      input: { ref: 'Input' },
      output: { ref: 'Output' }
    };

    // Act
    await adapter.storeComponent(schemaComponent);
    await adapter.storeComponent(commandComponent);
    
    const schemaResults = await adapter.searchComponents('Test', { type: ComponentType.SCHEMA });
    const commandResults = await adapter.searchComponents('Test', { type: ComponentType.COMMAND });

    // Assert
    expect(schemaResults.length).toBe(1);
    expect(schemaResults[0].type).toBe(ComponentType.SCHEMA);
    
    expect(commandResults.length).toBe(1);
    expect(commandResults[0].type).toBe(ComponentType.COMMAND);
  });

  it('should filter search results by tags', async () => {
    // Arrange
    const component1: Component = {
      type: ComponentType.SCHEMA,
      name: 'Component1',
      tags: ['tag1', 'tag2'],
      definition: { type: 'object' }
    };
    
    const component2: Component = {
      type: ComponentType.SCHEMA,
      name: 'Component2',
      tags: ['tag2', 'tag3'],
      definition: { type: 'object' }
    };

    // Act
    await adapter.storeComponent(component1);
    await adapter.storeComponent(component2);
    
    const tag1Results = await adapter.searchComponents('', { tags: ['tag1'] });
    const tag2Results = await adapter.searchComponents('', { tags: ['tag2'] });
    const tag3Results = await adapter.searchComponents('', { tags: ['tag3'] });

    // Assert
    expect(tag1Results.length).toBe(1);
    expect(tag1Results[0].name).toBe('Component1');
    
    expect(tag2Results.length).toBe(2);
    
    expect(tag3Results.length).toBe(1);
    expect(tag3Results[0].name).toBe('Component2');
  });
}); 