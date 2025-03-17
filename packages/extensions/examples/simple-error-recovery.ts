/**
 * Simple example of error recovery with the extension system
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
 * Simple example of error recovery
 */
async function simpleExample() {
  console.log("Starting simple error recovery example...");
  
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
    
    return null;
  };
  
  errorClassificationExtension.registerErrorClassifier(customErrorClassifier);
  
  // Create and register the error recovery extension
  const errorRecoveryExtension = new ErrorRecoveryExtension();
  extensionSystem.registerExtension(errorRecoveryExtension);
  
  // Register a simple retry recovery strategy
  const retryStrategy: RecoveryStrategy = {
    name: 'retry',
    canRecover: (context: RecoveryContext) => {
      return context.errorClassification?.isRetryable === true;
    },
    recover: async (context: RecoveryContext) => {
      console.log(`Retrying operation '${context.operation}'...`);
      
      try {
        // Simulate a successful retry
        return {
          success: true,
          result: { message: "Retry succeeded" }
        };
      } catch (error) {
        return {
          success: false,
          error: error as Error
        };
      }
    }
  };
  
  errorRecoveryExtension.registerRecoveryStrategy(retryStrategy);
  
  // Simulate a network error
  try {
    console.log("Simulating a network error...");
    const error = new Error("Connection failed");
    error.name = "NetworkError";
    throw error;
  } catch (error) {
    console.log("Error caught:", (error as Error).message);
    
    // Classify the error
    const errorClassification = await extensionSystem.triggerExtensionPoint('error.classify', { error: error as Error });
    console.log("Error classification:", errorClassification);
    
    // Try to recover from the error
    const recoveryContext: RecoveryContext = {
      error: error as Error,
      operation: 'fetchData',
      args: ['https://example.com/api/data'],
      errorClassification
    };
    
    const recoveryResult = await extensionSystem.triggerExtensionPoint('error.recover', recoveryContext);
    console.log("Recovery result:", recoveryResult);
    
    if (recoveryResult.success) {
      console.log("Successfully recovered with result:", recoveryResult.result);
    } else {
      console.log("Failed to recover from error");
    }
  }
  
  console.log("Simple error recovery example completed.");
}

// Run the example
simpleExample().catch(error => {
  console.error("Error running example:", error);
}); 