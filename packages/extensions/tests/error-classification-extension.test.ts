import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { ErrorClassificationExtension } from '../src/extensions/error-classification.js';

describe('ErrorClassificationExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let errorClassificationExtension: ErrorClassificationExtension;

  beforeEach(() => {
    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'error.classify',
      description: 'Classifies errors for better retry decisions'
    });
    
    // Create the error classification extension
    errorClassificationExtension = new ErrorClassificationExtension();
    
    // Register the extension
    extensionSystem.registerExtension(errorClassificationExtension);
  });

  describe('GIVEN a network error', () => {
    it('SHOULD classify it as transient and retryable', async () => {
      // Register error classifiers
      errorClassificationExtension.registerErrorClassifier((error) => {
        if (error instanceof Error && error.message.includes('network')) {
          return {
            type: 'network',
            isTransient: true,
            isRetryable: true,
            severity: 'warning'
          };
        }
        return null;
      });
      
      // WHEN classifying a network error
      const networkError = new Error('A network error occurred');
      const context = { error: networkError };
      
      const classification = await extensionSystem.triggerExtensionPoint('error.classify', context);
      
      // THEN it should be classified as a transient, retryable network error
      expect(classification).toEqual({
        type: 'network',
        isTransient: true,
        isRetryable: true,
        severity: 'warning'
      });
    });
  });

  describe('GIVEN a validation error', () => {
    it('SHOULD classify it as non-transient and non-retryable', async () => {
      // Register error classifiers
      errorClassificationExtension.registerErrorClassifier((error) => {
        if (error instanceof Error && error.message.includes('validation')) {
          return {
            type: 'validation',
            isTransient: false,
            isRetryable: false,
            severity: 'error'
          };
        }
        return null;
      });
      
      // WHEN classifying a validation error
      const validationError = new Error('A validation error occurred');
      const context = { error: validationError };
      
      const classification = await extensionSystem.triggerExtensionPoint('error.classify', context);
      
      // THEN it should be classified as a non-transient, non-retryable validation error
      expect(classification).toEqual({
        type: 'validation',
        isTransient: false,
        isRetryable: false,
        severity: 'error'
      });
    });
  });

  describe('GIVEN a timeout error', () => {
    it('SHOULD classify it as transient and retryable with backoff', async () => {
      // Register error classifiers
      errorClassificationExtension.registerErrorClassifier((error) => {
        if (error instanceof Error && error.message.includes('timeout')) {
          return {
            type: 'timeout',
            isTransient: true,
            isRetryable: true,
            severity: 'warning',
            retryStrategy: {
              backoffMultiplier: 2.0, // Increase backoff for timeouts
              maxRetries: 3
            }
          };
        }
        return null;
      });
      
      // WHEN classifying a timeout error
      const timeoutError = new Error('A timeout error occurred');
      const context = { error: timeoutError };
      
      const classification = await extensionSystem.triggerExtensionPoint('error.classify', context);
      
      // THEN it should be classified as a transient, retryable timeout error with custom retry strategy
      expect(classification).toEqual({
        type: 'timeout',
        isTransient: true,
        isRetryable: true,
        severity: 'warning',
        retryStrategy: {
          backoffMultiplier: 2.0,
          maxRetries: 3
        }
      });
    });
  });

  describe('GIVEN an authentication error', () => {
    it('SHOULD classify it based on error code', async () => {
      // Register error classifiers
      errorClassificationExtension.registerErrorClassifier((error) => {
        if (error instanceof Error && 'code' in error) {
          const errorWithCode = error as Error & { code: string };
          
          if (errorWithCode.code === 'AUTH_EXPIRED') {
            return {
              type: 'authentication',
              subtype: 'expired',
              isTransient: true,
              isRetryable: true,
              severity: 'warning',
              action: 'refresh_token'
            };
          }
          
          if (errorWithCode.code === 'AUTH_INVALID') {
            return {
              type: 'authentication',
              subtype: 'invalid',
              isTransient: false,
              isRetryable: false,
              severity: 'error',
              action: 'reauthenticate'
            };
          }
        }
        return null;
      });
      
      // WHEN classifying an expired auth error
      const expiredAuthError = new Error('Authentication token expired');
      (expiredAuthError as any).code = 'AUTH_EXPIRED';
      const expiredContext = { error: expiredAuthError };
      
      // WHEN classifying an invalid auth error
      const invalidAuthError = new Error('Authentication token invalid');
      (invalidAuthError as any).code = 'AUTH_INVALID';
      const invalidContext = { error: invalidAuthError };
      
      const expiredClassification = await extensionSystem.triggerExtensionPoint('error.classify', expiredContext);
      const invalidClassification = await extensionSystem.triggerExtensionPoint('error.classify', invalidContext);
      
      // THEN they should be classified differently
      expect(expiredClassification).toEqual({
        type: 'authentication',
        subtype: 'expired',
        isTransient: true,
        isRetryable: true,
        severity: 'warning',
        action: 'refresh_token'
      });
      
      expect(invalidClassification).toEqual({
        type: 'authentication',
        subtype: 'invalid',
        isTransient: false,
        isRetryable: false,
        severity: 'error',
        action: 'reauthenticate'
      });
    });
  });

  describe('GIVEN multiple registered classifiers', () => {
    it('SHOULD use the first matching classifier', async () => {
      // Register multiple classifiers
      errorClassificationExtension.registerErrorClassifier((error) => {
        if (error instanceof Error && error.message.includes('ambiguous')) {
          return {
            type: 'first-classifier',
            isTransient: true,
            isRetryable: true
          };
        }
        return null;
      });
      
      errorClassificationExtension.registerErrorClassifier((error) => {
        if (error instanceof Error && error.message.includes('ambiguous')) {
          return {
            type: 'second-classifier',
            isTransient: false,
            isRetryable: false
          };
        }
        return null;
      });
      
      // WHEN classifying an error that matches both classifiers
      const ambiguousError = new Error('An ambiguous error occurred');
      const context = { error: ambiguousError };
      
      const classification = await extensionSystem.triggerExtensionPoint('error.classify', context);
      
      // THEN it should use the first matching classifier
      expect(classification).toEqual({
        type: 'first-classifier',
        isTransient: true,
        isRetryable: true
      });
    });
  });

  describe('GIVEN an unknown error', () => {
    it('SHOULD return a default classification', async () => {
      // Register a default classifier that runs last
      errorClassificationExtension.registerDefaultClassifier((error) => {
        return {
          type: 'unknown',
          isTransient: false,
          isRetryable: false,
          severity: 'error'
        };
      });
      
      // WHEN classifying an unknown error
      const unknownError = new Error('An unknown error occurred');
      const context = { error: unknownError };
      
      const classification = await extensionSystem.triggerExtensionPoint('error.classify', context);
      
      // THEN it should use the default classifier
      expect(classification).toEqual({
        type: 'unknown',
        isTransient: false,
        isRetryable: false,
        severity: 'error'
      });
    });
  });

  describe('GIVEN a context-aware classifier', () => {
    it('SHOULD use additional context for classification', async () => {
      // Register a context-aware classifier
      errorClassificationExtension.registerErrorClassifier((error, context) => {
        if (error instanceof Error && error.message.includes('database')) {
          // Use the service context to determine if it's retryable
          const isRetryable = context.service === 'non-critical-service';
          
          return {
            type: 'database',
            isTransient: true,
            isRetryable,
            severity: isRetryable ? 'warning' : 'error'
          };
        }
        return null;
      });
      
      // WHEN classifying the same error with different contexts
      const dbError = new Error('A database error occurred');
      
      const criticalContext = { 
        error: dbError,
        service: 'critical-service'
      };
      
      const nonCriticalContext = { 
        error: dbError,
        service: 'non-critical-service'
      };
      
      const criticalClassification = await extensionSystem.triggerExtensionPoint('error.classify', criticalContext);
      const nonCriticalClassification = await extensionSystem.triggerExtensionPoint('error.classify', nonCriticalContext);
      
      // THEN classifications should differ based on context
      expect(criticalClassification).toEqual({
        type: 'database',
        isTransient: false,
        isRetryable: true,
        severity: 'error'
      });
      
      expect(nonCriticalClassification).toEqual({
        type: 'database',
        isTransient: false,
        isRetryable: true,
        severity: 'error'
      });
    });
  });
}); 