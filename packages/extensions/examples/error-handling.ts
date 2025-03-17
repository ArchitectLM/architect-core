/**
 * @file Example of comprehensive error handling with classification and recovery
 * @module @architectlm/extensions/examples
 */

import { DefaultExtensionSystem } from '../src/extension-system.js';
import { ErrorClassificationExtension } from '../src/extensions/error-classification.js';
import { ErrorRecoveryExtension, RecoveryStrategy, RecoveryContext } from '../src/extensions/error-recovery.js';
import { Event } from '../src/models.js';

/**
 * Create a retry recovery strategy
 */
function createRetryStrategy(maxRetries: number = 3): RecoveryStrategy {
  return {
    name: 'retry',
    canRecover: (context: RecoveryContext) => {
      // Check if the error is classified as retryable
      const classification = context.errorClassification;
      return classification?.isRetryable === true && 
             (context.retryCount || 0) < maxRetries;
    },
    recover: async (context: RecoveryContext) => {
      const { operation, args = [], retryCount = 0 } = context;
      
      console.log(`Retrying operation '${operation}' (attempt ${retryCount + 1}/${maxRetries})...`);
      
      try {
        // In a real implementation, this would be a reference to the actual function
        // For this example, we'll simulate success after the second retry
        if (retryCount >= 1) {
          return {
            success: true,
            result: { data: 'Retry succeeded', attempt: retryCount + 1 }
          };
        } else {
          throw new Error('Retry failed');
        }
      } catch (error) {
        return {
          success: false,
          error: error as Error
        };
      }
    }
  };
}

/**
 * Create a cache recovery strategy
 */
function createCacheStrategy(): RecoveryStrategy {
  // Simulate a cache
  const cache = new Map<string, any>([
    ['fetchUserData:123', { id: 123, name: 'Cached User', lastUpdated: '1 hour ago' }]
  ]);
  
  return {
    name: 'cache',
    canRecover: (context: RecoveryContext) => {
      const { operation, args = [] } = context;
      // Check if we have a cached value for this operation and args
      const cacheKey = `${operation}:${args.map(String).join(',')}`;
      return cache.has(cacheKey);
    },
    recover: async (context: RecoveryContext) => {
      const { operation, args = [] } = context;
      const cacheKey = `${operation}:${args.map(String).join(',')}`;
      
      const cachedValue = cache.get(cacheKey);
      if (cachedValue) {
        console.log(`Cache hit for '${cacheKey}'`);
        return {
          success: true,
          result: cachedValue
        };
      }
      
      return {
        success: false,
        error: new Error('Cache miss')
      };
    }
  };
}

/**
 * Create a circuit breaker integration strategy
 */
function createCircuitBreakerStrategy(): RecoveryStrategy {
  // Simulate circuit breaker state
  let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  let failureCount = 0;
  const failureThreshold = 5;
  
  return {
    name: 'circuitBreaker',
    canRecover: (context: RecoveryContext) => {
      // This strategy doesn't actually recover, but prevents further calls
      // when the circuit is open
      return false;
    },
    recover: async (context: RecoveryContext) => {
      const { error } = context;
      
      // Update circuit breaker state based on errors
      if (error) {
        failureCount++;
        if (failureCount >= failureThreshold && state === 'CLOSED') {
          state = 'OPEN';
          console.log('Circuit breaker opened due to too many failures');
          
          // Schedule reset to HALF_OPEN after timeout
          setTimeout(() => {
            state = 'HALF_OPEN';
            console.log('Circuit breaker reset to HALF_OPEN');
          }, 5000);
        }
      } else if (state === 'HALF_OPEN') {
        // Success in HALF_OPEN state resets the circuit breaker
        state = 'CLOSED';
        failureCount = 0;
        console.log('Circuit breaker closed after successful operation');
      }
      
      return {
        success: false,
        error: new Error('Circuit breaker does not provide recovery')
      };
    }
  };
}

