/**
 * Circuit Breaker Plugin
 * 
 * This plugin implements the circuit breaker pattern to prevent cascading failures by:
 * 1. Tracking task execution failures
 * 2. Opening the circuit after a threshold is reached
 * 3. Rejecting requests when the circuit is open
 * 4. Allowing test requests after a reset timeout
 * 5. Closing the circuit if test requests succeed
 * 
 * USAGE NOTES:
 * 1. The circuit breaker hooks must be properly registered with the runtime's extension system
 * 2. The extension system must execute hooks for task:beforeExecution, task:afterExecution, and task:onError
 * 3. For direct usage, you can call the hook methods directly: beforeTaskExecution, afterTaskExecution, onTaskError
 * 
 * Example direct usage:
 *   const circuitBreaker = createCircuitBreakerPlugin({ failureThreshold: 3 });
 *   
 *   // Before executing a task
 *   const beforeResult = await circuitBreaker.beforeTaskExecution({ taskType }, { state: {} });
 *   if (!beforeResult.success) {
 *     // Circuit is open, handle rejection
 *   }
 *   
 *   try {
 *     // Execute task
 *     const result = await executeTask();
 *     
 *     // Record success
 *     await circuitBreaker.afterTaskExecution({ taskType, result }, { state: {} });
 *     return result;
 *   } catch (error) {
 *     // Record failure
 *     await circuitBreaker.onTaskError({ taskType, error }, { state: {} });
 *     throw error;
 *   }
 */

import { Extension, ExtensionPointName, ExtensionPointNames, ExtensionContext } from '../models/extension-system';
import { Result } from '../models/core-types';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerAnalytics {
  successCount: number;
  failureCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  state: CircuitBreakerState;
  halfOpenAttempts: number;
}

interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  nextAttempt: number | null;
  halfOpenAttempts: number;
}

export class CircuitBreakerPlugin implements Extension {
  id = 'circuit-breaker';
  name = 'Circuit Breaker';
  description = 'Provides circuit breaker functionality to prevent cascading failures';
  dependencies: string[] = [];
  
