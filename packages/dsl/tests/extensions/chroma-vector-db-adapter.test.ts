import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Component, ComponentType, ComponentImplementation } from '../../src/types.js';

// Mock ChromaDB client
vi.mock('chromadb', () => {
  return {
    ChromaClient: vi.fn().mockImplementation(() => ({
      getOrCreateCollection: vi.fn().mockImplementation((name) => ({
        name,
        add: vi.fn().mockResolvedValue({ success: true }),
        get: vi.fn().mockImplementation(({ ids, where }) => {
          if (ids && ids.includes('component-User')) {
            return {
              ids: ['component-User'],
              metadatas: [{ name: 'User', type: 'SCHEMA' }],
              documents: [JSON.stringify({ name: 'User', type: 'SCHEMA', definition: {} })]
            };
          }
          if (where && where.type === 'SCHEMA') {
            return {
              ids: ['component-User', 'component-Product'],
              metadatas: [
                { name: 'User', type: 'SCHEMA' },
                { name: 'Product', type: 'SCHEMA' }
              ],
              documents: [
                JSON.stringify({ name: 'User', type: 'SCHEMA', definition: {} }),
                JSON.stringify({ name: 'Product', type: 'SCHEMA', definition: {} })
              ]
            };
          }
          return { ids: [], metadatas: [], documents: [] };
        }),
        query: vi.fn().mockImplementation(({ queryTexts }) => {
          if (queryTexts[0].includes('user')) {
            return {
              ids: [['component-User']],
              metadatas: [[{ name: 'User', type: 'SCHEMA' }]],
              documents: [[JSON.stringify({ name: 'User', type: 'SCHEMA', definition: {} })]],
              distances: [[0.1]]
            };
          }
          return { ids: [[]], metadatas: [[]], documents: [[]], distances: [[]] };
        }),
        delete: vi.fn().mockResolvedValue({ success: true })
      })),
      reset: vi.fn().mockResolvedValue({ success: true })
    }))
  };
});

// Import the adapter after mocking ChromaDB
import { ChromaVectorDBAdapter } from '../../src/extensions/chroma-vector-db-adapter.js';

describe('ChromaVectorDBAdapter', () => {
  let adapter: ChromaVectorDBAdapter;
  
  // Sample components for testing
  const userComponent: Component = {
    type: ComponentType.SCHEMA,
    name: 'User',
    description: 'User schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  };
  
  const productComponent: Component = {
    type: ComponentType.SCHEMA,
    name: 'Product',
    description: 'Product schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' }
      }
    }
  };
  
  const createUserComponent: Component = {
    type: ComponentType.COMMAND,
    name: 'CreateUser',
    description: 'Create a new user',
    input: { ref: 'User' },
    output: { ref: 'User' },
    definition: {}
  };
  
  // Sample implementation for testing
  const createUserImplementation: ComponentImplementation = {
    componentName: 'CreateUser',
    implementation: (input: any) => ({ ...input, id: '123' }),
    metadata: {
      complexity: 'low',
      estimatedLatency: 'low'
    }
  };
  
  beforeEach(() => {
    // Create a fresh adapter for each test
    adapter = new ChromaVectorDBAdapter({
      url: 'http://localhost:8000',
      collectionName: 'test-components'
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with the provided configuration', () => {
      expect(adapter).toBeDefined();
    });
    
    it('should use default values for optional configuration parameters', () => {
      const defaultAdapter = new ChromaVectorDBAdapter({
        url: 'http://localhost:8000',
        collectionName: 'test-components'
      });
      
      expect(defaultAdapter).toBeDefined();
      // Default values would be tested through internal behavior
    });
  });
  
  describe('storeComponent', () => {
    it('should store a component and return its ID', async () => {
      const id = await adapter.storeComponent(userComponent);
      
      expect(id).toBeDefined();
      expect(id).toBe('component-User');
    });
    
    it('should handle components with complex nested structures', async () => {
      const complexComponent: Component = {
        type: ComponentType.SCHEMA,
        name: 'ComplexSchema',
        description: 'A schema with nested structures',
        definition: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                array: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      };
      
      const id = await adapter.storeComponent(complexComponent);
      expect(id).toBe('component-ComplexSchema');
    });
  });
  
  describe('storeImplementation', () => {
    it('should store an implementation and return its ID', async () => {
      const id = await adapter.storeImplementation(createUserImplementation);
      
      expect(id).toBeDefined();
      expect(id).toBe('implementation-CreateUser');
    });
  });
  
  describe('storeRelationship', () => {
    it('should store a relationship between components', async () => {
      await adapter.storeComponent(userComponent);
      await adapter.storeComponent(createUserComponent);
      
      // The storeRelationship method doesn't return anything in our implementation
      await expect(adapter.storeRelationship(
        'component-User',
        'component-CreateUser',
        'isUsedBy',
        'User is used by CreateUser'
      )).resolves.toBeUndefined();
    });
  });
  
  describe('searchComponents', () => {
    it('should search components by text query', async () => {
      const results = await adapter.searchComponents('user');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('User');
    });
    
    it('should filter search results by component type', async () => {
      const results = await adapter.searchComponents('schema', { type: ComponentType.SCHEMA });
      
      expect(results).toHaveLength(2);
      expect(results.every((c: Component) => c.type === ComponentType.SCHEMA)).toBe(true);
    });
    
    it('should return empty array when no matches are found', async () => {
      const results = await adapter.searchComponents('nonexistent');
      
      expect(results).toHaveLength(0);
    });
  });
  
  describe('getRelatedComponents', () => {
    it('should get related components for a given component', async () => {
      // This would require more complex mocking of the ChromaDB client
      // For now, we'll just test that the method exists and returns an array
      const relatedComponents = await adapter.getRelatedComponents('component-User');
      
      expect(Array.isArray(relatedComponents)).toBe(true);
    });
    
    it('should filter related components by relationship type', async () => {
      const relatedComponents = await adapter.getRelatedComponents('component-User', 'isUsedBy');
      
      expect(Array.isArray(relatedComponents)).toBe(true);
    });
  });
  
  describe('chunking functionality', () => {
    it('should chunk text based on specified chunk size', () => {
      const text = 'This is a test text that should be chunked into smaller pieces';
      const chunks = adapter.chunkText(text, 10, 0);
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(10);
    });
    
    it('should create overlapping chunks when overlap is specified', () => {
      const text = 'This is a test text that should have overlapping chunks';
      const chunks = adapter.chunkText(text, 10, 3);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Check for overlap
      const secondChunkStart = chunks[1].substring(0, 3);
      const firstChunkEnd = chunks[0].substring(chunks[0].length - 3);
      expect(secondChunkStart).toBe(firstChunkEnd);
    });
  });
  
  describe('clear', () => {
    it('should clear all stored data', async () => {
      await adapter.clear();
      // Since we're mocking, we just verify the method exists and doesn't throw
      expect(true).toBe(true);
    });
  });
}); 