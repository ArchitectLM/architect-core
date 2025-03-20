/**
 * Retry Policy Extension
 * 
 * This extension implements retry policies with exponential backoff
 * and error classification.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Retry policy options
 */
export interface RetryPolicyOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

/**
 * Error classification function
 */
export type ErrorClassifier = (error: Error) => boolean;

/**
 * Retry Policy Extension
 */
export class RetryPolicyExtension implements Extension {
  name = 'retry-policy';
  description = 'Implements retry policies with exponential backoff';

  private options: RetryPolicyOptions;
  private errorClassifiers: Map<string, ErrorClassifier> = new Map();

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  constructor(options: Partial<RetryPolicyOptions> = {}) {
    this.options = {
      maxAttempts: options.maxAttempts || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      backoffFactor: options.backoffFactor || 2,
      jitter: options.jitter ?? true
    };
  }

  /**
   * Register an error classifier
   */
  registerErrorClassifier(operationId: string, classifier: ErrorClassifier): void {
    this.errorClassifiers.set(operationId, classifier);
  }

  /**
   * Unregister an error classifier
   */
  unregisterErrorClassifier(operationId: string): void {
    this.errorClassifiers.delete(operationId);
  }

  /**
   * Execute an operation with retry policy
   */
  async execute<T>(
    operationId: string,
    operation: () => Promise<T>,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.options.maxAttempts) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Check if we should retry
        if (!this.shouldRetry(operationId, lastError, attempt)) {
          if (eventBus) {
            eventBus.publish('retry:failed', {
              operationId,
              error: lastError,
              attempt
            });
          }
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        if (eventBus) {
          eventBus.publish('retry:attempt', {
            operationId,
            error: lastError,
            attempt,
            delay
          });
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (eventBus) {
      eventBus.publish('retry:exhausted', {
        operationId,
        error: lastError,
        attempt
      });
    }

    throw lastError;
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetry(operationId: string, error: Error, attempt: number): boolean {
    if (attempt >= this.options.maxAttempts) {
      return false;
    }

    const classifier = this.errorClassifiers.get(operationId);
    if (classifier) {
      return classifier(error);
    }

    // Default behavior: retry on any error
    return true;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.options.initialDelay * Math.pow(this.options.backoffFactor, attempt - 1),
      this.options.maxDelay
    );

    if (this.options.jitter) {
      return delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { eventType, event } = context;

    // Check if this is a retry event
    if (eventType.startsWith('retry:')) {
      // Handle retry events if needed
    }

    return context;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.errorClassifiers.clear();
  }
} 