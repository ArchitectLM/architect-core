import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { Component } from '../../src/models.js';
import { runDslEditor } from '../../src/cli/run-dsl-editor.js';
import { logger } from '../../src/utils/logger.js';
import { LLMService } from '../../src/llm/llm-service.js';
import { exampleComponents } from './fixtures/example-components.js';

// Mock the LLMService module
vi.mock('../../src/llm/llm-service.js', () => {
  return {
    LLMService: vi.fn().mockImplementation(() => ({
      generateComponent: vi.fn().mockImplementation(async (request: string, context?: { relevantComponents?: Component[] }) => {
        const isWorkflow = request.toLowerCase().includes('workflow');
        const componentType = isWorkflow ? 'workflow' : 'command';
        
        // Extract the main concept from the request
        const words = request.toLowerCase().split(' ');
        const conceptIndex = words.findIndex(w => w === 'for') + 1;
        const mainConcept = words.slice(conceptIndex)
          .filter(w => !['a', 'an', 'the'].includes(w))
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
        
        // Log received context for debugging
        if (context?.relevantComponents) {
          console.log('\n=== Relevant Components Passed to LLM ===');
          console.log(JSON.stringify(context.relevantComponents.map(c => ({
            type: c.type,
            name: c.name,
            description: c.metadata?.description || ''
          })), null, 2));
        }

        let content = `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/models.js';

export default System.component('${mainConcept}', {
  type: ComponentType.${componentType.toUpperCase()},
  description: '${request}',
  version: '1.0.0'`;

        if (isWorkflow) {
          content += `,
  steps: [
    {
      name: 'step1',
      description: 'First step',
      action: async () => {
        // Step implementation
      }
    }
  ]`;
        }

        content += `});`;

        return {
          type: componentType,
          name: mainConcept,
          content,
          metadata: {
            path: `${componentType}s/${mainConcept.toLowerCase().replace(/\s+/g, '-')}.ts`,
            description: request,
            tags: request.toLowerCase().split(' '),
            createdAt: Date.now(),
            author: 'test',
            version: '1.0.0'
          }
        };
      }),
      generateFeedback: vi.fn().mockImplementation(async (request: string) => 
        `Mock feedback for request: ${request}`
      )
    }))
  };
});

describe('run-dsl-editor E2E', () => {
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

  it('should process component creation request with debug info', async () => {
    // Get initial database statistics
    const components = await chromaConnector.search('', { 
      limit: 100, 
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    const componentTypes = components.reduce((acc: Record<string, number>, result) => {
      const type = result.component.type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n=== Initial Database State ===');
    console.log(JSON.stringify({
      totalComponents: components.length,
      componentTypes,
      lastUpdated: new Date().toISOString()
    }, null, 2));

    // Process the request
    const result = await runDslEditor('Create a command component for user authentication', chromaConnector, true);
    expect(result).toBeDefined();
    
    if (!result.success) {
      // If the error is due to rate limiting, skip the test
      if (result.error?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error);
        return;
      }
      // For other errors, fail the test
      throw new Error(result.error || 'Unknown error occurred');
    }

    // Add logging to help debug search issues
    console.log('\n=== Searching for authentication component ===');
    const newComponents = await chromaConnector.search('authentication', { 
      limit: 10, 
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc',
      types: ['command']
    });
    console.log('Found components:', JSON.stringify(newComponents.map(c => ({
      type: c.component.type,
      name: c.component.name,
      score: c.score,
      distance: c.distance
    })), null, 2));

    // Verify the component was created with proper context
    expect(newComponents.length).toBeGreaterThan(0);
    expect(newComponents[0].component.type).toBe('command');
    expect(newComponents[0].component.content).toContain('System.component');
    expect(newComponents[0].component.content).toContain('ComponentType.COMMAND');
  }, { timeout: 30000 });

  it('should handle validation errors', async () => {
    const input = '';
    const result = await runDslEditor(input, chromaConnector, true);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No command provided');
  });

  it('should create a workflow component', async () => {
    const input = 'Create a workflow component for user registration process';
    const result = await runDslEditor(input, chromaConnector, true);
    
    expect(result).toBeDefined();
    
    if (!result.success) {
      // If the error is due to rate limiting, skip the test
      if (result.error?.message?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error.message);
        return;
      }
      // For other errors, fail the test
      throw result.error;
    }

    if (!result.success || !result.component) {
      throw new Error('Failed to create workflow component');
    }
    
    const component = result.component as Component;
    expect(component.type).toBe('workflow');
    expect(component.content).toContain('System.component');
    expect(component.content).toContain('ComponentType.WORKFLOW');
    expect(component.content).toContain('steps');
  }, { timeout: 30000 });

  it('should include proper metadata in created components', async () => {
    const input = 'Create a command component for user login';
    const result = await runDslEditor(input, chromaConnector, true);
    
    expect(result).toBeDefined();
    
    if (!result.success) {
      // If the error is due to rate limiting, skip the test
      if (result.error?.message?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error.message);
        return;
      }
      // For other errors, fail the test
      throw result.error;
    }

    if (!result.success || !result.component) {
      throw new Error('Failed to create command component');
    }
    
    const component = result.component as Component;
    expect(component.metadata).toBeDefined();
    expect(component.metadata.description).toBeDefined();
    expect(component.metadata.path).toBeDefined();
    expect(component.metadata.createdAt).toBeDefined();
    expect(component.metadata.tags).toBeDefined();
    expect(Array.isArray(component.metadata.tags)).toBe(true);
  }, { timeout: 30000 });

  it('should process component creation request with relevant context', async () => {
    // First, search for relevant components using the user's request
    const userRequest = 'Create a command component for user authentication';
    const relevantComponents = await chromaConnector.search(userRequest, { 
      limit: 10, 
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    console.log('\n=== Relevant Components Found ===');
    console.log(JSON.stringify(relevantComponents.map(c => ({
      type: c.component.type,
      name: c.component.name,
      score: c.score,
      description: c.component.metadata?.description || ''
    })), null, 2));

    // Verify that we found relevant components including the system
    expect(relevantComponents.length).toBeGreaterThan(0);
    const hasSystem = relevantComponents.some(c => c.component.type === 'system');
    expect(hasSystem).toBe(true);

    // Process the request
    const result = await runDslEditor(userRequest, chromaConnector, true);
    expect(result).toBeDefined();
    
    if (!result.success) {
      if (result.error?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error);
        return;
      }
      throw new Error(result.error || 'Unknown error occurred');
    }

    // Verify the created component
    expect(result.component).toBeDefined();
    const component = result.component as Component;
    expect(component.type).toBe('command');
    expect(component.name).toBe('UserAuthentication');
    expect(component.content).toContain('System.component');
    expect(component.content).toContain('ComponentType.COMMAND');

    // Verify the component was stored in ChromaDB
    const storedComponents = await chromaConnector.search('UserAuthentication', { 
      limit: 10, 
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    console.log('\n=== Stored Components After Creation ===');
    console.log(JSON.stringify(storedComponents.map(c => ({
      type: c.component.type,
      name: c.component.name,
      score: c.score,
      description: c.component.metadata?.description || ''
    })), null, 2));

    // Verify the component exists in ChromaDB with correct properties
    const storedComponent = storedComponents.find(c => 
      c.component.name === 'UserAuthentication' && 
      c.component.type === 'command'
    );
    expect(storedComponent).toBeDefined();
    expect(storedComponent?.component.content).toContain('System.component');
    expect(storedComponent?.component.content).toContain('ComponentType.COMMAND');
    expect(storedComponent?.component.metadata?.description).toBe(userRequest);
  }, { timeout: 30000 });
}); 