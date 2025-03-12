/**
 * LLM Fallback System
 * 
 * This module provides functionality for handling LLM failures and implementing
 * fallback mechanisms to ensure system reliability.
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
}

/**
 * Result of an operation with potential fallback
 */
export interface OperationResult<T> {
  result: T | null;
  usedFallback: boolean;
  attempts: number;
  error?: Error;
  metadata: {
    totalTimeMs: number;
    attemptTimes: number[];
  };
}

/**
 * Manager for LLM fallback mechanisms
 */
export class LLMFallbackManager {
  private fallbackTemplates: Map<string, any> = new Map();
  
  /**
   * Create a new fallback manager
   */
  constructor(
    private retryConfig: RetryConfig = {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 10000
    }
  ) {}
  
  /**
   * Register a fallback template
   */
  registerFallbackTemplate(key: string, template: any): void {
    this.fallbackTemplates.set(key, template);
  }
  
  /**
   * Get a fallback template by key
   */
  getFallbackTemplate(key: string): any {
    return this.fallbackTemplates.get(key);
  }
  
  /**
   * Execute an operation with retry and fallback
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    fallbackKey: string
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let delay = this.retryConfig.initialDelayMs;
    const attemptTimes: number[] = [];
    let lastError: Error | undefined;
    
    while (attempts < this.retryConfig.maxAttempts) {
      const attemptStartTime = Date.now();
      try {
        attempts++;
        const result = await operation();
        
        attemptTimes.push(Date.now() - attemptStartTime);
        
        return {
          result,
          usedFallback: false,
          attempts,
          metadata: {
            totalTimeMs: Date.now() - startTime,
            attemptTimes
          }
        };
      } catch (error) {
        attemptTimes.push(Date.now() - attemptStartTime);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempts >= this.retryConfig.maxAttempts) {
          // All attempts failed, use fallback
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(
          delay * this.retryConfig.backoffFactor,
          this.retryConfig.maxDelayMs
        );
      }
    }
    
    // All attempts failed, use fallback
    const fallback = this.getFallbackTemplate(fallbackKey);
    
    return {
      result: fallback,
      usedFallback: true,
      attempts,
      error: lastError,
      metadata: {
        totalTimeMs: Date.now() - startTime,
        attemptTimes
      }
    };
  }
  
  /**
   * Degrade gracefully when LLM services are unavailable
   */
  degradeGracefully(error: Error, context: any): any {
    // Implement graceful degradation based on error and context
    const errorMessage = error.message.toLowerCase();
    
    // Handle rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return {
        degraded: true,
        reason: 'rate-limited',
        message: 'Service is currently rate limited. Using simplified functionality.',
        fallbackMode: 'simplified'
      };
    }
    
    // Handle service unavailability
    if (errorMessage.includes('unavailable') || errorMessage.includes('down') || 
        errorMessage.includes('timeout')) {
      return {
        degraded: true,
        reason: 'service-unavailable',
        message: 'Service is currently unavailable. Using offline mode.',
        fallbackMode: 'offline'
      };
    }
    
    // Handle authentication/authorization issues
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication') ||
        errorMessage.includes('permission')) {
      return {
        degraded: true,
        reason: 'auth-error',
        message: 'Authentication error. Using local processing only.',
        fallbackMode: 'local-only'
      };
    }
    
    // Default degradation
    return {
      degraded: true,
      reason: 'unknown-error',
      message: 'An error occurred. Using default functionality.',
      fallbackMode: 'default',
      context: context
    };
  }
}

/**
 * Common fallback templates for reactive systems
 */
export const commonFallbackTemplates: Record<string, any> = {
  'system-definition': {
    id: 'fallback-system',
    name: 'Default System',
    version: '1.0.0',
    description: 'A default system generated due to LLM service unavailability',
    boundedContexts: {
      'core': {
        id: 'core',
        name: 'Core Context',
        description: 'Core functionality',
        processes: []
      }
    },
    processes: {},
    tasks: {},
    flows: {},
    metadata: {
      generatedBy: 'fallback-mechanism',
      requiresReview: true
    }
  },
  
  'process-definition': {
    id: 'fallback-process',
    name: 'Default Process',
    type: 'stateless',
    description: 'A default process generated due to LLM service unavailability',
    tasks: [],
    metadata: {
      generatedBy: 'fallback-mechanism',
      requiresReview: true
    }
  }
};

/**
 * Create and initialize a fallback manager with common templates
 */
export function createFallbackManager(config?: RetryConfig): LLMFallbackManager {
  const manager = new LLMFallbackManager(config);
  
  // Register common fallback templates
  Object.entries(commonFallbackTemplates).forEach(([key, template]) => {
    manager.registerFallbackTemplate(key, template);
  });
  
  return manager;
} 