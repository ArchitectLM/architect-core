/**
 * Circuit Breaker Extension
 * 
 * This extension implements the circuit breaker pattern to prevent cascading failures
 * and provide graceful degradation.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxRequests: number;
}

/**
 * Circuit breaker state
 */
interface CircuitStateInfo {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  halfOpenSuccesses: number;
}

/**
 * Circuit Breaker Extension
 */
export class CircuitBreakerExtension implements Extension {
  name = 'circuit-breaker';
  description = 'Implements circuit breaker pattern for fault tolerance';

  private states: Map<string, CircuitStateInfo> = new Map();
  private options: CircuitBreakerOptions;

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000,
      halfOpenMaxRequests: options.halfOpenMaxRequests || 3
    };
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    operationId: string,
    operation: () => Promise<T>,
    eventBus?: { publish: (eventType: string, payload: any) => void }
  ): Promise<T> {
    const state = this.getOrCreateState(operationId);

    // Check if circuit is open
    if (state.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - state.lastFailureTime >= this.options.resetTimeout) {
        // Circuit has been open long enough, try half-open
        state.state = CircuitState.HALF_OPEN;
        state.halfOpenSuccesses = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();

      // Handle success
      if (state.state === CircuitState.HALF_OPEN) {
        state.halfOpenSuccesses++;
        if (state.halfOpenSuccesses >= this.options.halfOpenMaxRequests) {
          state.state = CircuitState.CLOSED;
          state.failures = 0;
          if (eventBus) {
            eventBus.publish('circuit:closed', { operationId });
          }
        }
      }

      return result;
    } catch (error) {
      // Handle failure
      state.failures++;
      state.lastFailureTime = Date.now();

      if (state.state === CircuitState.CLOSED && state.failures >= this.options.failureThreshold) {
        state.state = CircuitState.OPEN;
        if (eventBus) {
          eventBus.publish('circuit:opened', { operationId, error });
        }
      } else if (state.state === CircuitState.HALF_OPEN) {
        state.state = CircuitState.OPEN;
        if (eventBus) {
          eventBus.publish('circuit:opened', { operationId, error });
        }
      }

      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(operationId: string): CircuitState {
    return this.getOrCreateState(operationId).state;
  }

  /**
   * Get or create circuit state
   */
  private getOrCreateState(operationId: string): CircuitStateInfo {
    if (!this.states.has(operationId)) {
      this.states.set(operationId, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        halfOpenSuccesses: 0
      });
    }
    return this.states.get(operationId)!;
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { eventType, event } = context;

    // Check if this is a circuit breaker event
    if (eventType.startsWith('circuit:')) {
      const operationId = event.payload.operationId;
      const state = this.getOrCreateState(operationId);

      if (eventType === 'circuit:opened') {
        state.state = CircuitState.OPEN;
        state.lastFailureTime = Date.now();
      } else if (eventType === 'circuit:closed') {
        state.state = CircuitState.CLOSED;
        state.failures = 0;
      }
    }

    return context;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.states.clear();
  }
} 