  private circuits: Map<string, CircuitBreaker> = new Map();
  private options: CircuitBreakerOptions;
  
  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000, // 30 seconds default
      halfOpenMaxAttempts: options.halfOpenMaxAttempts || 1
    };
  }
  
  getHooks() {
    console.log(`[CircuitBreaker] Registering hooks with extension system`);
    return [
      {
        pointName: ExtensionPointNames.TASK_BEFORE_EXECUTE,
        hook: async (params: any, context: any) => this.beforeTaskExecution(params, context),
        priority: 10
      },
      {
        pointName: ExtensionPointNames.TASK_AFTER_EXECUTE,
        hook: async (params: any, context: any) => this.afterTaskExecution(params, context),
        priority: 10
      },
      {
        pointName: 'task:error',
        hook: async (params: any, context: any) => this.onTaskError(params, context),
        priority: 10
      }
    ];
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getCapabilities() {
    return ['fault-tolerance', 'resilience'];
  }
  
  async beforeTaskExecution(params: any, context: any): Promise<Result<any>> {
    const taskType = params.taskType;
    if (!taskType) return { success: true, value: params };
    
    console.log(`[CircuitBreaker] Checking circuit state for task: ${taskType}`);
    
    // Get or create circuit for this task
    const circuit = this.getCircuit(taskType);
    
    // Check if circuit is open
    if (circuit.state === CircuitBreakerState.OPEN) {
      // Check if it's time to move to half-open
      if (circuit.nextAttempt && Date.now() >= circuit.nextAttempt) {
        console.log(`[CircuitBreaker] Reset timeout elapsed for task ${taskType}, transitioning to HALF_OPEN`);
        this.transitionToState(taskType, CircuitBreakerState.HALF_OPEN);
      } else {
        console.log(`[CircuitBreaker] Rejecting task ${taskType} due to OPEN circuit`);
        return {
          success: false,
          error: new Error(`Circuit is OPEN for task ${taskType}. Retry after ${circuit.nextAttempt}`)
        };
      }
    }
    
    // Check if circuit is half-open and we've exceeded test attempts
    if (circuit.state === CircuitBreakerState.HALF_OPEN && 
        circuit.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
      console.log(`[CircuitBreaker] Rejecting task ${taskType} due to maximum HALF_OPEN attempts reached`);
      return {
        success: false,
        error: new Error(`Circuit is HALF_OPEN for task ${taskType} and maximum test attempts reached`)
      };
    }
    
    // If half-open, increment test attempts
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      console.log(`[CircuitBreaker] Allowing test request for task ${taskType} in HALF_OPEN state`);
      circuit.halfOpenAttempts++;
    }
    
    return { 
      success: true, 
      value: {
        ...params,
        _circuitBreaker: { taskType }
      }
    };
  }
  
  async afterTaskExecution(params: any, context: any): Promise<Result<any>> {
    const taskType = params._circuitBreaker?.taskType || params.taskType;
    if (!taskType) return { success: true, value: params };
    
    console.log(`[CircuitBreaker] Task ${taskType} executed successfully`);
    
    // Record success
    const circuit = this.getCircuit(taskType);
    circuit.successCount++;
    circuit.lastSuccess = new Date();
    
    // If half-open, transition back to closed
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      console.log(`[CircuitBreaker] Successful test request for task ${taskType}, transitioning from HALF_OPEN to CLOSED`);
      this.transitionToState(taskType, CircuitBreakerState.CLOSED);
    }
    
    return { success: true, value: params };
  }
  
  async onTaskError(params: any, context: any): Promise<Result<any>> {
    const taskType = params._circuitBreaker?.taskType || params.taskType;
    if (!taskType) return { success: true, value: params };
    
    // Record failure
    const circuit = this.getCircuit(taskType);
    circuit.failureCount++;
    circuit.lastFailure = new Date();
    
    console.log(`[CircuitBreaker] Task ${taskType} failed. Failure count: ${circuit.failureCount}, threshold: ${this.options.failureThreshold}`);
    
    // Check if we need to open the circuit
    if (circuit.state === CircuitBreakerState.CLOSED && 
        circuit.failureCount >= this.options.failureThreshold) {
      this.transitionToState(taskType, CircuitBreakerState.OPEN);
    }
    
    // If half-open and failed, go back to open
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToState(taskType, CircuitBreakerState.OPEN);
    }
    
    return { success: true, value: params };
  }
  
  // Get the current state of a circuit
  getCircuitState(taskType: string): CircuitBreakerState {
    return this.getCircuit(taskType).state;
  }
  
  // Get analytics for a circuit
  getCircuitAnalytics(taskType: string): CircuitBreakerAnalytics {
    const circuit = this.getCircuit(taskType);
    
    return {
      successCount: circuit.successCount,
      failureCount: circuit.failureCount,
      lastFailure: circuit.lastFailure,
      lastSuccess: circuit.lastSuccess,
      state: circuit.state,
      halfOpenAttempts: circuit.halfOpenAttempts
    };
  }
  
  // Manually reset a circuit to CLOSED state
  resetCircuit(taskType: string): void {
    this.transitionToState(taskType, CircuitBreakerState.CLOSED);
  }
  
  // Reset all circuits to CLOSED state
  resetAllCircuits(): void {
    console.log(`[CircuitBreaker] Resetting all circuits to CLOSED state`);
    this.circuits.forEach((_, taskType) => {
      this.resetCircuit(taskType);
    });
  }
  
  // Get or create a circuit for a task
  private getCircuit(taskType: string): CircuitBreaker {
    if (!this.circuits.has(taskType)) {
      this.circuits.set(taskType, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailure: null,
        lastSuccess: null,
        nextAttempt: null,
        halfOpenAttempts: 0
      });
    }
    
    return this.circuits.get(taskType)!;
  }
  
  // Transition a circuit to a new state
  private transitionToState(taskType: string, newState: CircuitBreakerState): void {
    const circuit = this.getCircuit(taskType);
    const oldState = circuit.state;
    
    // Log the transition for debugging
    console.log(`[CircuitBreaker] Transitioning task ${taskType} from ${oldState} to ${newState}`);
    
    // Update the state first to ensure it's properly set
    circuit.state = newState;
    
    // Handle state-specific logic
    if (newState === CircuitBreakerState.OPEN) {
      // Set next attempt time for transitioning to HALF_OPEN
      circuit.nextAttempt = Date.now() + this.options.resetTimeout;
      
      // Keep the failure count above threshold to prevent immediate recovery
      if (oldState !== CircuitBreakerState.HALF_OPEN) {
        circuit.failureCount = Math.max(circuit.failureCount, this.options.failureThreshold);
      }
      
      // Reset half-open attempts counter
      circuit.halfOpenAttempts = 0;
    } 
    else if (newState === CircuitBreakerState.CLOSED) {
      // When closing the circuit, reset the failure and half-open attempts counters
      circuit.failureCount = 0;
      circuit.halfOpenAttempts = 0;
      circuit.nextAttempt = null;
    } 
    else if (newState === CircuitBreakerState.HALF_OPEN) {
      // Reset half-open attempts counter to track test requests
      circuit.halfOpenAttempts = 0;
    }
  }
}

// Factory function to create the plugin
export function createCircuitBreakerPlugin(options: CircuitBreakerOptions): Extension {
  return new CircuitBreakerPlugin(options);
} 