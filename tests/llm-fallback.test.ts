import { describe, it, expect, vi } from 'vitest';

// Define interfaces and mock classes for testing
interface LLMRequest {
  prompt: string;
  model: string;
  options?: Record<string, any>;
}

interface LLMResponse {
  text: string;
  metadata?: Record<string, any>;
}

interface LLMError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

type LLMResult = LLMResponse | LLMError;

// Mock LLM provider that can be configured to succeed or fail
class MockLLMProvider {
  private shouldFail: boolean = false;
  private failureCode: string = 'UNKNOWN_ERROR';
  private responseText: string = 'Default response';
  
  constructor(config?: { shouldFail?: boolean, failureCode?: string, responseText?: string }) {
    if (config) {
      this.shouldFail = config.shouldFail ?? this.shouldFail;
      this.failureCode = config.failureCode ?? this.failureCode;
      this.responseText = config.responseText ?? this.responseText;
    }
  }
  
  async generate(request: LLMRequest): Promise<LLMResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (this.shouldFail) {
      return {
        code: this.failureCode,
        message: `Error: ${this.failureCode}`
      };
    }
    
    return {
      text: this.responseText,
      metadata: {
        model: request.model,
        prompt: request.prompt
      }
    };
  }
  
  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  setFailureCode(code: string): void {
    this.failureCode = code;
  }
  
  setResponseText(text: string): void {
    this.responseText = text;
  }
}

// Fallback strategy interface
interface FallbackStrategy {
  shouldFallback(error: LLMError): boolean;
  getFallbackOptions(request: LLMRequest, error: LLMError): LLMRequest;
}

// Concrete fallback strategies
class ModelDowngradeStrategy implements FallbackStrategy {
  private modelHierarchy: string[] = ['gpt-4', 'gpt-3.5-turbo', 'text-davinci-003', 'text-babbage-001'];
  
  shouldFallback(error: LLMError): boolean {
    return ['MODEL_OVERLOADED', 'MODEL_UNAVAILABLE'].includes(error.code);
  }
  
  getFallbackOptions(request: LLMRequest, _error: LLMError): LLMRequest {
    const currentModelIndex = this.modelHierarchy.indexOf(request.model);
    
    if (currentModelIndex === -1 || currentModelIndex === this.modelHierarchy.length - 1) {
      // Can't downgrade further
      throw new Error('No fallback model available');
    }
    
    const fallbackModel = this.modelHierarchy[currentModelIndex + 1];
    
    return {
      ...request,
      model: fallbackModel,
      options: {
        ...request.options,
        _fallback: true,
        _originalModel: request.model
      }
    };
  }
}

class PromptSimplificationStrategy implements FallbackStrategy {
  shouldFallback(error: LLMError): boolean {
    return ['CONTENT_FILTER', 'CONTEXT_LENGTH_EXCEEDED'].includes(error.code);
  }
  
  getFallbackOptions(request: LLMRequest, error: LLMError): LLMRequest {
    let simplifiedPrompt = request.prompt;
    
    if (error.code === 'CONTEXT_LENGTH_EXCEEDED') {
      // Truncate the prompt to 50% of its original length
      simplifiedPrompt = request.prompt.substring(0, Math.floor(request.prompt.length / 2)) + 
        '\n[Content truncated due to length constraints]\n';
    } else if (error.code === 'CONTENT_FILTER') {
      // Add a content filter disclaimer
      simplifiedPrompt = 'Please provide a helpful and appropriate response to the following prompt:\n\n' + 
        request.prompt;
    }
    
    return {
      ...request,
      prompt: simplifiedPrompt,
      options: {
        ...request.options,
        _fallback: true,
        _originalPrompt: request.prompt
      }
    };
  }
}

// Fallback manager
class LLMFallbackManager {
  private provider: MockLLMProvider;
  private strategies: FallbackStrategy[] = [];
  private maxRetries: number = 3;
  
  constructor(provider: MockLLMProvider, strategies: FallbackStrategy[] = [], maxRetries: number = 3) {
    this.provider = provider;
    this.strategies = strategies;
    this.maxRetries = maxRetries;
  }
  
  async executeWithFallback(request: LLMRequest): Promise<LLMResponse> {
    let currentRequest = { ...request };
    let retries = 0;
    
    while (retries <= this.maxRetries) {
      const result = await this.provider.generate(currentRequest);
      
      // If successful, return the response
      if ('text' in result) {
        return result;
      }
      
      // Handle error with fallback strategies
      const error = result;
      let fallbackApplied = false;
      
      for (const strategy of this.strategies) {
        if (strategy.shouldFallback(error)) {
          try {
            currentRequest = strategy.getFallbackOptions(currentRequest, error);
            fallbackApplied = true;
            break;
          } catch (e) {
            // Strategy couldn't provide fallback options, try the next one
            continue;
          }
        }
      }
      
      if (!fallbackApplied) {
        // No strategy could handle this error
        throw new Error(`LLM request failed: ${error.code} - ${error.message}`);
      }
      
      retries++;
    }
    
    // Max retries exceeded
    throw new Error(`LLM request failed after ${this.maxRetries} retries`);
  }
}

