/**
 * @file Example of error recovery with the extension system
 * @module @architectlm/extensions/examples
 */

import { 
  createExtensionSystem, 
  DefaultExtensionSystem,
  Extension
} from '../src/extension-system.js';

import {
  ErrorRecoveryExtension,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult
} from '../src/extensions/error-recovery.js';

import {
  ErrorClassificationExtension,
  ErrorClassification,
  ErrorClassifier
} from '../src/extensions/error-classification.js';

/**
 * Create a retry recovery strategy
 * @param maxRetries Maximum number of retries
 * @param delay Delay between retries in milliseconds
 * @returns A retry recovery strategy
 */
function createRetryStrategy(maxRetries: number = 3, delay: number = 1000): RecoveryStrategy {
  return {
    name: 'retry',
    canRecover: (context: RecoveryContext) => {
      // Check if the error is retryable
      const isRetryable = context.errorClassification?.isRetryable === true;
      
      // Check if we haven't exceeded the maximum number of retries
      const retryCount = context.retryCount || 0;
      const canRetry = retryCount < maxRetries;
      
      return isRetryable && canRetry;
    },
    recover: async (context: RecoveryContext) => {
      const { operation, args = [], retryCount = 0 } = context;
      
      console.log(`Retrying operation '${operation}' (attempt ${retryCount + 1}/${maxRetries})...`);
      
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        // In a real implementation, we would call the actual function
        // For this example, we'll simulate success after the second retry
        if (retryCount >= 1) {
          console.log(`Retry successful for operation '${operation}'`);
          return {
            success: true,
            result: { data: 'Retry succeeded', attempt: retryCount + 1 }
          };
        } else {
          // Simulate another failure
          console.log(`Retry failed for operation '${operation}'`);
          throw new Error(`Retry failed (attempt ${retryCount + 1})`);
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
 * @returns A cache recovery strategy
 */
function createCacheStrategy(): RecoveryStrategy {
  // Simulate a cache
  const cache = new Map<string, any>([
    ['fetchUserData:123', { id: 123, name: 'Cached User', lastUpdated: '1 hour ago' }],
    ['fetchProductData:456', { id: 456, name: 'Cached Product', price: 99.99 }]
  ]);
  
  return {
    name: 'cache',
    canRecover: (context: RecoveryContext) => {
      const { operation, args = [] } = context;
      
      // Create a cache key from the operation and arguments
      const cacheKey = `${operation}:${args.map(String).join(',')}`;
      
      // Check if we have a cached value for this operation and arguments
      return cache.has(cacheKey);
    },
    recover: async (context: RecoveryContext) => {
      const { operation, args = [] } = context;
      
      // Create a cache key from the operation and arguments
      const cacheKey = `${operation}:${args.map(String).join(',')}`;
      
      // Get the cached value
      const cachedValue = cache.get(cacheKey);
      
      if (cachedValue) {
        console.log(`Cache hit for '${cacheKey}'`);
        return {
          success: true,
          result: cachedValue
        };
      }
      
      console.log(`Cache miss for '${cacheKey}'`);
      return {
        success: false,
        error: new Error('Cache miss')
      };
    }
  };
}

/**
 * Create a fallback recovery strategy
 * @returns A fallback recovery strategy
 */
function createFallbackStrategy(): RecoveryStrategy {
  // Fallback values for different operations
  const fallbacks = new Map<string, any>([
    ['fetchUserData', { id: 0, name: 'Default User', isDefault: true }],
    ['fetchProductData', { id: 0, name: 'Default Product', price: 0, isDefault: true }],
    ['processPayment', { status: 'pending', message: 'Payment is being processed offline' }]
  ]);
  
  return {
    name: 'fallback',
    canRecover: (context: RecoveryContext) => {
      // We can always try to provide a fallback
      return true;
    },
    recover: async (context: RecoveryContext) => {
      const { operation } = context;
      
      // Check if we have a fallback for this operation
      if (fallbacks.has(operation)) {
        const fallbackValue = fallbacks.get(operation);
        console.log(`Using fallback for operation '${operation}'`);
        return {
          success: true,
          result: fallbackValue
        };
      }
      
      console.log(`No fallback available for operation '${operation}'`);
      return {
        success: false,
        error: new Error('No fallback available')
      };
    }
  };
}

/**
 * Simulate a function that might fail
 * @param shouldFail Whether the function should fail
 * @param errorType The type of error to throw
 * @returns A function that might fail
 */
function createFailingFunction<T, R>(
  shouldFail: boolean,
  errorType: string,
  successResult: R
): (...args: T[]) => Promise<R> {
  return async (...args: T[]): Promise<R> => {
    if (shouldFail) {
      const error = new Error(`${errorType} error occurred`);
      // Ensure the error has a name property
      error.name = errorType;
      // Add a toString method to ensure the error can be properly serialized
      if (!error.toString) {
        error.toString = function() {
          return `${this.name}: ${this.message}`;
        };
      }
      throw error;
    }
    
    return successResult;
  };
}

/**
 * Example of error recovery
 */
async function example() {
  // Create the extension system
  const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
  
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
  
  // Create and register the error classification extension
  const errorClassificationExtension = new ErrorClassificationExtension();
  extensionSystem.registerExtension(errorClassificationExtension);
  
  // Configure error classifications
  const customErrorClassifier: ErrorClassifier = (error: Error) => {
    if (error.name === 'NetworkError') {
      return {
        type: 'network',
        isTransient: true,
        isRetryable: true,
        severity: 'medium',
        action: 'retry'
      };
    }
    
    if (error.name === 'DatabaseError') {
      return {
        type: 'database',
        isTransient: true,
        isRetryable: true,
        severity: 'high',
        action: 'retry'
      };
    }
    
    if (error.name === 'ValidationError') {
      return {
        type: 'validation',
        isTransient: false,
        isRetryable: false,
        severity: 'low',
        action: 'report'
      };
    }
    
    return null;
  };
  
  errorClassificationExtension.registerErrorClassifier(customErrorClassifier);
  
  // Create and register the error recovery extension
  const errorRecoveryExtension = new ErrorRecoveryExtension();
  extensionSystem.registerExtension(errorRecoveryExtension);
  
  // Register recovery strategies
  errorRecoveryExtension.registerRecoveryStrategy(createRetryStrategy());
  errorRecoveryExtension.registerRecoveryStrategy(createCacheStrategy());
  errorRecoveryExtension.registerRecoveryStrategy(createFallbackStrategy());
  
  // Register fallback handlers
  errorRecoveryExtension.registerFallbackHandler('fetchUserData', () => {
    return { id: 0, name: 'Fallback User', source: 'fallback-handler' };
  });
  
  // Example 1: Network error with retry
  console.log('\nExample 1: Network error with retry');
  try {
    // Create a function that will fail with a network error
    const fetchData = createFailingFunction<string, any>(
      true,
      'NetworkError',
      { data: 'Success data' }
    );
    
    // Try to call the function
    await fetchData('https://api.example.com/data');
  } catch (error) {
    console.log('Error caught:', (error as Error).message);
    
    // Classify the error
    const errorClassification = await extensionSystem.triggerExtensionPoint('error.classify', { error: error as Error });
    console.log('Error classification:', errorClassification);
    
    // Try to recover from the error
    const recoveryContext: RecoveryContext = {
      error: error as Error,
      operation: 'fetchData',
      args: ['https://api.example.com/data'],
      errorClassification,
      retryCount: 0
    };
    
    const recoveryResult = await extensionSystem.triggerExtensionPoint('error.recover', recoveryContext);
    console.log('Recovery result:', recoveryResult);
    
    if (recoveryResult.success) {
      console.log('Successfully recovered with result:', recoveryResult.result);
    } else {
      console.log('Failed to recover from error');
    }
  }
  
  // Example 2: Database error with cache fallback
  console.log('\nExample 2: Database error with cache fallback');
  try {
    // Create a function that will fail with a database error
    const fetchUserData = createFailingFunction<number, any>(
      true,
      'DatabaseError',
      { id: 123, name: 'John Doe', email: 'john@example.com' }
    );
    
    // Try to call the function
    await fetchUserData(123);
  } catch (error) {
    console.log('Error caught:', (error as Error).message);
    
    // Classify the error
    const errorClassification = await extensionSystem.triggerExtensionPoint('error.classify', { error: error as Error });
    console.log('Error classification:', errorClassification);
    
    // Try to recover from the error
    const recoveryContext: RecoveryContext = {
      error: error as Error,
      operation: 'fetchUserData',
      args: [123],
      errorClassification
    };
    
    const recoveryResult = await extensionSystem.triggerExtensionPoint('error.recover', recoveryContext);
    console.log('Recovery result:', recoveryResult);
    
    if (recoveryResult.success) {
      console.log('Successfully recovered with result:', recoveryResult.result);
    } else {
      console.log('Failed to recover from error');
      
      // Try to get a fallback value
      const fallbackContext = {
        ...recoveryContext,
        recoveryResult
      };
      
      const fallbackResult = await extensionSystem.triggerExtensionPoint('error.fallback', fallbackContext);
      console.log('Fallback result:', fallbackResult);
      
      if (fallbackResult.success) {
        console.log('Successfully got fallback value:', fallbackResult.result);
      } else {
        console.log('No fallback value available');
      }
    }
  }
  
  // Example 3: Validation error (non-recoverable)
  console.log('\nExample 3: Validation error (non-recoverable)');
  try {
    // Create a function that will fail with a validation error
    const processData = createFailingFunction<object, any>(
      true,
      'ValidationError',
      { success: true }
    );
    
    // Try to call the function
    await processData({ invalid: 'data' });
  } catch (error) {
    console.log('Error caught:', (error as Error).message);
    
    // Classify the error
    const errorClassification = await extensionSystem.triggerExtensionPoint('error.classify', { error: error as Error });
    console.log('Error classification:', errorClassification);
    
    // Try to recover from the error
    const recoveryContext: RecoveryContext = {
      error: error as Error,
      operation: 'processData',
      args: [{ invalid: 'data' }],
      errorClassification
    };
    
    const recoveryResult = await extensionSystem.triggerExtensionPoint('error.recover', recoveryContext);
    console.log('Recovery result:', recoveryResult);
    
    if (recoveryResult.success) {
      console.log('Successfully recovered with result:', recoveryResult.result);
    } else {
      console.log('Failed to recover from error');
      
      // Try to get a fallback value
      const fallbackContext = {
        ...recoveryContext,
        recoveryResult
      };
      
      const fallbackResult = await extensionSystem.triggerExtensionPoint('error.fallback', fallbackContext);
      console.log('Fallback result:', fallbackResult);
      
      if (fallbackResult.success) {
        console.log('Successfully got fallback value:', fallbackResult.result);
      } else {
        console.log('No fallback value available');
      }
    }
  }
}

// Export the example and utility functions
export {
  createRetryStrategy,
  createCacheStrategy,
  createFallbackStrategy,
  createFailingFunction,
  example
}; 

// Call the example function when this file is run directly
// For ESM modules, we can check if this is the main module using import.meta.url
const isMainModule = import.meta.url.endsWith(process.argv[1].replace('file://', ''));
if (isMainModule) {
  example().catch(error => {
    console.error('Error running example:', error);
  });
} 