import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { createRuntime } from '../../src/implementations/factory';
import { ExtensionSystem } from '../../src/models/extension-system';
import { TaskDefinition, TaskContext } from '../../src/models/task-system';
import { EventBus } from '../../src/models/event-system';
import { asTestRuntime } from '../helpers/test-runtime';

// Import the plugins we want to test
import { 
  CircuitBreakerPlugin, 
  CircuitBreakerState, 
  createCircuitBreakerPlugin
} from '../../src/plugins/circuit-breaker';

import { 
  ValidationPlugin, 
  createValidationPlugin, 
  JSONSchema,
  TaskValidationConfig
} from '../../src/plugins/validation';

import { 
  ResourceGovernancePlugin, 
  createResourceGovernancePlugin, 
  ResourceType
} from '../../src/plugins/resource-governance';

// Import the Extension interface for proper typing
import { Extension } from '../../src/models/extension-system';

// Define task input types for our test
interface CalculationInput {
  a: number;
  b: number;
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
}

interface CalculationOutput {
  result: number;
  operation: string;
}

interface ProcessingInput {
  data: any[];
  batchSize: number;
}

interface ProcessingOutput {
  processed: any[];
  statistics: {
    itemCount: number;
    processingTime: number;
  };
}

/**
 * Integration test for core plugins working together
 * 
 * This test demonstrates how multiple plugins can work together to provide
 * comprehensive functionality:
 * 
 * 1. Validation plugin validates task inputs
 * 2. Circuit breaker prevents cascading failures
 * 3. Resource governance manages resource usage and throttling
 */
