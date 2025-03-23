import { Extension, ExtensionHookRegistration } from '../models/extension-system';

/**
 * Circuit Breaker State
 */
export enum CircuitBreakerState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  maxRetryTimeout: number;
}

/**
 * Circuit Breaker Analytics
 */
export interface CircuitBreakerAnalytics {
  successCount: number;
  failureCount: number;
  state: string;
  lastFailure?: Date;
  lastSuccess?: Date;
}

/**
 * Individual Circuit state for a task type
 */
interface CircuitState {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  resetTimer?: NodeJS.Timeout;
}

/**
 * Circuit Breaker Plugin
 * 
 * Implementation of the Circuit Breaker pattern that prevents
 * execution of tasks that are likely to fail.
 */
export class CircuitBreakerPlugin implements Extension {
  private circuits: Map<string, CircuitState> = new Map();
  private options: CircuitBreakerOptions;
  
  /**
   * Create a new Circuit Breaker instance
   * @param options Circuit breaker options
   */
  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeout: options?.resetTimeout || 30000,
      maxRetryTimeout: options?.maxRetryTimeout || 60000
    };
  }
  
  /**
   * Get the name of the extension
   */
  getName(): string {
    return 'circuit-breaker';
  }
  
  /**
   * Get hook registrations for the extension system
   */
  getHooks(): ExtensionHookRegistration[] {
    return [
      {
        point: 'beforeTaskExecution',
        hook: this.beforeTaskExecution.bind(this)
      },
      {
        point: 'afterTaskExecution',
        hook: this.afterTaskExecution.bind(this)
      },
      {
        point: 'onTaskError',
        hook: this.onTaskError.bind(this)
      }
    ];
  }
  
  /**
   * Before task execution - check if circuit is closed
   */
  async beforeTaskExecution(event: any, context: any): Promise<any> {
    const taskType = event.taskType || (event.task && event.task.type);
    
    if (!taskType) {
      console.error('[CircuitBreaker] No task type found in event', event);
      return { success: true };
    }
    
    // Get or create circuit for task
    const circuit = this.getCircuit(taskType);
    
    // Check if circuit is open
    if (circuit.state === CircuitBreakerState.OPEN) {
      console.log(`[CircuitBreaker] Rejecting execution of ${taskType} - circuit is OPEN`);
      return {
        success: false,
        error: new Error(`Circuit is OPEN for task type ${taskType}`)
      };
    }
    
    // If half open, only allow one test request
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      console.log(`[CircuitBreaker] Allowing test request for ${taskType} in HALF_OPEN state`);
    }
    
    return { success: true };
  }
  
  /**
   * After task execution - record success
   */
  async afterTaskExecution(event: any, context: any): Promise<any> {
    const taskType = event.taskType || (event.task && event.task.type);
    
    if (!taskType) {
      console.error('[CircuitBreaker] No task type found in event', event);
      return;
    }
    
    const circuit = this.getCircuit(taskType);
    
    // Record success
    circuit.successCount++;
    circuit.lastSuccess = new Date();
    
    // If half open, close circuit
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionCircuitState(taskType, CircuitBreakerState.CLOSED);
    }
    
    return { success: true };
  }
  
  /**
   * On task error - record failure and potentially open circuit
   */
  async onTaskError(event: any, context: any): Promise<any> {
    const taskType = event.taskType || (event.task && event.task.type);
    
    if (!taskType) {
      console.error('[CircuitBreaker] No task type found in event', event);
      return;
    }
    
    const circuit = this.getCircuit(taskType);
    
    // Record failure
    circuit.failureCount++;
    circuit.lastFailure = new Date();
    
    // If half open, open circuit again
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionCircuitState(taskType, CircuitBreakerState.OPEN);
      this.scheduleReset(taskType);
      return;
    }
    
    // If closed and failure threshold reached, open circuit
    if (circuit.state === CircuitBreakerState.CLOSED && 
        circuit.failureCount >= this.options.failureThreshold) {
      this.transitionCircuitState(taskType, CircuitBreakerState.OPEN);
      this.scheduleReset(taskType);
    }
    
    return { success: true };
  }
  
  /**
   * Get circuit for a task type
   */
  private getCircuit(taskType: string): CircuitState {
    let circuit = this.circuits.get(taskType);
    
    if (!circuit) {
      circuit = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0
      };
      this.circuits.set(taskType, circuit);
    }
    
    return circuit;
  }
  
  /**
   * Schedule circuit reset to half-open
   */
  private scheduleReset(taskType: string): void {
    const circuit = this.getCircuit(taskType);
    
    // Clear existing timer if any
    if (circuit.resetTimer) {
      clearTimeout(circuit.resetTimer);
    }
    
    // Schedule transition to half-open
    circuit.resetTimer = setTimeout(() => {
      if (circuit.state === CircuitBreakerState.OPEN) {
        this.transitionCircuitState(taskType, CircuitBreakerState.HALF_OPEN);
      }
    }, this.options.resetTimeout);
  }
  
  /**
   * Transition circuit state with logging
   */
  private transitionCircuitState(taskType: string, newState: CircuitBreakerState): void {
    const circuit = this.getCircuit(taskType);
    const oldState = circuit.state;
    
    if (oldState !== newState) {
      console.log(`[CircuitBreaker] Transitioning task ${taskType} from ${oldState} to ${newState}`);
      circuit.state = newState;
      
      // Reset failure count when closing
      if (newState === CircuitBreakerState.CLOSED) {
        circuit.failureCount = 0;
      }
    }
  }
  
  /**
   * Get the current state of a circuit
   */
  getCircuitState(taskType: string): string {
    return this.getCircuit(taskType).state;
  }
  
  /**
   * Get analytics for a circuit
   */
  getCircuitAnalytics(taskType: string): CircuitBreakerAnalytics {
    const circuit = this.getCircuit(taskType);
    
    return {
      successCount: circuit.successCount,
      failureCount: circuit.failureCount,
      state: circuit.state,
      lastFailure: circuit.lastFailure,
      lastSuccess: circuit.lastSuccess
    };
  }
  
  /**
   * Reset circuit to closed state
   */
  resetCircuit(taskType: string): void {
    const circuit = this.getCircuit(taskType);
    
    // Clear any pending reset timer
    if (circuit.resetTimer) {
      clearTimeout(circuit.resetTimer);
    }
    
    // Transition to closed
    this.transitionCircuitState(taskType, CircuitBreakerState.CLOSED);
  }
} 