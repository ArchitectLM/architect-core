/**
 * Mock LLM Service
 * 
 * This module provides a mock implementation of the LLM service interface
 * for testing and development purposes. It allows for deterministic responses
 * and pattern-based response handlers.
 */

import type { LLMService, LLMResponse, LLMResponseOptions } from './llm-service';

/**
 * Configuration options for the mock LLM service
 */
export interface MockLLMServiceConfig {
  /**
   * Whether to log prompts to the console
   * @default false
   */
  logPrompts?: boolean;
  
  /**
   * Whether to simulate a delay in responses
   * @default false
   */
  simulateDelay?: boolean;
  
  /**
   * Default response to return when no pattern matches
   * @default "This is a mock response"
   */
  defaultResponse?: string | object;
  
  /**
   * Default delay in milliseconds for simulated responses
   * @default 500
   */
  defaultDelayMs?: number;
  
  /**
   * Whether to return invalid system responses for testing validation
   * @default false
   */
  shouldReturnInvalidSystem?: boolean;
}

/**
 * A mock implementation of the LLM service for testing
 */
export class MockLLMService implements LLMService {
  private config: Required<MockLLMServiceConfig>;
  private responseHandlers: Array<{
    pattern: RegExp;
    handler: (prompt: string, matches: RegExpMatchArray) => any;
  }> = [];
  private responseTemplates: Record<string, string | object> = {};
  
  /**
   * Creates a new mock LLM service
   * @param config Configuration options
   */
  constructor(config: MockLLMServiceConfig = {}) {
    this.config = {
      logPrompts: config.logPrompts ?? false,
      simulateDelay: config.simulateDelay ?? false,
      defaultResponse: config.defaultResponse ?? "This is a mock response",
      defaultDelayMs: config.defaultDelayMs ?? 500,
      shouldReturnInvalidSystem: config.shouldReturnInvalidSystem ?? false
    };
    
    // Initialize with some default response templates
    this.responseTemplates = {
      'system_description': 'This is a mock system description',
      'error_message': 'An error occurred while processing your request',
      'success_message': 'Your request was processed successfully'
    };
  }
  
  /**
   * Generates a response from the mock LLM
   * @param prompt The prompt to send
   * @param options Options for response generation
   * @returns The mock LLM response
   */
  async generateResponse(prompt: string, options?: LLMResponseOptions): Promise<LLMResponse> {
    if (this.config.logPrompts) {
      console.log('Mock LLM received prompt:', prompt);
      if (options) {
        console.log('With options:', JSON.stringify(options, null, 2));
      }
    }
    
    // Simulate delay if configured
    if (this.config.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.defaultDelayMs));
    }
    
    // Check for pattern matches
    for (const { pattern, handler } of this.responseHandlers) {
      const matches = prompt.match(pattern);
      if (matches) {
        const content = handler(prompt, matches);
        return this.formatResponse(content, options);
      }
    }
    
    // Return default response if no pattern matches
    return this.formatResponse(this.config.defaultResponse, options);
  }
  
  /**
   * Adds a response handler for specific patterns
   * @param pattern The pattern to match
   * @param handler The handler function
   */
  addResponseHandler(pattern: RegExp, handler: (prompt: string, matches: RegExpMatchArray) => any): void {
    this.responseHandlers.push({ pattern, handler });
  }
  
  /**
   * Adds a response template
   * @param key The template key
   * @param template The template content
   */
  addResponseTemplate(key: string, template: string | object): void {
    this.responseTemplates[key] = template;
  }
  
  /**
   * Gets a response template
   * @param key The template key
   * @returns The template content or undefined if not found
   */
  getResponseTemplate(key: string): string | object | undefined {
    return this.responseTemplates[key];
  }
  
  /**
   * Sets whether to return invalid system responses
   * @param value Whether to return invalid system responses
   */
  setShouldReturnInvalidSystem(value: boolean): void {
    this.config.shouldReturnInvalidSystem = value;
  }
  
  /**
   * Gets whether to return invalid system responses
   * @returns Whether to return invalid system responses
   */
  getShouldReturnInvalidSystem(): boolean {
    return this.config.shouldReturnInvalidSystem;
  }
  
  /**
   * Formats a response according to the options
   * @param content The response content
   * @param options The response options
   * @returns The formatted response
   * @private
   */
  private formatResponse(content: string | object, options?: LLMResponseOptions): LLMResponse {
    // If content is an object and options specify json_object format, return as is
    if (
      typeof content === 'object' && 
      options?.responseFormat?.type === 'json_object'
    ) {
      return {
        content,
        metadata: {
          model: options?.model || 'mock-model',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30
          },
          finishReason: 'stop'
        }
      };
    }
    
    // If content is a string and options specify json_object format, try to parse it
    if (
      typeof content === 'string' && 
      options?.responseFormat?.type === 'json_object'
    ) {
      try {
        // If it's already JSON, parse it
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
          return {
            content: JSON.parse(content),
            metadata: {
              model: options?.model || 'mock-model',
              usage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30
              },
              finishReason: 'stop'
            }
          };
        }
        
        // Otherwise, return as a JSON object with a content property
        return {
          content: { content },
          metadata: {
            model: options?.model || 'mock-model',
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30
            },
            finishReason: 'stop'
          }
        };
      } catch (error) {
        // If parsing fails, return as a string
        return {
          content,
          metadata: {
            model: options?.model || 'mock-model',
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30
            },
            finishReason: 'stop'
          }
        };
      }
    }
    
    // Default case: return as is
    return {
      content,
      metadata: {
        model: options?.model || 'mock-model',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        },
        finishReason: 'stop'
      }
    };
  }
} 