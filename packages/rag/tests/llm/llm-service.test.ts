import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMService, LLMServiceConfig } from '../../src/llm/llm-service.js';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { Component, ComponentType } from '../../src/models.js';

// Mock ChromaDBConnector
vi.mock('../../src/vector-db/chroma-connector.js');

describe('LLMService', () => {
  let llmService: LLMService;
  let mockVectorDB: ChromaDBConnector;

  const createMockResponse = (data: any, ok = true): Response => {
    return {
      ok,
      json: () => Promise.resolve(data),
      headers: new Headers(),
      redirected: false,
      status: ok ? 200 : 400,
      statusText: ok ? 'OK' : 'Bad Request',
      type: 'basic',
      url: 'https://api.test.com',
      clone: function(): Response { return this; },
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(''),
    } as Response;
  };

  beforeEach(() => {
    // Reset environment and mocks before each test
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    
    mockVectorDB = {
      search: vi.fn(),
      addComponent: vi.fn(),
      deleteComponent: vi.fn(),
      updateComponent: vi.fn(),
      getComponent: vi.fn(),
    } as unknown as ChromaDBConnector;

    const config: LLMServiceConfig = {
      vectorDB: mockVectorDB,
      model: 'test-model',
      maxTokens: 100,
      temperature: 0.5
    };

    llmService = new LLMService(config);
  });

  describe('initialization', () => {
    it('should throw error when API key is not set', () => {
      delete process.env.OPENROUTER_API_KEY;
      expect(() => new LLMService()).toThrow('OPENROUTER_API_KEY environment variable is not set');
    });

    it('should initialize with default config when minimal config provided', () => {
      const service = new LLMService({ vectorDB: mockVectorDB });
      expect(service).toBeInstanceOf(LLMService);
    });
  });

  describe('getRelevantContext', () => {
    it('should return context from vector DB search results', async () => {
      const mockComponents: Component[] = [{
        id: '1',
        name: 'TestComponent',
        type: 'plugin' as ComponentType,
        content: 'test content',
        metadata: {
          description: 'test description',
          tags: ['test'],
          path: 'test/path',
          createdAt: Date.now(),
          author: 'test-author'
        }
      }];

      (mockVectorDB.search as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponents.map(component => ({
        component,
        score: 0.9
      })));

      const context = await llmService.getRelevantContext('test request', 'plugin' as ComponentType);
      expect(context).toContain('TestComponent');
      expect(context).toContain('test description');
      expect(mockVectorDB.search).toHaveBeenCalledWith('test request', {
        limit: 5,
        threshold: 0.7
      });
    });

    it('should return "No relevant context found" when no results', async () => {
      (mockVectorDB.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const context = await llmService.getRelevantContext('test request', 'plugin' as ComponentType);
      expect(context).toBe('No relevant context found.');
    });
  });

  describe('generateComponent', () => {
    const mockRequest = 'Create a user authentication function';
    const mockComponentType = 'plugin' as ComponentType;

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse({
          choices: [{
            message: {
              content: '// @component type:plugin\nfunction authenticate() {}'
            }
          }]
        }))
      );
    });

    it('should generate a component with correct structure', async () => {
      const component = await llmService.generateComponent(mockRequest, mockComponentType);
      
      expect(component).toHaveProperty('id');
      expect(component).toHaveProperty('name');
      expect(component).toHaveProperty('type', mockComponentType);
      expect(component).toHaveProperty('content');
      expect(component).toHaveProperty('metadata');
      expect(component.metadata).toHaveProperty('description', mockRequest);
      expect(component.metadata).toHaveProperty('tags');
      expect(component.metadata).toHaveProperty('path');
      expect(component.metadata).toHaveProperty('createdAt');
      expect(component.metadata).toHaveProperty('author');
    });

    it('should ensure component type annotation is present', async () => {
      vi.mocked(global.fetch).mockImplementationOnce(() =>
        Promise.resolve(createMockResponse({
          choices: [{
            message: {
              content: 'function authenticate() {}'
            }
          }]
        }))
      );

      const component = await llmService.generateComponent(mockRequest, mockComponentType);
      expect(component.content).toContain(`@component type:${mockComponentType}`);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(global.fetch).mockImplementationOnce(() =>
        Promise.resolve(createMockResponse({
          error: { message: 'API Error' }
        }, false))
      );

      await expect(llmService.generateComponent(mockRequest, mockComponentType))
        .rejects.toThrow('OpenRouter API error: API Error');
    });
  });

  describe('extractNameFromRequest', () => {
    const testCases = [
      {
        request: 'Create a user authentication function',
        type: 'plugin' as ComponentType,
        expected: 'userAuthentication'
      },
      {
        request: 'Implement user login command',
        type: 'command',
        expected: 'UserLoginCommand'
      },
      {
        request: 'Create user registered event',
        type: 'event',
        expected: 'UserRegisteredEvent'
      }
    ];

    testCases.forEach(({ request, type, expected }) => {
      it(`should extract name "${expected}" from "${request}"`, () => {
        // Using type assertion since these are private methods
        const name = (llmService as any).extractNameFromRequest(request, type);
        expect(name).toBe(expected);
      });
    });
  });

  describe('extractTagsFromRequest', () => {
    it('should extract relevant tags from request', () => {
      const request = 'Create a user payment validation function';
      const tags = (llmService as any).extractTagsFromRequest(request);
      expect(tags).toContain('user');
      expect(tags).toContain('payment');
      expect(tags).toContain('validation');
    });
  });

  describe('generateFeedback', () => {
    const mockComponent: Component = {
      id: '1',
      name: 'TestComponent',
      type: 'plugin' as ComponentType,
      content: 'function test() {}',
      metadata: {
        path: 'test/path',
        description: 'test description',
        tags: ['test'],
        createdAt: Date.now(),
        author: 'test-author'
      }
    };

    it('should generate feedback with required sections', async () => {
      vi.mocked(global.fetch).mockImplementationOnce(() =>
        Promise.resolve(createMockResponse({
          choices: [{
            message: {
              content: `1. Component Overview\n2. Implementation Details\n3. Best Practices Applied\n4. How to Use This Component\n5. How to Extend This Component`
            }
          }]
        }))
      );

      const feedback = await llmService.generateFeedback(mockComponent, 'test request');
      expect(feedback).toContain('Component Overview');
      expect(feedback).toContain('Implementation Details');
      expect(feedback).toContain('Best Practices Applied');
      expect(feedback).toContain('How to Use This Component');
      expect(feedback).toContain('How to Extend This Component');
    });
  });
}); 