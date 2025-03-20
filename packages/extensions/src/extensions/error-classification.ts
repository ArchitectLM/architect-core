import { Extension } from '../extension-system.js';

/**
 * Interface for error classification result
 */
export interface ErrorClassification {
  /** The type of error */
  type: string;
  /** Optional subtype for more specific classification */
  subtype?: string;
  /** Whether the error is transient (temporary) */
  isTransient: boolean;
  /** Whether the error should be retried */
  isRetryable: boolean;
  /** The severity of the error (info, warning, error, critical) */
  severity?: string;
  /** Optional retry strategy for this error */
  retryStrategy?: {
    /** Multiplier for backoff calculation */
    backoffMultiplier?: number;
    /** Maximum number of retries */
    maxRetries?: number;
    /** Minimum delay between retries */
    minDelay?: number;
    /** Maximum delay between retries */
    maxDelay?: number;
  };
  /** Optional action to take in response to this error */
  action?: string;
  /** Additional metadata about the error */
  metadata?: Record<string, any>;
}

/**
 * Interface for the context passed to the error classification extension point
 */
export interface ErrorClassificationContext {
  /** The error to classify */
  error: Error;
  /** Additional context information */
  [key: string]: any;
}

/**
 * Type for an error classifier function
 */
export type ErrorClassifier = (
  error: Error,
  context?: Record<string, any>
) => ErrorClassification | null;

/**
 * Extension that classifies errors for better retry decisions
 */
export class ErrorClassificationExtension implements Extension {
  name = 'error-classification';
  description = 'Classifies errors for better retry decisions';
  
  private classifiers: ErrorClassifier[] = [];
  private defaultClassifier: ErrorClassifier | null = null;
  
  /**
   * Register an error classifier
   * @param classifier The function that classifies errors
   */
  registerErrorClassifier(classifier: ErrorClassifier): void {
    this.classifiers.push(classifier);
  }
  
  /**
   * Register a default classifier that runs if no other classifier matches
   * @param classifier The function that classifies errors
   */
  registerDefaultClassifier(classifier: ErrorClassifier): void {
    this.defaultClassifier = classifier;
  }
  
  /**
   * Classify network errors
   */
  private networkErrorClassifier: ErrorClassifier = (error) => {
    // Check if the error is a network error
    const errorMessage = error.message || '';
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND')
    ) {
      return {
        type: 'network',
        isTransient: true,
        isRetryable: true,
        severity: 'warning'
      };
    }
    
    // Check if it's a timeout error
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      return {
        type: 'timeout',
        isTransient: true,
        isRetryable: true,
        severity: 'warning',
        retryStrategy: {
          maxRetries: 3,
          backoffMultiplier: 2
        }
      };
    }
    
    return null;
  };
  
  /**
   * Classify HTTP errors
   */
  private httpErrorClassifier: ErrorClassifier = (error) => {
    // Check if this is an HTTP error with a status code
    if ('status' in error || 'statusCode' in error) {
      const status = (error as any).status || (error as any).statusCode;
      
      // 4xx errors (client errors)
      if (status >= 400 && status < 500) {
        // Most 4xx errors are not retryable, except for a few
        const retryable4xx = [408, 429]; // Request Timeout, Too Many Requests
        
        return {
          type: 'http',
          subtype: `${status}`,
          isTransient: retryable4xx.includes(status),
          isRetryable: retryable4xx.includes(status),
          severity: 'error',
          retryStrategy: status === 429 ? {
            // For rate limiting (429), use exponential backoff with longer delays
            backoffMultiplier: 2,
            maxRetries: 5,
            minDelay: 1000
          } : undefined
        };
      }
      
      // 5xx errors (server errors)
      if (status >= 500 && status < 600) {
        return {
          type: 'http',
          subtype: `${status}`,
          isTransient: true,
          isRetryable: true,
          severity: 'warning',
          retryStrategy: {
            backoffMultiplier: 1.5,
            maxRetries: 3
          }
        };
      }
    }
    
    return null;
  };
  
  /**
   * Classify database errors
   */
  private databaseErrorClassifier: ErrorClassifier = (error, context) => {
    const message = (error.message || '').toLowerCase();
    const isDatabaseError = 
      message.includes('database') ||
      message.includes('db') ||
      message.includes('sql') ||
      message.includes('query') ||
      error.name === 'DatabaseError' ||
      error.name === 'SequelizeError' ||
      error.name === 'MongoError';
    
    if (isDatabaseError) {
      // Check for connection issues vs. query issues
      const isConnectionIssue = 
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('unavailable');
      
      // Check for constraint violations
      const isConstraintViolation = 
        message.includes('constraint') ||
        message.includes('duplicate') ||
        message.includes('unique') ||
        message.includes('foreign key');
      
      // Check if this is a critical operation from context
      const isCritical = context && context.isCritical === true;
      
      if (isConnectionIssue) {
        return {
          type: 'database',
          subtype: 'connection',
          isTransient: true,
          isRetryable: true,
          severity: 'warning',
          retryStrategy: {
            backoffMultiplier: 2,
            maxRetries: 5
          }
        };
      } else if (isConstraintViolation) {
        return {
          type: 'database',
          subtype: 'constraint',
          isTransient: false,
          isRetryable: false,
          severity: 'error'
        };
      } else {
        // For general database errors, use context to determine if it's critical
        return {
          type: 'database',
          isTransient: isCritical ? true : false,
          isRetryable: !isCritical,
          severity: 'error'
        };
      }
    }
    
    return null;
  };
  
  constructor() {
    // Register built-in classifiers
    this.registerErrorClassifier(this.networkErrorClassifier);
    this.registerErrorClassifier(this.httpErrorClassifier);
    this.registerErrorClassifier(this.databaseErrorClassifier);
    
    // Register a default classifier
    this.registerDefaultClassifier((error) => ({
      type: 'unknown',
      isTransient: false,
      isRetryable: false,
      severity: 'error',
      metadata: {
        name: error.name,
        message: error.message
      }
    }));
  }
  
  hooks = {
    'error.classify': (context: ErrorClassificationContext) => {
      const { error, ...additionalContext } = context;
      
      // Try each classifier in order
      for (const classifier of this.classifiers) {
        const classification = classifier(error, additionalContext);
        if (classification) {
          return classification;
        }
      }
      
      // Use the default classifier if available
      if (this.defaultClassifier) {
        return this.defaultClassifier(error, additionalContext);
      }
      
      // Fallback classification
      return {
        type: 'unknown',
        isTransient: false,
        isRetryable: false,
        severity: 'error'
      };
    }
  };
} 