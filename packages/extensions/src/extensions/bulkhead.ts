/**
 * Bulkhead Extension Implementation
 * 
 * This module provides an implementation of the Bulkhead pattern as an extension,
 * which limits the number of concurrent executions to prevent system overload.
 */

import { Extension } from '../extension-system.js';

/**
 * Bulkhead options
 */
export interface BulkheadOptions {
  /**
   * Maximum number of concurrent executions
   */
  maxConcurrent: number;
  
  /**
   * Maximum size of the waiting queue
   */
  maxQueue?: number;
  
  /**
   * Timeout for execution in milliseconds
   */
  timeout?: number;
  
  /**
   * Called when bulkhead capacity is exceeded or execution times out
   */
  onRejected?: (error: Error) => void;
}

/**
 * Context for bulkhead rejection events
 */
export interface BulkheadRejectionContext {
  /**
   * Name of the bulkhead
   */
  name: string;
  
  /**
   * Current number of active executions
   */
  activeCount: number;
  
  /**
   * Current size of the waiting queue
   */
  queueSize: number;
  
  /**
   * Reason for rejection
   */
  reason: 'capacity_exceeded' | 'timeout';
  
  /**
   * Timestamp of the rejection
   */
  timestamp: number;
}

/**
 * Context for bulkhead configuration
 */
export interface BulkheadConfigContext {
  /**
   * Name of the bulkhead
   */
  name: string;
  
  /**
   * Current configuration
   */
  config: BulkheadOptions;
  
  /**
   * Additional context information
   */
  context?: Record<string, any>;
}

/**
 * Bulkhead extension that provides concurrency limiting functionality
 */
export class BulkheadExtension implements Extension {
  name = 'bulkhead';
  description = 'Provides bulkhead pattern implementation for limiting concurrency';
  
  private bulkheads: Map<string, {
    semaphore: {
      permits: number;
      queue: Array<{ resolve: () => void; reject: (error: Error) => void }>;
    };
    options: BulkheadOptions;
    activeCount: number;
  }> = new Map();
  
  /**
   * Create a new bulkhead
   * 
   * @param name The name of the bulkhead
   * @param options Bulkhead options
   */
  createBulkhead(name: string, options: BulkheadOptions): void {
    this.validateOptions(options);
    
    this.bulkheads.set(name, {
      semaphore: {
        permits: options.maxConcurrent,
        queue: []
      },
      options,
      activeCount: 0
    });
  }
  
  /**
   * Validate bulkhead options
   * 
   * @param options Bulkhead options
   */
  private validateOptions(options: BulkheadOptions): void {
    if (options.maxConcurrent <= 0) {
      throw new Error('maxConcurrent must be greater than 0');
    }
    
    if (options.maxQueue !== undefined && options.maxQueue < 0) {
      throw new Error('maxQueue must be greater than or equal to 0');
    }
    
    if (options.timeout !== undefined && options.timeout <= 0) {
      throw new Error('timeout must be greater than 0');
    }
  }
  
  /**
   * Execute a function with bulkhead protection
   * 
   * @param name The name of the bulkhead
   * @param fn The function to execute
   * @returns The result of the function
   * @throws Error if bulkhead capacity is exceeded and no error handler is provided
   */
  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const bulkhead = this.bulkheads.get(name);
    
    if (!bulkhead) {
      throw new Error(`Bulkhead '${name}' not found`);
    }
    
    const { semaphore, options } = bulkhead;
    
    // Try to acquire a permit
    if (semaphore.permits > 0) {
      semaphore.permits--;
      bulkhead.activeCount++;
      
      try {
        // Execute with timeout if specified
        if (options.timeout) {
          const result = await this.executeWithTimeout(fn, options.timeout);
          return result;
        } else {
          return await fn();
        }
      } finally {
        semaphore.permits++;
        bulkhead.activeCount--;
        
        // Process next in queue if any
        if (semaphore.queue.length > 0) {
          const next = semaphore.queue.shift();
          next?.resolve();
        }
      }
    } else if (options.maxQueue === undefined || semaphore.queue.length < options.maxQueue) {
      // Queue the execution
      return new Promise<T>((resolve, reject) => {
        const queueEntry = {
          resolve: async () => {
            bulkhead.activeCount++;
            semaphore.permits--;
            
            try {
              // Execute with timeout if specified
              if (options.timeout) {
                const result = await this.executeWithTimeout(fn, options.timeout);
                resolve(result);
              } else {
                const result = await fn();
                resolve(result);
              }
            } catch (error) {
              reject(error);
            } finally {
              semaphore.permits++;
              bulkhead.activeCount--;
              
              // Process next in queue if any
              if (semaphore.queue.length > 0) {
                const next = semaphore.queue.shift();
                next?.resolve();
              }
            }
          },
          reject
        };
        
        semaphore.queue.push(queueEntry);
      });
    } else {
      // Bulkhead capacity exceeded
      const error = new Error('Bulkhead capacity exceeded');
      
      // Trigger the rejection extension point
      this.triggerRejection(name, bulkhead.activeCount, semaphore.queue.length, 'capacity_exceeded');
      
      // Call the error handler if provided
      if (options.onRejected) {
        options.onRejected(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Execute a function with a timeout
   * 
   * @param fn The function to execute
   * @param timeout The timeout in milliseconds
   * @returns The result of the function
   * @throws Error if the execution times out
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Bulkhead execution timed out'));
      }, timeout);
      
      fn().then(
        (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Trigger the bulkhead rejection extension point
   * 
   * @param name The name of the bulkhead
   * @param activeCount The current number of active executions
   * @param queueSize The current size of the waiting queue
   * @param reason The reason for rejection
   */
  private triggerRejection(
    name: string,
    activeCount: number,
    queueSize: number,
    reason: 'capacity_exceeded' | 'timeout'
  ): void {
    const context: BulkheadRejectionContext = {
      name,
      activeCount,
      queueSize,
      reason,
      timestamp: Date.now()
    };
    
    // This will be handled by the extension system
    this.hooks['bulkhead.rejected'](context);
  }
  
  hooks = {
    'bulkhead.create': (context: { name: string; options: BulkheadOptions }) => {
      const { name, options } = context;
      this.createBulkhead(name, options);
      return { name, created: true };
    },
    
    'bulkhead.execute': async (context: { name: string; fn: () => Promise<any> }) => {
      const { name, fn } = context;
      return await this.execute(name, fn);
    },
    
    'bulkhead.rejected': (context: BulkheadRejectionContext) => {
      // This is a notification hook, no return value needed
      return context;
    },
    
    'bulkhead.configure': (context: BulkheadConfigContext) => {
      const { name, config, context: additionalContext } = context;
      
      // Allow extensions to modify the configuration
      // This is useful for contextual policies
      return config;
    }
  };
} 