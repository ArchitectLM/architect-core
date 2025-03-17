/**
 * Simple example of circuit breaker pattern with the extension system
 */
import { 
  createExtensionSystem, 
  DefaultExtensionSystem,
  Extension
} from '../src/extension-system.js';

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'closed',   // Normal operation, requests pass through
  OPEN = 'open',       // Circuit is open, requests fail fast
  HALF_OPEN = 'half-open' // Testing if the service is back
}

/**
 * Circuit breaker options
 */
interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccessThreshold?: number;
}

/**
 * Simple circuit breaker extension
 */
class CircuitBreakerExtension implements Extension {
  name = 'circuit-breaker';
  description = 'Implements the circuit breaker pattern';
  
  private circuits: Map<string, {
    state: CircuitState;
    failures: number;
    lastFailure: number;
    options: CircuitBreakerOptions;
    halfOpenSuccesses: number;
  }> = new Map();
  
  /**
   * Create a new circuit
   */
  createCircuit(name: string, options: CircuitBreakerOptions): void {
    this.circuits.set(name, {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailure: 0,
      options,
      halfOpenSuccesses: 0
    });
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(circuitName: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.circuits.get(circuitName);
    
    if (!circuit) {
      throw new Error(`Circuit '${circuitName}' not found`);
    }
    
    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      const now = Date.now();
      const resetTimeout = circuit.options.resetTimeout;
      
      // Check if reset timeout has elapsed
      if (now - circuit.lastFailure > resetTimeout) {
        // Transition to half-open state
        circuit.state = CircuitState.HALF_OPEN;
        circuit.halfOpenSuccesses = 0;
        console.log(`Circuit '${circuitName}' transitioned to half-open state`);
      } else {
        // Circuit is still open, fail fast
        console.log(`Circuit '${circuitName}' is open, failing fast`);
        throw new Error(`Circuit '${circuitName}' is open`);
      }
    }
    
    try {
      // Execute the function
      const result = await fn();
      
      // Handle success
      if (circuit.state === CircuitState.HALF_OPEN) {
        circuit.halfOpenSuccesses++;
        
        // Check if we've reached the success threshold
        const successThreshold = circuit.options.halfOpenSuccessThreshold || 1;
        if (circuit.halfOpenSuccesses >= successThreshold) {
          // Reset the circuit
          circuit.state = CircuitState.CLOSED;
          circuit.failures = 0;
          console.log(`Circuit '${circuitName}' closed after successful test`);
        }
      } else if (circuit.state === CircuitState.CLOSED) {
        // Reset failures on success
        circuit.failures = 0;
      }
      
      return result;
    } catch (error) {
      // Handle failure
      circuit.failures++;
      circuit.lastFailure = Date.now();
      
      // Check if we've reached the failure threshold
      if (circuit.state === CircuitState.CLOSED && 
          circuit.failures >= circuit.options.failureThreshold) {
        // Open the circuit
        circuit.state = CircuitState.OPEN;
        console.log(`Circuit '${circuitName}' opened after ${circuit.failures} failures`);
      } else if (circuit.state === CircuitState.HALF_OPEN) {
        // If we fail in half-open state, go back to open
        circuit.state = CircuitState.OPEN;
        console.log(`Circuit '${circuitName}' reopened after failure in half-open state`);
      }
      
      throw error;
    }
  }
  
  hooks = {
    'circuit.execute': async (context: { 
      circuitName: string; 
      fn: () => Promise<any>;
    }) => {
      return this.execute(context.circuitName, context.fn);
    },
    
    'circuit.state': (context: { circuitName: string }) => {
      const circuit = this.circuits.get(context.circuitName);
      if (!circuit) {
        return { exists: false };
      }
      
      return {
        exists: true,
        state: circuit.state,
        failures: circuit.failures,
        lastFailure: circuit.lastFailure
      };
    }
  };
}

/**
 * Simple example of circuit breaker pattern
 */
async function simpleExample() {
  console.log("Starting simple circuit breaker example...");
  
  // Create the extension system
  const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
  
  // Register extension points
  extensionSystem.registerExtensionPoint({
    name: 'circuit.execute',
    description: 'Executes a function with circuit breaker protection',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'circuit.state',
    description: 'Gets the state of a circuit',
    handlers: []
  });
  
  // Create and register the circuit breaker extension
  const circuitBreakerExtension = new CircuitBreakerExtension();
  extensionSystem.registerExtension(circuitBreakerExtension);
  
  // Create a circuit
  circuitBreakerExtension.createCircuit('api', {
    failureThreshold: 3,
    resetTimeout: 5000, // 5 seconds
    halfOpenSuccessThreshold: 2
  });
  
  // Simulate a flaky API
  let apiCallCount = 0;
  const callApi = async () => {
    apiCallCount++;
    
    // Fail on calls 2, 3, 4, and succeed on others
    if (apiCallCount >= 2 && apiCallCount <= 4) {
      console.log(`API call ${apiCallCount} failing...`);
      throw new Error('API error');
    }
    
    console.log(`API call ${apiCallCount} succeeding...`);
    return { data: `Response from API call ${apiCallCount}` };
  };
  
  // Make several API calls through the circuit breaker
  for (let i = 0; i < 10; i++) {
    try {
      // Get circuit state
      const circuitState = await extensionSystem.triggerExtensionPoint('circuit.state', { 
        circuitName: 'api' 
      });
      console.log(`Circuit state before call ${i+1}:`, circuitState.state || 'closed');
      
      // Execute the API call through the circuit breaker
      const result = await extensionSystem.triggerExtensionPoint('circuit.execute', {
        circuitName: 'api',
        fn: callApi
      });
      
      console.log(`Call ${i+1} result:`, result);
    } catch (error) {
      console.log(`Call ${i+1} error:`, (error as Error).message);
    }
    
    // Add a delay between calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("Simple circuit breaker example completed.");
}

// Run the example
simpleExample().catch(error => {
  console.error("Error running example:", error);
}); 