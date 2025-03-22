import { Extension } from '../models/extension';

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

export interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  nextAttempt: number | null;
  halfOpenAttempts: number;
}

export class CircuitBreakerPlugin implements Extension {
  name = 'circuit-breaker';
  description = 'Provides circuit breaker functionality to prevent cascading failures';
  
  private circuits: Map<string, CircuitBreaker> = new Map();
  private options: CircuitBreakerOptions;
  
  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000, // 30 seconds default
      halfOpenMaxAttempts: options.halfOpenMaxAttempts || 1
    };
  }
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const taskType = context.taskType;
      
      // Get or create circuit for this task
      const circuit = this.getCircuit(taskType);
      
      // Check if circuit is open
      if (circuit.state === CircuitBreakerState.OPEN) {
        // Check if it's time to move to half-open
        if (circuit.nextAttempt && Date.now() >= circuit.nextAttempt) {
          this.transitionToState(taskType, CircuitBreakerState.HALF_OPEN);
        } else {
          throw new Error(`Circuit is OPEN for task ${taskType}. Retry after ${circuit.nextAttempt}`);
        }
      }
      
      // Check if circuit is half-open and we've exceeded test attempts
      if (circuit.state === CircuitBreakerState.HALF_OPEN && 
          circuit.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        throw new Error(`Circuit is HALF_OPEN for task ${taskType} and maximum test attempts reached`);
      }
      
      // If half-open, increment test attempts
      if (circuit.state === CircuitBreakerState.HALF_OPEN) {
        circuit.halfOpenAttempts++;
      }
      
      return {
        ...context,
        _circuitBreaker: {
          taskType
        }
      };
    },
    
    'task:afterExecution': async (context: any) => {
      const taskType = context._circuitBreaker?.taskType;
      if (!taskType) return context;
      
      // Record success
      const circuit = this.getCircuit(taskType);
      circuit.successCount++;
      circuit.lastSuccess = new Date();
      
      // If half-open, transition back to closed
      if (circuit.state === CircuitBreakerState.HALF_OPEN) {
        this.transitionToState(taskType, CircuitBreakerState.CLOSED);
      }
      
      return context;
    },
    
    'task:onError': async (context: any) => {
      const taskType = context._circuitBreaker?.taskType;
      if (!taskType) return context;
      
      // Record failure
      const circuit = this.getCircuit(taskType);
      circuit.failureCount++;
      circuit.lastFailure = new Date();
      
      // Check if we need to open the circuit
      if (circuit.state === CircuitBreakerState.CLOSED && 
          circuit.failureCount >= this.options.failureThreshold) {
        this.transitionToState(taskType, CircuitBreakerState.OPEN);
      }
      
      // If half-open and failed, go back to open
      if (circuit.state === CircuitBreakerState.HALF_OPEN) {
        this.transitionToState(taskType, CircuitBreakerState.OPEN);
      }
      
      return context;
    }
  };
  
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
    
    // Handle state-specific logic
    if (newState === CircuitBreakerState.OPEN) {
      circuit.nextAttempt = Date.now() + this.options.resetTimeout;
    } else if (newState === CircuitBreakerState.CLOSED) {
      circuit.failureCount = 0;
      circuit.halfOpenAttempts = 0;
      circuit.nextAttempt = null;
    } else if (newState === CircuitBreakerState.HALF_OPEN) {
      circuit.halfOpenAttempts = 0;
    }
    
    circuit.state = newState;
  }
}

// Factory function to create the plugin
export function createCircuitBreakerPlugin(options: CircuitBreakerOptions): Extension {
  return new CircuitBreakerPlugin(options);
} 