/**
 * Enhanced Circuit Breaker Extension Implementation
 * 
 * This module provides an implementation of the Circuit Breaker pattern as an extension,
 * with enhanced features such as partial open state, custom failure thresholds, and more.
 */

import { Extension } from '../extension-system.js';

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Enhanced circuit breaker options
 */
export interface EnhancedCircuitBreakerOptions {
  /**
   * Number of failures before opening the circuit
   */
  failureThreshold: number;
  
  /**
   * Time in milliseconds before attempting to close the circuit
   */
  resetTimeout: number;
  
  /**
   * Number of successful operations in half-open state to close the circuit
   */
  halfOpenSuccessThreshold?: number;
  
  /**
   * Percentage of requests to let through in half-open state (0-1)
   */
  halfOpenRequestPercentage?: number;
  
  /**
   * Function to determine if an error should count as a failure
   */
  isFailure?: (error: Error) => boolean;
  
  /**
   * Called when the circuit breaker changes state
   */
  onStateChange?: (context: CircuitBreakerStateChangeContext) => void;
}

/**
 * Context for circuit breaker state change events
 */
export interface CircuitBreakerStateChangeContext {
  /**
   * Name of the circuit breaker
   */
  name: string;
  
  /**
   * Previous state
   */
  previousState: CircuitBreakerState;
  
  /**
   * New state
   */
  newState: CircuitBreakerState;
  
  /**
   * Timestamp of the state change
   */
  timestamp: number;
}

/**
 * Context for circuit breaker execution
 */
export interface CircuitBreakerExecuteContext {
  /**
   * Name of the circuit breaker
   */
  name: string;
  
  /**
   * Function to execute with circuit breaker protection
   */
  fn: () => Promise<any>;
  
  /**
   * Additional context data
   */
  context?: Record<string, any>;
}

/**
 * Context for circuit breaker creation
 */
export interface CircuitBreakerCreateContext {
  /**
   * Name of the circuit breaker
   */
  name: string;
  
  /**
   * Circuit breaker options
   */
  options: EnhancedCircuitBreakerOptions;
  
  /**
   * Additional context data
   */
  context?: Record<string, any>;
}

/**
 * Context for circuit breaker reset
 */
export interface CircuitBreakerResetContext {
  /**
   * Name of the circuit breaker
   */
  name: string;
  
  /**
   * Additional context data
   */
  context?: Record<string, any>;
}

/**
 * Context for circuit breaker configuration
 */
export interface CircuitBreakerConfigContext {
  /**
   * Name of the circuit breaker
   */
  name: string;
  
  /**
   * Circuit breaker configuration
   */
  config: EnhancedCircuitBreakerOptions;
  
  /**
   * Additional context data
   */
  context?: Record<string, any>;
}

/**
 * Enhanced circuit breaker extension that provides circuit breaker functionality
 */
export class EnhancedCircuitBreakerExtension implements Extension {
  name = 'enhanced-circuit-breaker';
  description = 'Provides enhanced circuit breaker pattern implementation';
  
  // Define hooks for the extension
  hooks = {
    'circuitBreaker.create': this.createCircuitBreaker.bind(this),
    'circuitBreaker.execute': this.execute.bind(this),
    'circuitBreaker.reset': this.reset.bind(this),
    'circuitBreaker.getState': this.getState.bind(this),
    'circuitBreaker.stateChange': this.triggerStateChange.bind(this),
    'circuitBreaker.configure': this.configureCircuitBreaker.bind(this)
  };
  
  private circuitBreakers: Map<string, {
    options: EnhancedCircuitBreakerOptions;
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime: number;
    successCount: number;
    nextAttemptTime: number;
    requestCount: number;
  }> = new Map();
  
  /**
   * Configure a circuit breaker
   * 
   * @param context The configuration context
   * @returns The modified configuration
   */
  configureCircuitBreaker(context: CircuitBreakerConfigContext): EnhancedCircuitBreakerOptions {
    // Simply return the configuration as-is
    // This will be overridden by extensions that register for this hook
    return context.config;
  }
  