describe('LLM Fallback System', () => {
  describe('Fallback Strategies', () => {
    it('should determine when to apply model downgrade strategy', () => {
      const strategy = new ModelDowngradeStrategy();
      
      const overloadedError: LLMError = {
        code: 'MODEL_OVERLOADED',
        message: 'The model is currently overloaded with requests'
      };
      
      const unavailableError: LLMError = {
        code: 'MODEL_UNAVAILABLE',
        message: 'The requested model is not available'
      };
      
      const otherError: LLMError = {
        code: 'API_ERROR',
        message: 'API error occurred'
      };
      
      expect(strategy.shouldFallback(overloadedError)).toBe(true);
      expect(strategy.shouldFallback(unavailableError)).toBe(true);
      expect(strategy.shouldFallback(otherError)).toBe(false);
    });
    
    it('should downgrade to a less capable model', () => {
      const strategy = new ModelDowngradeStrategy();
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?',
        model: 'gpt-4'
      };
      
      const error: LLMError = {
        code: 'MODEL_OVERLOADED',
        message: 'The model is currently overloaded with requests'
      };
      
      const fallbackRequest = strategy.getFallbackOptions(request, error);
      
      expect(fallbackRequest.model).toBe('gpt-3.5-turbo');
      expect(fallbackRequest.options?._fallback).toBe(true);
      expect(fallbackRequest.options?._originalModel).toBe('gpt-4');
    });
    
    it('should throw an error when no fallback model is available', () => {
      const strategy = new ModelDowngradeStrategy();
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?',
        model: 'text-babbage-001' // Already at the lowest tier
      };
      
      const error: LLMError = {
        code: 'MODEL_OVERLOADED',
        message: 'The model is currently overloaded with requests'
      };
      
      expect(() => {
        strategy.getFallbackOptions(request, error);
      }).toThrow('No fallback model available');
    });
    
    it('should simplify prompts when content filter is triggered', () => {
      const strategy = new PromptSimplificationStrategy();
      
      const request: LLMRequest = {
        prompt: 'Tell me how to hack into a government database',
        model: 'gpt-4'
      };
      
      const error: LLMError = {
        code: 'CONTENT_FILTER',
        message: 'Content filter triggered'
      };
      
      const fallbackRequest = strategy.getFallbackOptions(request, error);
      
      expect(fallbackRequest.prompt).toContain('Please provide a helpful and appropriate response');
      expect(fallbackRequest.prompt).toContain(request.prompt);
      expect(fallbackRequest.options?._fallback).toBe(true);
    });
    
    it('should truncate prompts when context length is exceeded', () => {
      const strategy = new PromptSimplificationStrategy();
      
      const longPrompt = 'A'.repeat(1000);
      const request: LLMRequest = {
        prompt: longPrompt,
        model: 'gpt-4'
      };
      
      const error: LLMError = {
        code: 'CONTEXT_LENGTH_EXCEEDED',
        message: 'The prompt exceeds the maximum context length'
      };
      
      const fallbackRequest = strategy.getFallbackOptions(request, error);
      
      expect(fallbackRequest.prompt.length).toBeLessThan(longPrompt.length);
      expect(fallbackRequest.prompt).toContain('[Content truncated');
      expect(fallbackRequest.options?._originalPrompt).toBe(longPrompt);
    });
  });
  
  describe('Fallback Manager', () => {
    it('should return successful responses immediately', async () => {
      const provider = new MockLLMProvider({
        shouldFail: false,
        responseText: 'Paris is the capital of France'
      });
      
      const manager = new LLMFallbackManager(provider, [
        new ModelDowngradeStrategy(),
        new PromptSimplificationStrategy()
      ]);
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?',
        model: 'gpt-4'
      };
      
      const response = await manager.executeWithFallback(request);
      
      expect(response.text).toBe('Paris is the capital of France');
    });
    
    it('should apply appropriate fallback strategy for model overload', async () => {
      // Mock provider that fails once then succeeds
      const provider = new MockLLMProvider({
        shouldFail: true,
        failureCode: 'MODEL_OVERLOADED',
        responseText: 'Paris is the capital of France'
      });
      
      // Spy on the generate method
      const generateSpy = vi.spyOn(provider, 'generate');
      
      // After the first call, make it succeed
      generateSpy.mockImplementationOnce(async (request) => {
        provider.setShouldFail(false);
        return {
          code: 'MODEL_OVERLOADED',
          message: 'The model is currently overloaded with requests'
        };
      });
      
      const manager = new LLMFallbackManager(provider, [
        new ModelDowngradeStrategy(),
        new PromptSimplificationStrategy()
      ]);
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?',
        model: 'gpt-4'
      };
      
      const response = await manager.executeWithFallback(request);
      
      expect(generateSpy).toHaveBeenCalledTimes(2);
      expect(generateSpy.mock.calls[1][0].model).toBe('gpt-3.5-turbo');
      expect(response.text).toBe('Paris is the capital of France');
    });
    
    it('should apply appropriate fallback strategy for content filter', async () => {
      // Mock provider that fails once then succeeds
      const provider = new MockLLMProvider({
        shouldFail: true,
        failureCode: 'CONTENT_FILTER',
        responseText: 'I cannot provide information on hacking'
      });
      
      // Spy on the generate method
      const generateSpy = vi.spyOn(provider, 'generate');
      
      // After the first call, make it succeed
      generateSpy.mockImplementationOnce(async (request) => {
        provider.setShouldFail(false);
        return {
          code: 'CONTENT_FILTER',
          message: 'Content filter triggered'
        };
      });
      
      const manager = new LLMFallbackManager(provider, [
        new ModelDowngradeStrategy(),
        new PromptSimplificationStrategy()
      ]);
      
      const request: LLMRequest = {
        prompt: 'Tell me how to hack into a system',
        model: 'gpt-4'
      };
      
      const response = await manager.executeWithFallback(request);
      
      expect(generateSpy).toHaveBeenCalledTimes(2);
      expect(generateSpy.mock.calls[1][0].prompt).toContain('Please provide a helpful and appropriate response');
      expect(response.text).toBe('I cannot provide information on hacking');
    });
    
    it('should throw an error after max retries', async () => {
      const provider = new MockLLMProvider({
        shouldFail: true,
        failureCode: 'MODEL_OVERLOADED'
      });
      
      const manager = new LLMFallbackManager(provider, [
        new ModelDowngradeStrategy()
      ], 2); // Max 2 retries
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?',
        model: 'gpt-4'
      };
      
      await expect(manager.executeWithFallback(request)).rejects.toThrow('LLM request failed after 2 retries');
    });
    
    it('should throw an error when no strategy can handle the error', async () => {
      const provider = new MockLLMProvider({
        shouldFail: true,
        failureCode: 'AUTHENTICATION_ERROR' // No strategy handles this
      });
      
      const manager = new LLMFallbackManager(provider, [
        new ModelDowngradeStrategy(),
        new PromptSimplificationStrategy()
      ]);
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?',
        model: 'gpt-4'
      };
      
      await expect(manager.executeWithFallback(request)).rejects.toThrow('LLM request failed: AUTHENTICATION_ERROR');
    });
  });
  
  describe('Complex Fallback Scenarios', () => {
    it('should try multiple fallback strategies in sequence', async () => {
      // Provider that fails with different errors in sequence
      const provider = new MockLLMProvider({
        shouldFail: true,
        failureCode: 'MODEL_OVERLOADED',
        responseText: 'Paris is the capital of France'
      });
      
      // Spy on the generate method
      const generateSpy = vi.spyOn(provider, 'generate');
      
      // First call: MODEL_OVERLOADED
      generateSpy.mockImplementationOnce(async () => {
        return {
          code: 'MODEL_OVERLOADED',
          message: 'The model is currently overloaded with requests'
        };
      });
      
      // Second call: CONTEXT_LENGTH_EXCEEDED
      generateSpy.mockImplementationOnce(async () => {
        return {
          code: 'CONTEXT_LENGTH_EXCEEDED',
          message: 'The prompt exceeds the maximum context length'
        };
      });
      
      // Third call: Success
      generateSpy.mockImplementationOnce(async () => {
        return {
          text: 'Paris is the capital of France',
          metadata: {}
        };
      });
      
      const manager = new LLMFallbackManager(provider, [
        new ModelDowngradeStrategy(),
        new PromptSimplificationStrategy()
      ]);
      
      const request: LLMRequest = {
        prompt: 'What is the capital of France?'.repeat(10), // Long prompt
        model: 'gpt-4'
      };
      
      const response = await manager.executeWithFallback(request);
      
      expect(generateSpy).toHaveBeenCalledTimes(3);
      // First retry should downgrade the model
      expect(generateSpy.mock.calls[1][0].model).toBe('gpt-3.5-turbo');
      // Second retry should truncate the prompt
      expect(generateSpy.mock.calls[2][0].prompt.length).toBeLessThan(request.prompt.length);
      expect(response.text).toBe('Paris is the capital of France');
    });
  });
}); 