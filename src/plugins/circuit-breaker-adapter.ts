// Using no imports to avoid module resolution issues - we'll explicitly define the types
export interface Runtime {
  executeTask: (taskType: string, input: any) => Promise<any>;
  // Other properties we might need
}

// Forward declare the types we need from CircuitBreakerPlugin
import { CircuitBreakerPlugin } from './circuit-breaker.js';

/**
 * CircuitBreakerAdapter
 * 
 * This adapter integrates the CircuitBreaker with the Runtime to ensure proper
 * hook execution and state management.
 * 
 * Unlike directly using the circuit breaker as an extension, this adapter
 * directly wires into the runtime's task execution flow, guaranteeing that
 * circuit breaker rules are enforced.
 */
export class CircuitBreakerAdapter {
  private originalExecuteTask: any;
  
  /**
   * Create a new CircuitBreakerAdapter
   * @param runtime The runtime to integrate with
   * @param circuitBreaker The circuit breaker plugin
   */
  constructor(
    private runtime: Runtime,
    private circuitBreaker: CircuitBreakerPlugin
  ) {}
  
  /**
   * Initialize the adapter by patching the runtime's executeTask method
   */
  initialize(): void {
    if (!this.runtime || !this.circuitBreaker) {
      throw new Error('Runtime and CircuitBreaker must be provided');
    }
    
    // Store the original executeTask method
    this.originalExecuteTask = this.runtime.executeTask.bind(this.runtime);
    
    // Patch the executeTask method
    this.runtime.executeTask = this.executeTaskWithCircuitBreaker.bind(this);
    
    console.log('[CircuitBreakerAdapter] Initialized and patched runtime.executeTask');
  }
  
  /**
   * Reset the runtime to its original state
   */
  cleanup(): void {
    if (this.runtime && this.originalExecuteTask) {
      this.runtime.executeTask = this.originalExecuteTask;
      console.log('[CircuitBreakerAdapter] Removed patch from runtime.executeTask');
    }
  }
  
  /**
   * Execute a task with circuit breaker protection
   * @param taskType The task type to execute
   * @param input The input for the task
   * @returns The task execution result
   */
  public async executeTaskWithCircuitBreaker(taskType: string, input: any): Promise<any> {
    console.log(`[CircuitBreakerAdapter] Executing ${taskType} with circuit breaker protection`);
    
    try {
      // Before execution: Check if circuit is open
      const beforeResult = await this.circuitBreaker.beforeTaskExecution(
        { taskType, ...input },
        { state: {} }
      );
      
      // If circuit is open, throw error
      if (!beforeResult.success) {
        console.log(`[CircuitBreakerAdapter] Circuit for ${taskType} is OPEN, rejecting execution`);
        throw beforeResult.error;
      }
      
      // Execute task
      console.log(`[CircuitBreakerAdapter] Circuit for ${taskType} is CLOSED, proceeding with execution`);
      const result = await this.originalExecuteTask(taskType, input);
      
      // After execution: Record success
      console.log(`[CircuitBreakerAdapter] Task ${taskType} executed successfully`);
      await this.circuitBreaker.afterTaskExecution(
        { taskType, ...input, result },
        { state: {} }
      );
      
      return result;
    } catch (error) {
      // On error: Record failure
      console.log(`[CircuitBreakerAdapter] Task ${taskType} failed: ${error}`);
      await this.circuitBreaker.onTaskError(
        { taskType, ...input, error },
        { state: {} }
      );
      
      throw error;
    }
  }
  
  /**
   * Get the current state of the circuit for a task
   * @param taskType The task type
   * @returns The current circuit state
   */
  getCircuitState(taskType: string): string {
    return this.circuitBreaker.getCircuitState(taskType);
  }
  
  /**
   * Get analytics for a task's circuit
   * @param taskType The task type
   * @returns The circuit analytics
   */
  getCircuitAnalytics(taskType: string): any {
    return this.circuitBreaker.getCircuitAnalytics(taskType);
  }
  
  /**
   * Reset a circuit to CLOSED state
   * @param taskType The task type
   */
  resetCircuit(taskType: string): void {
    this.circuitBreaker.resetCircuit(taskType);
  }
}

/**
 * Create a new CircuitBreakerAdapter
 * @param runtime The runtime to integrate with
 * @param circuitBreaker The circuit breaker plugin
 * @returns A new CircuitBreakerAdapter
 */
export function createCircuitBreakerAdapter(
  runtime: Runtime,
  circuitBreaker: CircuitBreakerPlugin
): CircuitBreakerAdapter {
  const adapter = new CircuitBreakerAdapter(runtime, circuitBreaker);
  adapter.initialize();
  return adapter;
} 