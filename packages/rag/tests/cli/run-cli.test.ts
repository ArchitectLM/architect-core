import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main } from '../../src/cli/run-cli.js';
import { LLMService } from '../../src/llm/llm-service.js';
import { exampleComponents } from './fixtures/example-components.js';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';

// Mock ChromaDBConnector
vi.mock('../../src/vector-db/chroma-connector.js', () => {
  const chromaDBConnector = {
    initialize: vi.fn().mockResolvedValue(undefined),
    addDocument: vi.fn().mockResolvedValue('test-id'),
    search: vi.fn().mockResolvedValue([]),
    getDocument: vi.fn().mockResolvedValue(null),
    updateDocument: vi.fn().mockResolvedValue(undefined),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
    addFeedback: vi.fn().mockResolvedValue('feedback-id'),
    getFeedbackForComponent: vi.fn().mockResolvedValue([]),
    searchFeedback: vi.fn().mockResolvedValue([]),
    recordRetrieval: vi.fn().mockResolvedValue('retrieval-id'),
    updateRetrievalOutcome: vi.fn().mockResolvedValue(undefined),
    getRetrievalsByQuery: vi.fn().mockResolvedValue([]),
    getSuccessfulRetrievals: vi.fn().mockResolvedValue([]),
    createComponentVersion: vi.fn().mockResolvedValue('version-id'),
    getComponentVersions: vi.fn().mockResolvedValue([]),
    getComponentVersionDiff: vi.fn().mockResolvedValue({ additions: [], deletions: [] }),
    addLearningTask: vi.fn().mockResolvedValue('task-id'),
    getLearningTasks: vi.fn().mockResolvedValue([]),
    addExemplarSolution: vi.fn().mockResolvedValue('solution-id'),
    getExemplarSolutions: vi.fn().mockResolvedValue([]),
    getTasksByDifficulty: vi.fn().mockResolvedValue([]),
    getNextRecommendedTask: vi.fn().mockResolvedValue(null),
    addDocuments: vi.fn().mockResolvedValue(['test-id-1', 'test-id-2'])
  };
  return {
    ChromaDBConnector: vi.fn().mockImplementation(() => chromaDBConnector)
  };
});

// Mock LLMService
vi.mock('../../src/llm/llm-service.js', () => {
  return {
    LLMService: vi.fn().mockImplementation(() => ({
      getRawResponse: vi.fn().mockImplementation(async (prompt: string, systemPrompt: string, onChunk?: (chunk: string) => void) => {
        // Simulate streaming the example components
        if (onChunk) {
          for (const component of exampleComponents) {
            onChunk(`// === ${component.name} (${component.type}) ===\n`);
            onChunk(component.content);
            onChunk(`\n// === End ${component.name} ===\n`);
          }
        }
        return exampleComponents.map(c => c.content).join('\n\n');
      }),
      generateComponent: vi.fn().mockImplementation(async () => {
        return exampleComponents;
      })
    }))
  };
});

describe('run-cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate components and save them to ChromaDB', async () => {
    const result = await main('generate order processing system');
    
    expect(result?.currentComponents).toBeDefined();
    expect(result?.currentComponents.length).toBeGreaterThan(0);
    
    // Verify the components were generated correctly
    const components = result?.currentComponents || [];
    components.forEach(component => {
      expect(component.content).toBeDefined();
      expect(component.name).toBeDefined();
      expect(component.type).toBeDefined();
      expect(component.metadata).toBeDefined();
    });

    // Verify that ChromaDB was initialized
    const chromaConnector = new ChromaDBConnector({
      collectionName: 'rag-components',
      embeddingDimension: 1536,
      distance: 'cosine'
    });
    expect(chromaConnector.initialize).toHaveBeenCalled();

    // Verify that components were saved to ChromaDB
    expect(chromaConnector.addDocument).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system',
      name: 'OrderProcessingSystem',
      content: expect.any(String)
    }));

    expect(chromaConnector.addDocument).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system',
      name: 'Order',
      content: expect.any(String)
    }));

    expect(chromaConnector.addDocument).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system',
      name: 'CreateOrder',
      content: expect.any(String)
    }));
  });
}); 