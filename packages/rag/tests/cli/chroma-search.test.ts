import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { exampleComponents } from './fixtures/example-components.js';
import { logger } from '../../src/utils/logger.js';

describe('ChromaDB Search E2E', () => {
  let chromaConnector: ChromaDBConnector;

  beforeEach(async () => {
    logger.level = 'error'; // Reduce noise in tests
    chromaConnector = new ChromaDBConnector({
      collectionName: 'test-components',
      embeddingDimension: 1536,
      distance: 'cosine',
      url: 'http://localhost:8000'
    });
    
    await chromaConnector.initialize();
    await chromaConnector.deleteAllDocuments();

    // Seed with example components
    for (const component of exampleComponents) {
      await chromaConnector.addDocument(component);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await chromaConnector.deleteAllDocuments();
  });

  it('should find order-related components when searching for "order"', async () => {
    const results = await chromaConnector.search('order', {
      limit: 10,
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Log search results for debugging
    console.log('\n=== Order Search Results ===');
    console.log(JSON.stringify(results.map(r => ({
      type: r.component.type,
      name: r.component.name,
      score: r.score,
      distance: r.distance,
      description: r.component.metadata?.description || ''
    })), null, 2));

    // Verify we found order-related components
    const orderComponents = results.filter(r => 
      r.component.name.toLowerCase().includes('order') ||
      (r.component.metadata?.description || '').toLowerCase().includes('order')
    );
    
    expect(orderComponents.length).toBeGreaterThan(0);
    expect(orderComponents[0].component.type).toBe('system');
    expect(orderComponents[0].component.name).toBe('OrderProcessingSystem');
  });

  it('should find schema components when searching for "schema"', async () => {
    const results = await chromaConnector.search('schema', {
      limit: 10,
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Log search results for debugging
    console.log('\n=== Schema Search Results ===');
    console.log(JSON.stringify(results.map(r => ({
      type: r.component.type,
      name: r.component.name,
      score: r.score,
      distance: r.distance,
      description: r.component.metadata?.description || ''
    })), null, 2));

    // Verify we found schema components
    const schemaComponents = results.filter(r => 
      r.component.type === 'schema' ||
      (r.component.metadata?.description || '').toLowerCase().includes('schema')
    );
    
    expect(schemaComponents.length).toBeGreaterThan(0);
    expect(schemaComponents[0].component.type).toBe('schema');
    expect(schemaComponents[0].component.name).toBe('Order');
  });

  it('should find command components when searching for "command"', async () => {
    const results = await chromaConnector.search('command', {
      limit: 10,
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Log search results for debugging
    console.log('\n=== Command Search Results ===');
    console.log(JSON.stringify(results.map(r => ({
      type: r.component.type,
      name: r.component.name,
      score: r.score,
      distance: r.distance,
      description: r.component.metadata?.description || ''
    })), null, 2));

    // Verify we found command components
    const commandComponents = results.filter(r => 
      r.component.type === 'command' ||
      (r.component.metadata?.description || '').toLowerCase().includes('command')
    );
    
    expect(commandComponents.length).toBeGreaterThan(0);
    expect(commandComponents[0].component.type).toBe('command');
    expect(commandComponents[0].component.name).toBe('CreateOrder');
  });

  it('should handle complex queries with multiple concepts', async () => {
    const results = await chromaConnector.search('order processing system', {
      limit: 10,
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Log search results for debugging
    console.log('\n=== Complex Query Search Results ===');
    console.log(JSON.stringify(results.map(r => ({
      type: r.component.type,
      name: r.component.name,
      score: r.score,
      distance: r.distance,
      description: r.component.metadata?.description || ''
    })), null, 2));

    // Verify we found relevant components and sort by score
    const relevantComponents = results
      .filter(r => 
        r.component.name.toLowerCase().includes('order') ||
        (r.component.metadata?.description || '').toLowerCase().includes('order')
      )
      .sort((a, b) => b.score - a.score); // Sort by score in descending order
    
    expect(relevantComponents.length).toBeGreaterThan(0);
    
    // Find the OrderProcessingSystem component
    const systemComponent = relevantComponents.find(c => 
      c.component.type === 'system' && 
      c.component.name === 'OrderProcessingSystem'
    );
    
    expect(systemComponent).toBeDefined();
    expect(systemComponent?.component.type).toBe('system');
    expect(systemComponent?.component.name).toBe('OrderProcessingSystem');
  });
}); 