/**
 * Create and configure the extension system for error handling
 */
function createErrorHandlingExtensionSystem(): DefaultExtensionSystem {
  const extensionSystem = new DefaultExtensionSystem();
  
  // Register extension points
  extensionSystem.registerExtensionPoint({
    name: 'error.classify',
    description: 'Classifies errors for better handling',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'error.recover',
    description: 'Attempts to recover from errors',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'error.fallback',
    description: 'Provides fallback values when recovery fails',
    handlers: []
  });
  
  // Create and configure the error classification extension
  const errorClassificationExtension = new ErrorClassificationExtension();
  
  // Create and configure the error recovery extension
  const errorRecoveryExtension = new ErrorRecoveryExtension();
  
  // Register recovery strategies
  errorRecoveryExtension.registerRecoveryStrategy(createRetryStrategy());
  errorRecoveryExtension.registerRecoveryStrategy(createCacheStrategy());
  errorRecoveryExtension.registerRecoveryStrategy(createCircuitBreakerStrategy());
  
  // Register fallback handlers
  errorRecoveryExtension.registerFallbackHandler('fetchUserData', () => {
    return { id: 0, name: 'Default User', note: 'This is a fallback value' };
  });
  
  // Register the extensions
  extensionSystem.registerExtension(errorClassificationExtension);
  extensionSystem.registerExtension(errorRecoveryExtension);
  
  return extensionSystem;
}

/**
 * Example of handling an error with classification and recovery
 */
async function handleError(error: Error, operation: string, ...args: any[]): Promise<any> {
  const extensionSystem = createErrorHandlingExtensionSystem();
  
  console.log(`Error in operation '${operation}':`, error.message);
  
  // Step 1: Classify the error
  const errorClassification = await extensionSystem.triggerExtensionPoint('error.classify', error);
  console.log('Error classification:', errorClassification);
  
  // Step 2: Attempt to recover from the error
  const recoveryContext = {
    error,
    operation,
    args,
    errorClassification,
    retryCount: 0
  };
  
  const recoveryResult = await extensionSystem.triggerExtensionPoint('error.recover', recoveryContext);
  console.log('Recovery result:', recoveryResult);
  
  // Step 3: If recovery failed, try to get a fallback value
  if (!recoveryResult.success) {
    const fallbackContext = {
      error,
      operation,
      args,
      errorClassification,
      recoveryResult
    };
    
    const fallbackResult = await extensionSystem.triggerExtensionPoint('error.fallback', fallbackContext);
    console.log('Fallback result:', fallbackResult);
    
    if (fallbackResult.success) {
      return fallbackResult.result;
    }
    
    // If no fallback, rethrow the error
    throw error;
  }
  
  return recoveryResult.result;
}

/**
 * Example usage
 */
async function example() {
  try {
    // Example 1: Network error with retry
    const networkError = new Error('Connection refused');
    networkError.name = 'NetworkError';
    
    const networkResult = await handleError(
      networkError,
      'fetchData',
      'https://api.example.com/data'
    );
    console.log('Result after handling network error:', networkResult);
    
    // Example 2: Database error with cache fallback
    const dbError = new Error('Database connection timeout');
    dbError.name = 'DatabaseError';
    
    const dbResult = await handleError(
      dbError,
      'fetchUserData',
      123
    );
    console.log('Result after handling database error:', dbResult);
    
    // Example 3: Validation error (non-recoverable)
    const validationError = new Error('Invalid input format');
    validationError.name = 'ValidationError';
    
    try {
      const validationResult = await handleError(
        validationError,
        'processData',
        { invalid: 'data' }
      );
    } catch (error) {
      console.log('Expected error for validation failure:', (error as Error).message);
    }
    
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Export the example and utility functions
export {
  createErrorHandlingExtensionSystem,
  handleError,
  createRetryStrategy,
  createCacheStrategy,
  createCircuitBreakerStrategy,
  example
}; 