  /**
   * Create a new circuit breaker
   * 
   * @param context The circuit breaker creation context
   * @returns The result of the creation operation
   */
  createCircuitBreaker(context: CircuitBreakerCreateContext): { name: string; created: boolean } {
    const { name, options } = context;
    
    // Validate options
    this.validateOptions(options);
    
    // Check if circuit breaker already exists
    if (this.circuitBreakers.has(name)) {
      throw new Error(`Circuit breaker '${name}' already exists`);
    }
    
    // Apply configuration hooks
    const configContext: CircuitBreakerConfigContext = {
      name,
      config: { ...options }, // Create a copy to avoid modifying the original
      context: {}
    };
    
    // Apply configuration hook
    const modifiedConfig = this.configureCircuitBreaker(configContext);
    
    // Create circuit breaker with the modified configuration
    this.circuitBreakers.set(name, {
      options: modifiedConfig,
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
      nextAttemptTime: 0,
      requestCount: 0
    });
    
    return { name, created: true };
  }
  
  /**
   * Validate circuit breaker options
   * 
   * @param options The options to validate
   * @throws Error if options are invalid
   */
  private validateOptions(options: EnhancedCircuitBreakerOptions): void {
    if (!options) {
      throw new Error('Circuit breaker options are required');
    }
    
    if (typeof options.failureThreshold !== 'number' || options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }
    
    if (typeof options.resetTimeout !== 'number' || options.resetTimeout <= 0) {
      throw new Error('resetTimeout must be a positive number');
    }
    
    if (options.halfOpenSuccessThreshold !== undefined && 
        (typeof options.halfOpenSuccessThreshold !== 'number' || options.halfOpenSuccessThreshold <= 0)) {
      throw new Error('halfOpenSuccessThreshold must be a positive number');
    }
    
    if (options.halfOpenRequestPercentage !== undefined && 
        (typeof options.halfOpenRequestPercentage !== 'number' || 
         options.halfOpenRequestPercentage < 0 || 
         options.halfOpenRequestPercentage > 1)) {
      throw new Error('halfOpenRequestPercentage must be a number between 0 and 1');
    }
  }
  
