import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChromaVectorDBAdapter } from '../src/vector-db-adapter.js';
import { ComponentType } from '../src/types.js';

// Mock the ChromaDB client
vi.mock('chromadb', () => {
  const mockCollection = {
    add: vi.fn().mockResolvedValue({}),
    query: vi.fn().mockResolvedValue({
      documents: [[]],
      metadatas: [[]]
    }),
    get: vi.fn().mockResolvedValue({
      documents: [],
      metadatas: []
    })
  };

  const mockClient = {
    getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection)
  };

  return {
    ChromaClient: vi.fn().mockImplementation(() => mockClient)
  };
});

// Create a mock adapter that doesn't try to connect to ChromaDB
class MockChromaVectorDBAdapter extends ChromaVectorDBAdapter {
  constructor(config: any) {
    super(config);
    // @ts-ignore - Override private properties for testing
    this.collection = {
      add: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockResolvedValue({
        documents: [[]],
        metadatas: [[]]
      }),
      get: vi.fn().mockResolvedValue({
        documents: [],
        metadatas: []
      })
    };
  }
}

describe('ChromaVectorDBAdapter', () => {
  let adapter: MockChromaVectorDBAdapter;
  
  beforeEach(() => {
    adapter = new MockChromaVectorDBAdapter({
      url: 'http://localhost:8000',
      collectionName: 'test-collection'
    });
    
    // Reset mock call counts
    vi.clearAllMocks();
  });

  describe('storeComponent', () => {
    it('should store a component as a single document when small enough', async () => {
      // @ts-ignore - Using a simplified component for testing
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        version: '1.0.0',
        tags: ['test', 'schema'],
        authors: ['Test Author'],
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      };

      const id = await adapter.storeComponent(component);
      
      // Verify the ID is returned
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      
      // Verify the collection.add was called
      expect((adapter as any).collection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          metadatas: [expect.objectContaining({
            name: 'TestSchema',
            type: ComponentType.SCHEMA
          })]
        })
      );
    });

    it('should chunk a large component', async () => {
      // Create a large component by adding a long description
      // @ts-ignore - Using a simplified component for testing
      const largeComponent = {
        type: ComponentType.SCHEMA,
        name: 'LargeSchema',
        description: 'A'.repeat(10000), // Very long description
        definition: {
          type: 'object',
          properties: {}
        }
      };

      // Override the maxChunkSize for testing
      (adapter as any).config.maxChunkSize = 1000;

      const id = await adapter.storeComponent(largeComponent);
      
      expect(id).toBeDefined();
      
      // Verify the collection.add was called multiple times
      expect((adapter as any).collection.add).toHaveBeenCalled();
    });
  });

  describe('storeImplementation', () => {
    it('should store an implementation', async () => {
      // @ts-ignore - Using a simplified implementation for testing
      const implementation = {
        componentName: 'TestComponent',
        implementation: async (input: any) => {
          return { result: input.value * 2 };
        },
        metadata: {
          complexity: 'low',
          estimatedLatency: 'low',
          sideEffects: ['none'],
          testCases: [
            {
              description: 'Test case',
              input: { value: 2 },
              expectedOutput: { result: 4 }
            }
          ]
        }
      };

      const id = await adapter.storeImplementation(implementation);
      
      expect(id).toBeDefined();
      
      expect((adapter as any).collection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          metadatas: [expect.objectContaining({
            type: 'implementation',
            componentName: 'TestComponent'
          })]
        })
      );
    });
  });

  describe('storeRelationship', () => {
    it('should store a relationship between components', async () => {
      await adapter.storeRelationship(
        'ComponentA',
        'ComponentB',
        'depends-on',
        'ComponentA depends on ComponentB'
      );
      
      expect((adapter as any).collection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          metadatas: [expect.objectContaining({
            type: 'relationship',
            fromComponent: 'ComponentA',
            toComponent: 'ComponentB',
            relationshipType: 'depends-on'
          })]
        })
      );
    });
  });

  describe('searchComponents', () => {
    it('should search for components with the given query', async () => {
      const mockResults = {
        documents: [[JSON.stringify({
          type: ComponentType.SCHEMA,
          name: 'FoundSchema',
          description: 'A schema that was found in search',
          definition: { type: 'object' }
        })]],
        metadatas: [[{ type: ComponentType.SCHEMA }]]
      };
      
      (adapter as any).collection.query.mockResolvedValueOnce(mockResults);
      
      const results = await adapter.searchComponents('schema');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('FoundSchema');
      expect((adapter as any).collection.query).toHaveBeenCalledWith({
        queryTexts: ['schema'],
        nResults: 10,
        where: undefined
      });
    });

    it('should apply filters to the search', async () => {
      const mockResults = {
        documents: [[JSON.stringify({
          type: ComponentType.COMMAND,
          name: 'TestCommand',
          tags: ['api', 'command'],
          definition: {}
        })]],
        metadatas: [[{ type: ComponentType.COMMAND }]]
      };
      
      (adapter as any).collection.query.mockResolvedValueOnce(mockResults);
      
      const results = await adapter.searchComponents('command', {
        type: ComponentType.COMMAND
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(ComponentType.COMMAND);
      expect((adapter as any).collection.query).toHaveBeenCalledWith({
        queryTexts: ['command'],
        nResults: 10,
        where: { type: ComponentType.COMMAND }
      });
    });
  });

  describe('getRelatedComponents', () => {
    it('should retrieve related components', async () => {
      // Mock the relationship query results
      const mockRelationships = {
        documents: [
          JSON.stringify({ from: 'ComponentA', to: 'ComponentB', type: 'depends-on' })
        ],
        metadatas: [
          { fromComponent: 'ComponentA', toComponent: 'ComponentB', relationshipType: 'depends-on' }
        ]
      };
      
      // Mock the component query results
      const mockComponent = {
        documents: [
          JSON.stringify({
            type: ComponentType.COMMAND,
            name: 'ComponentB',
            description: 'Related component',
            definition: {}
          })
        ],
        metadatas: [{ name: 'ComponentB' }]
      };
      
      (adapter as any).collection.get.mockResolvedValueOnce(mockRelationships);
      (adapter as any).collection.get.mockResolvedValueOnce(mockComponent);
      
      const results = await adapter.getRelatedComponents('ComponentA');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ComponentB');
      expect((adapter as any).collection.get).toHaveBeenCalledWith({
        where: {
          type: 'relationship',
          fromComponent: 'ComponentA'
        }
      });
    });

    it('should filter by relationship type', async () => {
      (adapter as any).collection.get.mockResolvedValueOnce({
        documents: [],
        metadatas: []
      });
      
      await adapter.getRelatedComponents('ComponentA', 'extends');
      
      expect((adapter as any).collection.get).toHaveBeenCalledWith({
        where: {
          type: 'relationship',
          fromComponent: 'ComponentA',
          relationshipType: 'extends'
        }
      });
    });
  });

  describe('chunkText', () => {
    it('should chunk text correctly', () => {
      const text = 'a'.repeat(1000) + 'b'.repeat(1000) + 'c'.repeat(1000);
      
      // Set chunk size and overlap
      (adapter as any).config.maxChunkSize = 1000;
      (adapter as any).config.chunkOverlap = 100;
      
      const chunks = (adapter as any).chunkText(text);
      
      expect(chunks).toHaveLength(4); // 3 chunks plus the remainder
      expect(chunks[0]).toBe('a'.repeat(1000));
      expect(chunks[1].startsWith('a'.repeat(100))).toBe(true);
      expect(chunks[1].endsWith('b'.repeat(900))).toBe(true);
      expect(chunks[2].startsWith('b'.repeat(100))).toBe(true);
    });
  });
}); 