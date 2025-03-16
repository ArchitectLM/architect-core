/**
 * Tests for Mock LLM Service
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock implementations for testing
interface MockLLMServiceConfig {
  logPrompts?: boolean;
  simulateDelay?: boolean;
  delayRange?: [number, number];
  responseHandlers?: Array<{
    pattern: RegExp;
    handler: (prompt: string, matches: RegExpMatchArray) => any;
  }>;
  defaultResponseGenerator?: (prompt: string) => any;
}

interface LLMResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

// Mock LLM service for testing
class MockLLMService {
  private config: MockLLMServiceConfig;
  private responseTemplates: Record<string, any>;
  private responseHandlers: Array<{
    pattern: RegExp;
    handler: (prompt: string, matches: RegExpMatchArray) => any;
  }>;
  
  constructor(config: MockLLMServiceConfig = {}) {
    this.config = {
      logPrompts: true,
      simulateDelay: true,
      delayRange: [300, 1200],
      ...config
    };
    
    this.responseTemplates = {};
    this.responseHandlers = config.responseHandlers || [];
  }
  
  async generateResponse(prompt: string, options: { model?: string } = {}): Promise<LLMResponse> {
    // Log the prompt if configured to do so
    if (this.config.logPrompts) {
      console.log('Mock LLM Service received prompt:', prompt);
    }
    
    // Check if any custom response handlers match the prompt
    for (const { pattern, handler } of this.responseHandlers) {
      const matches = prompt.match(pattern);
      if (matches) {
        const response = handler(prompt, matches);
        return this.formatResponse(response, options.model);
      }
    }
    
    // Use the default response generator if provided
    if (this.config.defaultResponseGenerator) {
      const response = this.config.defaultResponseGenerator(prompt);
      return this.formatResponse(response, options.model);
    }
    
    // Return a default response
    return this.formatResponse('This is a mock response from the LLM service.', options.model);
  }
  
  private formatResponse(response: any, model?: string): LLMResponse {
    // If the response is already in the correct format, return it
    if (typeof response === 'object' && response.content) {
      return response;
    }
    
    // Convert the response to a string if it's not already
    const content = typeof response === 'string' 
      ? response 
      : JSON.stringify(response, null, 2);
    
    // Create a mock usage object
    const usage = {
      promptTokens: Math.floor(Math.random() * 500) + 100,
      completionTokens: Math.floor(Math.random() * 1000) + 200,
      totalTokens: 0
    };
    
    usage.totalTokens = usage.promptTokens + usage.completionTokens;
    
    return {
      content,
      model: model || 'mock-gpt-4',
      usage,
      metadata: {
        timestamp: new Date().toISOString(),
        mock: true
      }
    };
  }
  
  addResponseHandler(pattern: RegExp, handler: (prompt: string, matches: RegExpMatchArray) => any): void {
    this.responseHandlers.push({ pattern, handler });
  }
  
  setDefaultResponseGenerator(generator: (prompt: string) => any): void {
    this.config.defaultResponseGenerator = generator;
  }
  
  addResponseTemplate(key: string, template: any): void {
    this.responseTemplates[key] = template;
  }
  
  // Helper method for testing to expose templates
  getResponseTemplate(key: string): any {
    return this.responseTemplates[key];
  }
}

function createMockLLMService(config?: MockLLMServiceConfig): MockLLMService {
  return new MockLLMService(config);
}

describe('MockLLMService', () => {
  let mockLLMService: MockLLMService;
  
  beforeEach(() => {
    // Create a fresh instance for each test
    mockLLMService = createMockLLMService({
      logPrompts: false,
      simulateDelay: false
    });
  });
  
  describe('constructor', () => {
    it('should create a mock LLM service with default configuration', () => {
      // Act
      const service = createMockLLMService();
      
      // Assert
      expect(service).toBeInstanceOf(MockLLMService);
    });
    
    it('should create a mock LLM service with custom configuration', () => {
      // Arrange
      const config: MockLLMServiceConfig = {
        logPrompts: true,
        simulateDelay: true,
        delayRange: [100, 200]
      };
      
      // Act
      const service = createMockLLMService(config);
      
      // Assert
      expect(service).toBeInstanceOf(MockLLMService);
    });
  });
  
  describe('generateResponse', () => {
    it('should generate a response for a prompt', async () => {
      // Act
      const response = await mockLLMService.generateResponse('Test prompt');
      
      // Assert
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.model).toBeDefined();
      expect(response.usage).toBeDefined();
    });
    
    it('should use custom response handlers when patterns match', async () => {
      // Arrange
      mockLLMService.addResponseHandler(
        /custom pattern/i,
        () => 'Custom response'
      );
      
      // Act
      const response = await mockLLMService.generateResponse('This is a custom pattern test');
      
      // Assert
      expect(response.content).toBe('Custom response');
    });
    
    it('should use the default response generator when no patterns match', async () => {
      // Arrange
      const defaultResponse = 'Default response';
      mockLLMService.setDefaultResponseGenerator(() => defaultResponse);
      
      // Act
      const response = await mockLLMService.generateResponse('This does not match any patterns');
      
      // Assert
      expect(response.content).toBe(defaultResponse);
    });
    
    it('should respect the model parameter', async () => {
      // Arrange
      const customModel = 'custom-model';
      
      // Act
      const response = await mockLLMService.generateResponse('Test prompt', { model: customModel });
      
      // Assert
      expect(response.model).toBe(customModel);
    });
  });
  
  describe('addResponseHandler', () => {
    it('should add a custom response handler', async () => {
      // Arrange
      const pattern = /specific pattern/i;
      const customResponse = 'Specific response';
      
      // Act
      mockLLMService.addResponseHandler(pattern, () => customResponse);
      const response = await mockLLMService.generateResponse('This contains a specific pattern to match');
      
      // Assert
      expect(response.content).toBe(customResponse);
    });
    
    it('should handle multiple response handlers in order', async () => {
      // Arrange
      mockLLMService.addResponseHandler(/first pattern/i, () => 'First response');
      mockLLMService.addResponseHandler(/second pattern/i, () => 'Second response');
      
      // Act
      const response1 = await mockLLMService.generateResponse('This contains a first pattern to match');
      const response2 = await mockLLMService.generateResponse('This contains a second pattern to match');
      
      // Assert
      expect(response1.content).toBe('First response');
      expect(response2.content).toBe('Second response');
    });
    
    it('should pass regex matches to the handler', async () => {
      // Arrange
      const pattern = /extract this: (\w+)/i;
      mockLLMService.addResponseHandler(pattern, (_, matches) => matches[1]);
      
      // Act
      const response = await mockLLMService.generateResponse('Please extract this: value123');
      
      // Assert
      expect(response.content).toBe('value123');
    });
  });
  
  describe('addResponseTemplate', () => {
    it('should add a response template that can be used by handlers', async () => {
      // Arrange
      const templateKey = 'testTemplate';
      const templateValue = { key: 'value' };
      
      // First add the template
      mockLLMService.addResponseTemplate(templateKey, templateValue);
      
      // Then add a handler that uses it
      mockLLMService.addResponseHandler(
        /use template/i,
        () => mockLLMService.getResponseTemplate('testTemplate')
      );
      
      // Act
      const response = await mockLLMService.generateResponse('Please use template');
      
      // Assert
      expect(JSON.parse(response.content)).toEqual(templateValue);
    });
  });
}); 