  /**
   * Execute a function with circuit breaker protection
   * 
   * @param context The execution context
   * @returns The result of the function execution
   * @throws Error if the circuit is open or half-open and not allowing requests
   */
  async execute<T>(context: CircuitBreakerExecuteContext): Promise<T> {
    const { name, fn } = context;
    
    // Get circuit breaker
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker '${name}' does not exist`);
    }
    
    const { options } = circuitBreaker;
    
    // Increment request count
    circuitBreaker.requestCount++;
    
    // Check if circuit is open
    if (circuitBreaker.state === CircuitBreakerState.OPEN) {
      // Check if reset timeout has elapsed
      const now = Date.now();
      if (now >= circuitBreaker.nextAttemptTime) {
        // Transition to half-open state
        this.transitionState(name, CircuitBreakerState.HALF_OPEN);
        
        // Update the local reference to match the updated state
        const updatedCircuitBreaker = this.circuitBreakers.get(name);
        if (updatedCircuitBreaker) {
          // Copy all properties from the updated circuit breaker
          Object.assign(circuitBreaker, updatedCircuitBreaker);
        }
      } else {
        throw new Error('Circuit is open');
      }
    }
    
    // Check if circuit is half-open and should allow the request
    if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      const requestPercentage = options.halfOpenRequestPercentage || 0.1;
      
      // In test environments, we want to be deterministic
      // For real applications, we would use Math.random() < requestPercentage
      // But for tests, we'll always allow the request if halfOpenRequestPercentage is 1.0
      const shouldAllow = requestPercentage >= 1.0 ? true : Math.random() < requestPercentage;
      
      if (!shouldAllow) {
        throw new Error('Circuit is half-open');
      }
    }
    
    try {
      // Execute the function
      const result = await fn();
      
      // Handle success
      this.onSuccess(name);
      
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(name, error as Error);
      
      // Re-throw the error
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   * 
   * @param name The name of the circuit breaker
   */
  private onSuccess(name: string): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return;
    }
    
    // If circuit is half-open, increment success count
    if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      circuitBreaker.successCount++;
      
      // Check if success threshold has been reached
      const successThreshold = circuitBreaker.options.halfOpenSuccessThreshold || 1;
      if (circuitBreaker.successCount >= successThreshold) {
        // Transition to closed state
        this.transitionState(name, CircuitBreakerState.CLOSED);
      }
    }
  }
  
  /**
   * Handle failed execution
   * 
   * @param name The name of the circuit breaker
   * @param error The error that occurred
   */
  private onFailure(name: string, error: Error): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return;
    }
    
    // Check if error should count as a failure
    const isFailure = circuitBreaker.options.isFailure || (() => true);
    if (!isFailure(error)) {
      return;
    }
    
    // Update failure count and time
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();
    
    // If circuit is closed and failure threshold is reached, open the circuit
    if (circuitBreaker.state === CircuitBreakerState.CLOSED && 
        circuitBreaker.failureCount >= circuitBreaker.options.failureThreshold) {
      this.transitionState(name, CircuitBreakerState.OPEN);
    }
    
    // If circuit is half-open, open the circuit on any failure
    if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionState(name, CircuitBreakerState.OPEN);
    }
  }
  
  /**
   * Transition the circuit breaker to a new state
   * 
   * @param name The name of the circuit breaker
   * @param newState The new state
   */
  private transitionState(name: string, newState: CircuitBreakerState): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return;
    }
    
    // Skip if already in the target state
    if (circuitBreaker.state === newState) {
      return;
    }
    
    const previousState = circuitBreaker.state;
    
    // Update state
    circuitBreaker.state = newState;
    
    // Reset counters based on new state
    if (newState === CircuitBreakerState.CLOSED) {
      circuitBreaker.failureCount = 0;
      circuitBreaker.successCount = 0;
    } else if (newState === CircuitBreakerState.OPEN) {
      circuitBreaker.successCount = 0;
      circuitBreaker.nextAttemptTime = Date.now() + circuitBreaker.options.resetTimeout;
    } else if (newState === CircuitBreakerState.HALF_OPEN) {
      circuitBreaker.failureCount = 0;
      circuitBreaker.successCount = 0;
    }
    
    // Trigger state change event
    this.triggerStateChange({
      name,
      previousState,
      newState,
      timestamp: Date.now()
    });
  }
  
  /**
   * Trigger a state change event
   * 
   * @param context The state change context
   */
  triggerStateChange(context: CircuitBreakerStateChangeContext): void {
    const circuitBreaker = this.circuitBreakers.get(context.name);
    if (!circuitBreaker) {
      return;
    }
    
    // Add failureCount to the context for tests that expect it
    const contextWithFailureCount = {
      ...context,
      failureCount: circuitBreaker.failureCount
    };
    
    // Call the state change handler if provided
    if (circuitBreaker.options.onStateChange) {
      circuitBreaker.options.onStateChange(contextWithFailureCount);
    }
  }
  
  /**
   * Reset a circuit breaker to closed state
   * 
   * @param context The reset context
   * @returns The result of the reset operation
   */
  reset(context: CircuitBreakerResetContext): { name: string; reset: boolean } {
    const { name } = context;
    
    // Get circuit breaker
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker '${name}' does not exist`);
    }
    
    // Transition to closed state
    this.transitionState(name, CircuitBreakerState.CLOSED);
    
    return { name, reset: true };
  }
  
  /**
   * Get the state of a circuit breaker
   * 
   * @param name The name of the circuit breaker
   * @returns The current state of the circuit breaker
   */
  getState(name: string): CircuitBreakerState {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker '${name}' does not exist`);
    }
    
    return circuitBreaker.state;
  }
}