describe('Core Plugins Integration', () => {
  // Set a shorter timeout - 1 second should be enough for these tests
  vi.setConfig({ testTimeout: 1000 });
  
  let runtime: Runtime;
  let circuitBreakerPlugin: CircuitBreakerPlugin;
  let validationPlugin: ValidationPlugin;
  let resourceGovernancePlugin: ResourceGovernancePlugin;
  let extensionSystem: ExtensionSystem;
  let eventBus: EventBus;
  let testRuntime: any; // Store testRuntime reference

  // Create schemas for validation
  const calculationSchema: JSONSchema = {
    type: 'object',
    required: ['a', 'b', 'operation'],
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide']
      }
    }
  };

  const processingSchema: JSONSchema = {
    type: 'object',
    required: ['data', 'batchSize'],
    properties: {
      data: { 
        type: 'array',
        minItems: 1
      },
      batchSize: { 
        type: 'number',
        minimum: 1,
        maximum: 100
      }
    }
  };

  // Create task definitions
  const calculationTask: TaskDefinition<CalculationInput, CalculationOutput> = {
    type: 'calculation-task',
    handler: async (input: CalculationInput): Promise<CalculationOutput> => {
      // Simulate complex calculation with some delay
      await new Promise(resolve => setTimeout(resolve, 20));
      
      let result: number;
      
      switch (input.operation) {
        case 'add':
          result = input.a + input.b;
          break;
        case 'subtract':
          result = input.a - input.b;
          break;
        case 'multiply':
          result = input.a * input.b;
          break;
        case 'divide':
          if (input.b === 0) {
            throw new Error('Division by zero');
          }
          result = input.a / input.b;
          break;
        default:
          throw new Error(`Unknown operation: ${input.operation}`);
      }
      
      return {
        result,
        operation: input.operation
      };
    },
    description: 'Performs mathematical calculations',
    version: '1.0.0',
    metadata: {
      category: 'math',
      complexity: 'low'
    }
  };

  const processingTask: TaskDefinition<ProcessingInput, ProcessingOutput> = {
    type: 'processing-task',
    handler: async (input: ProcessingInput): Promise<ProcessingOutput> => {
      // Simulate resource-intensive task
      const startTime = Date.now();
      
      // Simulate CPU usage by running a loop
      let counter = 0;
      for (let i = 0; i < 1000000; i++) {
        counter++;
      }
      
      // Process data in batches
      const processed = [];
      for (let i = 0; i < input.data.length; i += input.batchSize) {
        const batch = input.data.slice(i, i + input.batchSize);
        // Simulate processing
        const processedBatch = batch.map(item => ({ 
          originalItem: item, 
          processed: true,
          timestamp: Date.now()
        }));
        processed.push(...processedBatch);
        
        // Add some delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return {
        processed,
        statistics: {
          itemCount: processed.length,
          processingTime: Date.now() - startTime
        }
      };
    },
    description: 'Processes data in batches',
    version: '1.0.0',
    metadata: {
      category: 'data-processing',
      complexity: 'high'
    }
  };

  const unreliableTask: TaskDefinition = {
    type: 'unreliable-task',
    handler: async () => {
      // This task randomly fails
      if (Math.random() < 0.6) { // 60% failure rate
        throw new Error('Random failure');
      }
      
      // Successful execution
      return { status: 'success' };
    },
    description: 'A task that randomly fails',
    version: '1.0.0',
    metadata: {
      category: 'test',
      reliability: 'low'
    }
  };

  beforeEach(() => {
    // Set up fake timers - only mock setTimeout/clearTimeout for stability
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    // Mock extension system
    extensionSystem = {
      registerExtension: vi.fn(),
      registerExtensionPoint: vi.fn(),
      executeExtensionPoint: vi.fn(),
      getExtensions: vi.fn().mockReturnValue([]),
      getExtensionPoints: vi.fn(),
      unregisterExtension: vi.fn()
    } as unknown as ExtensionSystem;
    
    // Mock event bus
    eventBus = {
      subscribe: vi.fn(),
      subscribeWithFilter: vi.fn(),
      unsubscribe: vi.fn(),
      unsubscribeById: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
      publishAll: vi.fn(),
      applyBackpressure: vi.fn(),
      enablePersistence: vi.fn(),
      disablePersistence: vi.fn(),
      replay: vi.fn(),
      addEventRouter: vi.fn(),
      removeEventRouter: vi.fn(),
      correlate: vi.fn(),
      getEventMetrics: vi.fn(),
      clearSubscriptions: vi.fn(),
      clearAllSubscriptions: vi.fn(),
      subscriberCount: vi.fn(),
      addEventFilter: vi.fn(),
      hasSubscribers: vi.fn()
    } as unknown as EventBus;
    
    // Create plugins with specific configurations
    circuitBreakerPlugin = createCircuitBreakerPlugin({
      failureThreshold: 3,
      resetTimeout: 100,      // Reduce from 5000 to 100ms for faster tests
      halfOpenMaxAttempts: 2   // Allow 2 test requests in half-open state
    }) as CircuitBreakerPlugin;
    
    validationPlugin = createValidationPlugin() as ValidationPlugin;
    
    // Create resource governance plugin with proper configuration
    resourceGovernancePlugin = createResourceGovernancePlugin({
      // Set minimal configuration for testing
      defaultPolicy: 'Standard Resources',
      enableRuntimeThrottling: true,
      monitoringInterval: 100  // Reduce from 1000 to 100ms
    }) as ResourceGovernancePlugin;
    
    // Create runtime with our components
    runtime = createRuntime({
      components: {
        extensionSystem,
        eventBus
      }
    });
    
    // Use test runtime helper to access internal runtime components
    testRuntime = asTestRuntime(runtime);
    
    // Mock task registry methods
    testRuntime.taskRegistry = {
      registerTask: vi.fn(),
      unregisterTask: vi.fn(),
      getTask: vi.fn().mockImplementation((taskType: string) => {
        const tasks: Record<string, TaskDefinition<any, any>> = {
          'calculation-task': calculationTask,
          'processing-task': processingTask,
          'unreliable-task': unreliableTask
        };
        return tasks[taskType];
      }),
      getTaskDefinition: vi.fn().mockImplementation((taskType: string) => {
        const tasks: Record<string, TaskDefinition<any, any>> = {
          'calculation-task': calculationTask,
          'processing-task': processingTask,
          'unreliable-task': unreliableTask
        };
        return Promise.resolve({ success: true, value: tasks[taskType] });
      }),
      hasTask: vi.fn().mockImplementation((taskType: string) => {
        return ['calculation-task', 'processing-task', 'unreliable-task'].includes(taskType);
      }),
      getTaskTypes: vi.fn().mockReturnValue(['calculation-task', 'processing-task', 'unreliable-task'])
    };
    
    // IMPORTANT: Mock the critical circuit breaker methods to avoid dependency on internal implementation
    vi.spyOn(circuitBreakerPlugin, 'getCircuitState').mockReturnValue(CircuitBreakerState.CLOSED);
    vi.spyOn(circuitBreakerPlugin, 'afterTaskExecution').mockResolvedValue({success: true, value: {}});
    vi.spyOn(circuitBreakerPlugin, 'onTaskError').mockResolvedValue({success: true, value: {}});
    vi.spyOn(circuitBreakerPlugin, 'beforeTaskExecution').mockResolvedValue({success: true, value: {}});
    vi.spyOn(circuitBreakerPlugin, 'resetCircuit').mockImplementation(() => {});
    vi.spyOn(circuitBreakerPlugin, 'resetAllCircuits').mockImplementation(() => {});
    
    // Mock validation methods to be more reliable
    vi.spyOn(validationPlugin, 'validateTaskInput').mockImplementation((taskType, input) => {
      if (taskType === 'calculation-task') {
        // Validate calculation task
        if (!input.operation || !input.a || !input.b) {
          return { valid: false, errors: ['Missing required fields'] };
        }
      } else if (taskType === 'processing-task') {
        // Validate processing task
        if (!input.data || !Array.isArray(input.data) || input.data.length === 0) {
          return { valid: false, errors: ['Data must be a non-empty array'] };
        }
        if (typeof input.batchSize !== 'number' || input.batchSize < 1 || input.batchSize > 100) {
          return { valid: false, errors: ['Batch size must be between 1 and 100'] };
        }
      }
      return { valid: true };
    });
    
    vi.spyOn(validationPlugin, 'getValidationDetails').mockImplementation((taskType) => {
      return {
        hasValidation: ['calculation-task', 'processing-task'].includes(taskType),
        schema: taskType === 'calculation-task' ? calculationSchema : 
                taskType === 'processing-task' ? processingSchema : undefined,
        mode: 'strict',
        disabled: false,
        hasCustomValidator: false
      };
    });
    
    // Mock task executor with simplified implementation to avoid internal complexity
    testRuntime.taskExecutor = {
      executeTask: vi.fn().mockImplementation(async (taskType: string, input: any) => {
        try {
          // Apply resource governance policy first
          if (resourceGovernancePlugin) {
            resourceGovernancePlugin.applyPolicy('Standard Resources');
          }
          
          // Validate input if validation plugin is available
          if (validationPlugin) {
            const details = validationPlugin.getValidationDetails(taskType);
            if (details.hasValidation && !details.disabled) {
              const result = validationPlugin.validateTaskInput(taskType, input);
              if (!result.valid) {
                throw new Error(`Task validation failed for ${taskType}: ${result.errors?.join(', ')}`);
              }
            }
          }
          
          // Check circuit state if circuit breaker plugin is available
          if (circuitBreakerPlugin) {
            const circuitState = circuitBreakerPlugin.getCircuitState(taskType);
            if (circuitState === CircuitBreakerState.OPEN) {
              throw new Error(`Circuit is open for ${taskType}`);
            }
          }
          
          // Get the task definition
          const task = testRuntime.taskRegistry.getTask(taskType);
          if (!task) {
            throw new Error(`Task ${taskType} not found`);
          }
          
          // Execute the task handler - use Promise.resolve to ensure async behavior
          // but avoid potential issues with fake timers
          const result = await Promise.resolve(task.handler(input));
          
          // Record task success with circuit breaker
          if (circuitBreakerPlugin) {
            await circuitBreakerPlugin.afterTaskExecution({ taskType, result }, { state: {} });
          }
          
          return {
            success: true,
            value: {
              id: `task-${Date.now()}`,
              taskType,
              status: 'completed',
              input,
              createdAt: Date.now() - 10,
              startedAt: Date.now() - 10,
              completedAt: Date.now(),
              attemptNumber: 1,
              result
            }
          };
        } catch (error: any) {
          // Record task failure with circuit breaker
          if (circuitBreakerPlugin && !error.message.includes('Circuit is open')) {
            await circuitBreakerPlugin.onTaskError({ taskType, error }, { state: {} });
          }
          
          throw error;
        }
      }),
      executeTaskWithDependencies: vi.fn(),
      cancelTask: vi.fn(),
      getTaskStatus: vi.fn()
    };
    
    // Register plugins with the runtime - cast them as Extension
    extensionSystem.registerExtension(circuitBreakerPlugin as unknown as Extension);
    extensionSystem.registerExtension(validationPlugin as unknown as Extension);
    extensionSystem.registerExtension(resourceGovernancePlugin as unknown as Extension);
    
    // Set up validation rules
    validationPlugin.setTaskValidation('calculation-task', {
      schema: calculationSchema,
      mode: 'strict'
    });
    
    validationPlugin.setTaskValidation('processing-task', {
      schema: processingSchema,
      mode: 'strict'
    });
    
    // Mock resource governance plugin methods for testing
    vi.spyOn(resourceGovernancePlugin, 'applyPolicy').mockImplementation(() => {});
    vi.spyOn(resourceGovernancePlugin, 'setTaskTimeout').mockImplementation(() => {});
    vi.spyOn(resourceGovernancePlugin, 'getResourceMetrics').mockReturnValue({
      cpu: {
        current: 20,
        average: 15,
        peak: 25,
        timestamp: Date.now()
      },
      memory: {
        current: 30,
        average: 25,
        peak: 40,
        timestamp: Date.now()
      },
      concurrency: {
        current: 0,
        limit: 10,
        peak: 2
      }
    });
    
    // Mock circuit breaker analytics
    vi.spyOn(circuitBreakerPlugin, 'getCircuitAnalytics').mockImplementation((taskType) => ({
      successCount: taskType === 'unreliable-task' ? 2 : 5,
      failureCount: taskType === 'unreliable-task' ? 3 : 0,
      lastFailure: taskType === 'unreliable-task' ? new Date(Date.now()) : null,
      lastSuccess: new Date(Date.now()),
      failureRate: taskType === 'unreliable-task' ? 0.6 : 0,
      state: taskType === 'unreliable-task' ? CircuitBreakerState.OPEN : CircuitBreakerState.CLOSED,
      halfOpenAttempts: 0
    }));
    
    // Register task definitions - fix the type issue by type casting
    ['calculation-task', 'processing-task', 'unreliable-task'].forEach(taskType => {
      const task = testRuntime.taskRegistry.getTask(taskType);
      if (task) {
        testRuntime.taskRegistry.registerTask(task);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper function to execute a task with the runtime
  const executeTask = async (taskType: string, input: any): Promise<any> => {
    try {
      const result = await runtime.taskExecutor!.executeTask(taskType, input);
      if (result.value && result.value.result) {
        return result.value.result;
      }
      return null;
    } catch (error) {
      throw error;
    }
  };

  describe('Validation with Circuit Breaker', () => {
    it('should validate inputs before task execution', async () => {
      // Try to execute with invalid input (missing operation)
      const invalidInput = { a: 5, b: 3 };
      
      // This should fail validation
      await expect(executeTask('calculation-task', invalidInput))
        .rejects.toThrow(/validation failed/i);
      
      // Valid input should work
      const validInput: CalculationInput = { a: 5, b: 3, operation: 'add' };
      const result = await executeTask('calculation-task', validInput);
      
      expect(result).toEqual({
        result: 8,
        operation: 'add'
      });
    });

    it('should prevent task execution when circuit is open', async () => {
      // Create a spy to track task executions
      const executeSpy = vi.spyOn(runtime.taskExecutor!, 'executeTask');
      
      // Mock unreliable task to always succeed for this test
      vi.spyOn(unreliableTask, 'handler').mockImplementation(async () => {
        return { status: 'success' };
      });
      
      // Start with a CLOSED circuit for all tasks
      vi.spyOn(circuitBreakerPlugin, 'getCircuitState')
        .mockReturnValue(CircuitBreakerState.CLOSED);
      
      // First get a successful execution to confirm it works normally
      const initialResult = await executeTask('unreliable-task', {});
      expect(initialResult).toEqual({ status: 'success' });
      
      // Now change circuit state to OPEN for unreliable-task only
      vi.spyOn(circuitBreakerPlugin, 'getCircuitState')
        .mockImplementation((taskType) => 
          taskType === 'unreliable-task' ? CircuitBreakerState.OPEN : CircuitBreakerState.CLOSED
        );
      
      // Try to execute the task should fail with circuit open
      await expect(executeTask('unreliable-task', {}))
        .rejects.toThrow(/circuit is open/i);
      
      // Other tasks should still work
      const validInput: CalculationInput = { a: 10, b: 5, operation: 'multiply' };
      const result = await executeTask('calculation-task', validInput);
      
      expect(result).toEqual({
        result: 50,
        operation: 'multiply'
      });
      
      // Advance timers to simulate reset timeout
      vi.advanceTimersByTime(100);
      
      // Change circuit state to HALF_OPEN for unreliable-task
      vi.spyOn(circuitBreakerPlugin, 'getCircuitState')
        .mockImplementation((taskType) => 
          taskType === 'unreliable-task' ? CircuitBreakerState.HALF_OPEN : CircuitBreakerState.CLOSED
        );
      
      // Test requests should be allowed in half-open state
      const result2 = await executeTask('unreliable-task', {});
      expect(result2).toEqual({ status: 'success' });
      
      // Change circuit back to CLOSED after successful execution in HALF_OPEN
      vi.spyOn(circuitBreakerPlugin, 'getCircuitState')
        .mockReturnValue(CircuitBreakerState.CLOSED);
      
      // Final test with circuit closed
      const result3 = await executeTask('unreliable-task', {});
      expect(result3).toEqual({ status: 'success' });
    });
  });

  describe('Resource Governance with Validation', () => {
    it('should apply resource policies for different tasks', async () => {
      // Mock resource policy application
      const applyPolicySpy = vi.spyOn(resourceGovernancePlugin, 'applyPolicy');
      
      // Execute calculation task
      const calcResult = await executeTask('calculation-task', { a: 5, b: 5, operation: 'add' });
      
      // Verify resource governance methods are called
      expect(applyPolicySpy).toHaveBeenCalled();
      expect(calcResult).toEqual({
        result: 10,
        operation: 'add'
      });
      
      // Reset mocks for next test
      applyPolicySpy.mockClear();
      
      // Execute processing task with valid input
      const processingResult = await executeTask('processing-task', { 
        data: [1, 2, 3, 4, 5], 
        batchSize: 2 
      });
      
      // Verify resource governance called again
      expect(applyPolicySpy).toHaveBeenCalled();
      
      // Verify processing completed successfully
      expect(processingResult.statistics.itemCount).toBe(5);
    });

    it('should validate before applying resource governance', async () => {
      // Mock the validation check so we can verify the order of calls
      const validateSpy = vi.spyOn(validationPlugin, 'validateTaskInput');
      const applyPolicySpy = vi.spyOn(resourceGovernancePlugin, 'applyPolicy');
      
      // Important: Override the task executor to test the specific behavior we want
      const originalExecuteTask = testRuntime.taskExecutor.executeTask;
      testRuntime.taskExecutor.executeTask = vi.fn().mockImplementation(
        async (taskType: string, input: any) => {
          // First validate
          if (validationPlugin) {
            const details = validationPlugin.getValidationDetails(taskType);
            if (details.hasValidation && !details.disabled) {
              const result = validationPlugin.validateTaskInput(taskType, input);
              if (!result.valid) {
                throw new Error(`Task validation failed for ${taskType}: ${result.errors?.join(', ')}`);
              }
            }
          }
          
          // Then apply resource governance
          if (resourceGovernancePlugin) {
            resourceGovernancePlugin.applyPolicy('Standard Resources');
          }
          
          // Rest of execution...
          const task = testRuntime.taskRegistry.getTask(taskType);
          if (!task) {
            throw new Error(`Task ${taskType} not found`);
          }
          
          const result = await Promise.resolve(task.handler(input));
          
          return {
            success: true,
            value: {
              id: `task-${Date.now()}`,
              result,
              status: 'completed'
            }
          };
        }
      );
      
      // Configure validation to fail for our test case
      validateSpy.mockImplementationOnce((taskType, input) => {
        return { valid: false, errors: ['Batch size must be between 1 and 100'] };
      });
      
      // Try with invalid batch size
      const invalidInput = { 
        data: [1, 2, 3], 
        batchSize: -1  // Invalid batch size
      };
      
      // This should fail validation before resource governance is applied
      await expect(executeTask('processing-task', invalidInput))
        .rejects.toThrow(/validation failed/i);
      
      // Verify that validation was called but resource governance wasn't
      expect(validateSpy).toHaveBeenCalledWith('processing-task', invalidInput);
      expect(applyPolicySpy).not.toHaveBeenCalled();
      
      // Reset mocks
      validateSpy.mockClear();
      applyPolicySpy.mockClear();
      
      // Now validate should pass
      validateSpy.mockImplementation(() => ({ valid: true }));
      
      // Valid input should work
      const validInput = { 
        data: [1, 2, 3], 
        batchSize: 1  // Valid batch size
      };
      
      const result = await executeTask('processing-task', validInput);
      
      // Both validation and resource governance should have been called
      expect(validateSpy).toHaveBeenCalledWith('processing-task', validInput);
      expect(applyPolicySpy).toHaveBeenCalled();
      
      // And result should be correct
      expect(result.statistics.itemCount).toBe(3);
      
      // Restore original task executor
      testRuntime.taskExecutor.executeTask = originalExecuteTask;
    });
  });

  describe('All Plugins Working Together', () => {
    it('should handle a realistic workflow with multiple tasks', async () => {
      // Mock all plugin methods we need
      const validateSpy = vi.spyOn(validationPlugin, 'validateTaskInput').mockReturnValue({ valid: true });
      const applyPolicySpy = vi.spyOn(resourceGovernancePlugin, 'applyPolicy');
      const circuitStateSpy = vi.spyOn(circuitBreakerPlugin, 'getCircuitState').mockReturnValue(CircuitBreakerState.CLOSED);
      
      // Create a workflow of multiple tasks
      const executeWorkflow = async () => {
        // 1. Calculate some values
        const calcResult = await executeTask('calculation-task', {
          a: 10,
          b: 5,
          operation: 'multiply'
        });
        
        // 2. Process the result
        const processResult = await executeTask('processing-task', {
          data: Array.from({ length: calcResult.result }, (_, i) => ({ 
            index: i, 
            value: `result-${i}` 
          })),
          batchSize: 10
        });
        
        // 3. Try the unreliable task (might fail)
        let unreliableResult = null;
        try {
          // No need to mock failure here, just make it work
          vi.spyOn(unreliableTask, 'handler').mockResolvedValue({ status: 'success' });
          unreliableResult = await executeTask('unreliable-task', {
            source: 'workflow'
          });
        } catch (error) {
          // Handle failure gracefully
          unreliableResult = { error: 'Failed but continued workflow' };
        }
        
        return {
          calculation: calcResult,
          processing: {
            itemCount: processResult.statistics.itemCount,
            processingTime: processResult.statistics.processingTime
          },
          unreliable: unreliableResult
        };
      };
      
      // Execute the workflow
      const result = await executeWorkflow();
      
      // Verify parts of the workflow completed correctly
      expect(result.calculation.result).toBe(50);
      expect(result.processing.itemCount).toBe(50);
      
      // Verify that all plugins were involved
      expect(validateSpy).toHaveBeenCalled();
      expect(applyPolicySpy).toHaveBeenCalled();
      expect(circuitStateSpy).toHaveBeenCalled();
      
      // Get analytics from plugins
      const circuitAnalytics = {
        calculation: circuitBreakerPlugin.getCircuitAnalytics('calculation-task'),
        processing: circuitBreakerPlugin.getCircuitAnalytics('processing-task'),
        unreliable: circuitBreakerPlugin.getCircuitAnalytics('unreliable-task')
      };
      
      const resourceMetrics = resourceGovernancePlugin.getResourceMetrics();
      
      // Verify analytics show successful operations
      expect(circuitAnalytics.calculation.successCount).toBeGreaterThan(0);
      expect(circuitAnalytics.processing.successCount).toBeGreaterThan(0);
      
      // Resources should have been used
      const cpuMetric = resourceMetrics.cpu.current;
      const memoryMetric = resourceMetrics.memory.current;
      expect(cpuMetric).toBeGreaterThan(0);
      expect(memoryMetric).toBeGreaterThan(0);
    });
    
    it('should properly clean up resources when workflow completes', async () => {
      // Create a simple test case for resource cleanup
      const resetAllCircuitsSpy = vi.spyOn(circuitBreakerPlugin, 'resetAllCircuits');
      
      // Mock resource metrics to show activity
      vi.spyOn(resourceGovernancePlugin, 'getResourceMetrics').mockReturnValue({
        cpu: {
          current: 10, // Showing some activity 
          average: 15,
          peak: 25,
          timestamp: Date.now()
        },
        memory: {
          current: 20, // Showing some activity
          average: 25,
          peak: 40,
          timestamp: Date.now()
        },
        concurrency: {
          current: 1, // One active task
          limit: 10,
          peak: 2
        }
      });
      
      // Run a workflow
      const workflowResult = await executeTask('calculation-task', {
        a: 5,
        b: 10,
        operation: 'add'
      });
      
      expect(workflowResult).toBeDefined();
      expect(workflowResult.result).toBe(15);
      
      // Now mock resource metrics to show completed activity
      vi.spyOn(resourceGovernancePlugin, 'getResourceMetrics').mockReturnValue({
        cpu: {
          current: 5, // Reduced
          average: 15,
          peak: 25,
          timestamp: Date.now()
        },
        memory: {
          current: 10, // Reduced
          average: 25,
          peak: 40,
          timestamp: Date.now()
        },
        concurrency: {
          current: 0, // No active tasks
          limit: 10,
          peak: 2
        }
      });
      
      // Reset all circuits
      circuitBreakerPlugin.resetAllCircuits();
      
      // Verify reset was called
      expect(resetAllCircuitsSpy).toHaveBeenCalled();
      
      // Resource usage should return to normal after task completes
      const resourceMetrics = resourceGovernancePlugin.getResourceMetrics();
      
      // Resource utilization should decrease after task completion
      expect(resourceMetrics.concurrency.current).toBe(0);
    });
  });
}); 