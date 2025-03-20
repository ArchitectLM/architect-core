/**
 * LLM Service Interface
 * 
 * This module defines the interface for interacting with Large Language Models.
 * It provides a standardized way to generate responses from LLMs with various options.
 */

/**
 * Response format options for LLM requests
 */
export interface ResponseFormatOptions {
  /**
   * The type of response format
   */
  type: 'text' | 'json_object' | 'json_array';
}

/**
 * Options for LLM response generation
 */
export interface LLMResponseOptions {
  /**
   * The model to use for generation
   */
  model?: string;
  
  /**
   * Temperature setting (0.0 - 1.0)
   */
  temperature?: number;
  
  /**
   * Maximum number of tokens to generate
   */
  maxTokens?: number;
  
  /**
   * Response format specification
   */
  responseFormat?: ResponseFormatOptions;
  
  /**
   * System message to set context
   */
  systemMessage?: string;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  /**
   * The content of the response
   */
  content: string | any;
  
  /**
   * Metadata about the response
   */
  metadata?: {
    /**
     * Model used for generation
     */
    model?: string;
    
    /**
     * Tokens used for generation
     */
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    
    /**
     * Finish reason
     */
    finishReason?: string;
  };
}

/**
 * Interface for LLM services
 */
export interface LLMService {
  /**
   * Generates a response from the LLM
   * @param prompt The prompt to send to the LLM
   * @param options Options for response generation
   * @returns The LLM response
   */
  generateResponse(prompt: string, options?: LLMResponseOptions): Promise<LLMResponse>;
  
  /**
   * Adds a response handler for specific patterns
   * @param pattern The pattern to match
   * @param handler The handler function
   */
  addResponseHandler(pattern: RegExp, handler: (prompt: string, matches: RegExpMatchArray) => any): void;
} 