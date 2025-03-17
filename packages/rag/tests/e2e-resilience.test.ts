/**
 * End-to-End Resilience Tests for RAG
 * 
 * These tests verify that the RAG system properly uses resilience patterns,
 * particularly the enhanced circuit breaker, to handle failures gracefully.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RAGSystem } from '../src/rag-system.js';
import { DocumentStore } from '../src/document-store.js';
import { VectorDatabase } from '../src/vector-database.js';
import { EnhancedCircuitBreakerExtension, CircuitBreakerState } from '../../extensions/src/extensions/enhanced-circuit-breaker.js';
import { createExtensionSystem } from '../../extensions/src/extension-system.js';

describe('RAG System Resilience', () => {
  let ragSystem: RAGSystem;
  let documentStore: DocumentStore;
  let vectorDb: VectorDatabase;
  let circuitBreaker: EnhancedCircuitBreakerExtension;
  let extensionSystem = createExtensionSystem();
  
  // Mock data
  const testDocuments = [
    { id: 'doc1', content: 'This is a test document about artificial intelligence.', metadata: { source: 'test' } },
    { id: 'doc2', content: 'Machine learning is a subset of artificial intelligence.', metadata: { source: 'test' } },
    { id: 'doc3', content: 'Natural language processing is used in many AI applications.', metadata: { source: 'test' } }
  ];
  
  beforeEach(() => {
    // Create a new extension system for each test to avoid conflicts
    extensionSystem = createExtensionSystem();
    
    // Create and configure the circuit breaker
    circuitBreaker = new EnhancedCircuitBreakerExtension();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.create',
      description: 'Creates a new circuit breaker',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.execute',
      description: 'Executes a function with circuit breaker protection',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.reset',
      description: 'Resets a circuit breaker',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.stateChange',
      description: 'Triggered when a circuit breaker changes state',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.getState',
      description: 'Gets the current state of a circuit breaker',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'circuitBreaker.configure',
      description: 'Configures a circuit breaker',
      handlers: []
    });
    
    // Register the circuit breaker with the extension system
    extensionSystem.registerExtension(circuitBreaker);
    
    // Configure the circuit breaker options
    circuitBreaker.configureCircuitBreaker({
      name: 'default',
      config: {
        failureThreshold: 3,
        resetTimeout: 1000,
        halfOpenSuccessThreshold: 2
      },
      context: {}
    });
    
    // Create mock implementations
    documentStore = {
      addDocument: vi.fn().mockResolvedValue(true),
      getDocument: vi.fn().mockImplementation((id) => {
        const doc = testDocuments.find(d => d.id === id);
        return Promise.resolve(doc || null);
      }),
      removeDocument: vi.fn().mockResolvedValue(true),
      listDocuments: vi.fn().mockResolvedValue(testDocuments)
    } as unknown as DocumentStore;
    
    vectorDb = {
      addEmbedding: vi.fn().mockResolvedValue(true),
      search: vi.fn().mockResolvedValue([
        { id: 'doc1', score: 0.9 },
        { id: 'doc2', score: 0.8 },
        { id: 'doc3', score: 0.7 }
      ]),
      removeEmbedding: vi.fn().mockResolvedValue(true)
    } as unknown as VectorDatabase;
    
    // Create the RAG system with the extension system
    ragSystem = new RAGSystem({
      documentStore,
      vectorDatabase: vectorDb,
      extensionSystem
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should use circuit breaker to handle vector database failures', async () => {
    // Configure the vector database to fail
    (vectorDb.search as any).mockRejectedValue(new Error('Vector database connection error'));
    
    // Create a circuit breaker for vector database operations
    circuitBreaker.createCircuitBreaker({
      name: 'vectorDb.search',
      options: {
        failureThreshold: 3,
        resetTimeout: 1000
      }
    });
    
    // First few searches should fail with the original error
    for (let i = 0; i < 3; i++) {
      try {
        await ragSystem.search('artificial intelligence');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Vector database connection error');
      }
    }
    
    // Next search should fail with circuit breaker open
    try {
      await ragSystem.search('artificial intelligence');
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toMatch(/Circuit is (open|half-open)/);
    }
    
    // Fix the vector database
    (vectorDb.search as any).mockResolvedValue([
      { id: 'doc1', score: 0.9 },
      { id: 'doc2', score: 0.8 }
    ]);
    
    // Reset the circuit breaker manually
    circuitBreaker.reset({ name: 'vectorDb.search' });
    
    // Next search should succeed
    const results = await ragSystem.search('artificial intelligence');
    expect(results.length).toBe(2);
    
    // Circuit breaker should now be closed
    const newCbState = circuitBreaker.getState('vectorDb.search');
    expect(newCbState).toBe(CircuitBreakerState.CLOSED);
  }, 10000); // Increase timeout to 10 seconds
  
  it('should provide fallback results when circuit breaker is open', async () => {
    // Configure RAG system with fallback capability
    ragSystem = new RAGSystem({
      documentStore,
      vectorDatabase: vectorDb,
      extensionSystem,
      fallbackStrategy: 'cache'
    });
    
    // Mock the cache with some results
    (ragSystem as any).resultCache = {
      'artificial intelligence': [
        { id: 'cached1', content: 'Cached result 1', metadata: { source: 'cache' } },
        { id: 'cached2', content: 'Cached result 2', metadata: { source: 'cache' } }
      ]
    };
    
    // Configure vector database to always fail
    (vectorDb.search as any).mockRejectedValue(new Error('Vector database unavailable'));
    
    // Register circuit breaker for vector database operations
    circuitBreaker.createCircuitBreaker({
      name: 'vectorDb.search',
      options: {
        failureThreshold: 2,
        resetTimeout: 5000
      }
    });
    
    // First searches should fail and trigger the circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await ragSystem.search('artificial intelligence');
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Circuit breaker should now be open
    const cbState = circuitBreaker.getState('vectorDb.search');
    expect(cbState).toBe(CircuitBreakerState.OPEN);
    
    // Search should now return fallback results from cache
    const results = await ragSystem.searchWithFallback('artificial intelligence');
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('cached1');
    expect(results[0].metadata.source).toBe('cache');
  });
  
  it('should use different circuit breakers for different operations', async () => {
    // Configure document store to fail for specific operations
    (documentStore.addDocument as any).mockRejectedValue(new Error('Write operation failed'));
    
    // Vector DB search still works
    (vectorDb.search as any).mockResolvedValue([
      { id: 'doc1', score: 0.9 },
      { id: 'doc2', score: 0.8 }
    ]);
    
    // Register circuit breakers for different operations
    circuitBreaker.createCircuitBreaker({
      name: 'documentStore.add',
      options: {
        failureThreshold: 2,
        resetTimeout: 1000
      }
    });
    
    circuitBreaker.createCircuitBreaker({
      name: 'vectorDb.search',
      options: {
        failureThreshold: 3,
        resetTimeout: 1000
      }
    });
    
    // Document add operations should fail and trigger that circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await ragSystem.addDocument({ id: 'new-doc', content: 'New content', metadata: {} });
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Document store circuit breaker should be open
    const docCbState = circuitBreaker.getState('documentStore.add');
    expect(docCbState).toBe(CircuitBreakerState.OPEN);
    
    // But search operations should still work
    const results = await ragSystem.search('artificial intelligence');
    expect(results.length).toBe(2);
    
    // Vector DB circuit breaker should still be closed
    const vectorCbState = circuitBreaker.getState('vectorDb.search');
    expect(vectorCbState).toBe(CircuitBreakerState.CLOSED);
  });
}); 