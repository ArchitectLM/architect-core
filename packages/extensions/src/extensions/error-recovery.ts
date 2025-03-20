import { Extension } from '../extension-system.js';

/**
 * Interface for recovery strategy result
 */
export interface RecoveryResult {
  /** Whether the recovery was successful */
  success: boolean;
  /** The recovered result if successful */
  result?: any;
  /** The error if recovery failed */
  error?: Error;
}

/**
 * Interface for a recovery strategy
 */
export interface RecoveryStrategy {
  /** The name of the strategy */
  name: string;
  /** Function to determine if this strategy can recover from the error */
  canRecover: (context: RecoveryContext) => boolean;
  /** Function to attempt recovery */
  recover: (context: RecoveryContext) => Promise<RecoveryResult> | RecoveryResult;
}

/**
 * Interface for the context passed to recovery strategies
 */
export interface RecoveryContext {
  /** The error to recover from */
  error: Error;
  /** The operation that failed */
  operation: string;
  /** The arguments passed to the operation */
  args?: any[];
  /** Optional domain context */
  domain?: string;
  /** Additional context information */
  [key: string]: any;
}

/**
 * Type for a fallback handler function
 */
export type FallbackHandler = (context: RecoveryContext) => any;

/**
 * Extension that provides error recovery mechanisms
 */
export class ErrorRecoveryExtension implements Extension {
  name = 'error-recovery';
  description = 'Provides mechanisms to recover from errors';
  
  private recoveryStrategies: RecoveryStrategy[] = [];
  private fallbackHandlers: Map<string, FallbackHandler> = new Map();
  
  /**
   * Register a recovery strategy
   * @param strategy The recovery strategy to register
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }
  
  /**
   * Register a fallback handler for a specific operation
   * @param operation The operation name
   * @param handler The fallback handler function
   */
  registerFallbackHandler(operation: string, handler: FallbackHandler): void {
    this.fallbackHandlers.set(operation, handler);
  }
  
  /**
   * Attempt to recover from an error using registered strategies
   * @param context The recovery context
   * @returns The recovery result
   */
  private async attemptRecovery(context: RecoveryContext): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
    strategy?: string;
    attempted: string[];
  }> {
    const attempted: string[] = [];
    
    // Try each strategy in order
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(context)) {
        attempted.push(strategy.name);
        const result = await strategy.recover(context);
        
        if (result.success) {
          return {
            ...result,
            strategy: strategy.name,
            attempted
          };
        }
      }
    }
    
    // If no strategy succeeded, return failure
    return {
      success: false,
      error: context.error,
      attempted
    };
  }
  
  /**
   * Provide a fallback value for a failed operation
   * @param context The recovery context
   * @returns The fallback result
   */
  private provideFallback(context: RecoveryContext): {
    success: boolean;
    result?: any;
    source: string;
  } {
    const { operation } = context;
    const handler = this.fallbackHandlers.get(operation);
    
    if (handler) {
      return {
        success: true,
        result: handler(context),
        source: 'fallback'
      };
    }
    
    return {
      success: false,
      source: 'none'
    };
  }
  
  hooks = {
    'error.recover': async (context: RecoveryContext) => {
      return this.attemptRecovery(context);
    },
    
    'error.fallback': (context: RecoveryContext) => {
      return this.provideFallback(context);
    }
  };
} 