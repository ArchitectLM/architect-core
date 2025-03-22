import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReactiveRuntime } from '../../src/implementations/runtime';
import { ExtensionSystemImpl } from '../../src/implementations/extension-system';
import { EventBusImpl } from '../../src/implementations/event-bus';
import { RateLimitingPlugin } from '../../src/plugins/rate-limiting';
import { ProcessManagementPlugin } from '../../src/plugins/process-management';
import { TaskManagementPlugin } from '../../src/plugins/task-management';
import { TaskDependenciesPlugin } from '../../src/plugins/task-dependencies';
import { RetryPlugin } from '../../src/plugins/retry';
import { ProcessRecoveryPlugin } from '../../src/plugins/process-recovery';
import { TransactionPlugin } from '../../src/plugins/transaction-management';
import { createProcessManagementPlugin, createTaskManagementPlugin, createTaskDependenciesPlugin, createRetryPlugin, createProcessRecoveryPlugin } from '../../src/plugins/index';
import { createTransactionPluginInstance } from '../../src/factories';
import { BackoffStrategy } from '../../src/plugins/retry';
import { InMemoryExtensionSystem } from '../../src/implementations/extension-system';
import { InMemoryEventBus } from '../../src/implementations/event-bus';
import { createModernRuntime } from '../../src/runtime';

describe('Rate Limiting Plugin', () => {
  let runtime: ReactiveRuntime;
  let extensionSystem: InMemoryExtensionSystem;
  let eventBus: InMemoryEventBus;
  let rateLimitingPlugin: RateLimitingPlugin;
  let processManagementPlugin: ProcessManagementPlugin;
  let taskManagementPlugin: TaskManagementPlugin;
  let taskDependenciesPlugin: TaskDependenciesPlugin;
  let retryPlugin: RetryPlugin;
  let processRecoveryPlugin: ProcessRecoveryPlugin;
  let transactionPlugin: TransactionPlugin;

  const processDefinitions = {
    'test-process': {
      id: 'test-process',
      name: 'Test Process',
      description: 'Process for testing rate limiting',
      version: '1.0.0',
      initialState: 'initial',
      transitions: [
        { from: 'initial', to: 'processing', on: 'START' },
        { from: 'processing', to: 'completed', on: 'COMPLETE' }
      ],
      tasks: ['task-1', 'task-2']
    }
  };

  const taskDefinitions = {
    'task-1': {
      id: 'task-1',
      name: 'Task 1',
      description: 'First task with rate limiting',
      type: 'test',
      handler: async () => ({ result: 'Task 1 completed' }),
      rateLimit: {
        maxRequests: 2,
        timeWindow: 1000
      }
    },
    'task-2': {
      id: 'task-2',
      name: 'Task 2',
      description: 'Second task with rate limiting',
      type: 'test',
      handler: async () => ({ result: 'Task 2 completed' }),
      rateLimit: {
        maxRequests: 3,
        timeWindow: 1000
      }
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Create fresh instances for each test
    extensionSystem = new InMemoryExtensionSystem();
    eventBus = new InMemoryEventBus();
    
    // Create plugin instances
    processManagementPlugin = createProcessManagementPlugin(eventBus, extensionSystem, processDefinitions);
    taskManagementPlugin = createTaskManagementPlugin(eventBus, extensionSystem, taskDefinitions);
    taskDependenciesPlugin = createTaskDependenciesPlugin(eventBus, extensionSystem);
    retryPlugin = createRetryPlugin(eventBus, extensionSystem, {
      maxRetries: 3,
      retryableErrors: [Error],
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 100,
      maxDelay: 30000
    });
    processRecoveryPlugin = createProcessRecoveryPlugin(eventBus);
    transactionPlugin = createTransactionPluginInstance(eventBus);
    rateLimitingPlugin = new RateLimitingPlugin({
      defaultLimit: {
        tokensPerInterval: 5,
        interval: 1000,
        burstLimit: 2
      }
    }, eventBus);
    
    // Create runtime with all plugins
    runtime = createModernRuntime({
      extensions: {
        processManagement: true,
        taskManagement: true,
        pluginManagement: true
      },
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test'
      }
    });

    // Register plugins with the plugin registry
    runtime.pluginRegistry.registerPlugin(processManagementPlugin);
    runtime.pluginRegistry.registerPlugin(taskManagementPlugin);
    runtime.pluginRegistry.registerPlugin(taskDependenciesPlugin);
    runtime.pluginRegistry.registerPlugin(retryPlugin);
    runtime.pluginRegistry.registerPlugin(processRecoveryPlugin);
    runtime.pluginRegistry.registerPlugin(transactionPlugin);
    runtime.pluginRegistry.registerPlugin(rateLimitingPlugin);

    // Register process and task definitions
    for (const [id, def] of Object.entries(processDefinitions)) {
      runtime.processRegistry.registerProcessDefinition(id, def);
    }
    for (const [id, def] of Object.entries(taskDefinitions)) {
      runtime.taskRegistry.registerTaskDefinition(id, def);
    }

    // Initialize and start the runtime
    runtime.initialize({
      version: '1.0.0',
      namespace: 'test'
    }).then(() => runtime.start());
  });

  afterEach(() => {
    vi.useRealTimers();
    
    // Clean up references
    if (extensionSystem) {
      (extensionSystem as any).cleanup?.();
    }
    runtime = null as any;
    extensionSystem = null as any;
    eventBus = null as any;
    rateLimitingPlugin = null as any;
    processManagementPlugin = null as any;
    taskManagementPlugin = null as any;
    taskDependenciesPlugin = null as any;
    retryPlugin = null as any;
    processRecoveryPlugin = null as any;
    transactionPlugin = null as any;
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests up to the rate limit', async () => {
      // Execute tasks up to the defined limit (5 + 2 burst)
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      
      // All 7 should complete without being rate limited
      await expect(Promise.all(promises)).resolves.toHaveLength(7);
    });
    
    it('should reject requests that exceed the rate limit', async () => {
      // Execute tasks up to the limit
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      
      // Let all complete
      await Promise.all(promises);
      
      // The next one should be rate limited
      await expect(runtime.executeTask('test-task', {})).rejects.toThrow(/Rate limit exceeded/);
    });
    
    it('should replenish tokens over time', async () => {
      // Use up all tokens
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Advance time by 200ms (should replenish 1 token)
      vi.advanceTimersByTime(200);
      
      // Should be able to execute one more task
      await runtime.executeTask('test-task', {});
      
      // But not two
      await expect(runtime.executeTask('test-task', {})).rejects.toThrow(/Rate limit exceeded/);
      
      // Advance time to replenish more tokens
      vi.advanceTimersByTime(1000); // Full replenishment of 5 more tokens
      
      // Should be able to execute 5 more tasks
      const morePromises = [];
      for (let i = 0; i < 5; i++) {
        morePromises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(morePromises);
    });
  });
  
  describe('Task-Specific Rate Limits', () => {
    it('should apply different limits to different tasks', async () => {
      // Create a new runtime with both task definitions
      const taskDefinitions = {
        'test-task': {
          id: 'test-task',
          name: 'Test Task',
          description: 'Task with rate limiting',
          type: 'test',
          handler: async () => ({ result: 'Task completed' }),
          rateLimit: {
            maxRequests: 20,
            timeWindow: 1000
          }
        },
        'high-priority-task': {
          id: 'high-priority-task',
          name: 'High Priority Task',
          description: 'Task with higher rate limit',
          type: 'test',
          handler: async () => ({ result: 'High priority task completed' }),
          rateLimit: {
            maxRequests: 30,
            timeWindow: 1000
          }
        }
      };
      
      const runtime = new ReactiveRuntime(
        {}, // No process definitions needed
        taskDefinitions,
        {
          extensionSystem,
          eventBus,
          plugins: {
            processManagement: processManagementPlugin,
            taskManagement: taskManagementPlugin,
            taskDependencies: taskDependenciesPlugin,
            retry: retryPlugin,
            processRecovery: processRecoveryPlugin,
            transactionPlugin
          }
        }
      );
      
      // Set a higher limit for the high priority task
      rateLimitingPlugin.setTaskRateLimit('high-priority-task', {
        tokensPerInterval: 20,
        interval: 1000,
        burstLimit: 5
      });
      
      // Use up all tokens for the regular task
      const regularPromises = [];
      for (let i = 0; i < 20; i++) {
        regularPromises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(regularPromises);
      
      // Regular task should be limited
      await expect(runtime.executeTask('test-task', {})).rejects.toThrow(/Rate limit exceeded/);
      
      // But high priority task should still work
      const highPriorityPromises = [];
      for (let i = 0; i < 20; i++) {
        highPriorityPromises.push(runtime.executeTask('high-priority-task', {}));
      }
      await Promise.all(highPriorityPromises);
    });
    
    it('should allow disabling rate limiting for specific tasks', async () => {
      // Create a new runtime with both task definitions
      const taskDefinitions = {
        'test-task': {
          id: 'test-task',
          name: 'Test Task',
          description: 'Task with rate limiting',
          type: 'test',
          handler: async () => ({ result: 'Task completed' }),
          rateLimit: {
            maxRequests: 20,
            timeWindow: 1000
          }
        },
        'unlimited-task': {
          id: 'unlimited-task',
          name: 'Unlimited Task',
          description: 'Task without rate limiting',
          type: 'test',
          handler: async () => ({ result: 'Unlimited task completed' })
        }
      };
      
      const runtime = new ReactiveRuntime(
        {}, // No process definitions needed
        taskDefinitions,
        {
          extensionSystem,
          eventBus,
          plugins: {
            processManagement: processManagementPlugin,
            taskManagement: taskManagementPlugin,
            taskDependencies: taskDependenciesPlugin,
            retry: retryPlugin,
            processRecovery: processRecoveryPlugin,
            transactionPlugin
          }
        }
      );
      
      // Disable rate limiting for this task
      rateLimitingPlugin.setTaskRateLimit('unlimited-task', {
        disabled: true
      });
      
      // Execute a large number of unlimited tasks
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(runtime.executeTask('unlimited-task', {}));
      }
      
      // All should complete without being rate limited
      await expect(Promise.all(promises)).resolves.toHaveLength(100);
    });
  });
  
  describe('Rate Limit Management', () => {
    it('should provide rate limit statistics', async () => {
      // Execute several tasks
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Get statistics for the task
      const stats = rateLimitingPlugin.getRateLimitStats('test-task');
      
      // Check statistics
      expect(stats).toBeDefined();
      expect(stats.tokensRemaining).toBe(2); // 5 used out of 7 (5+2 burst)
      expect(stats.totalExecutions).toBe(5);
      expect(stats.rejections).toBe(0);
    });
    
    it('should count rejections in statistics', async () => {
      // Use all tokens
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Try to execute more and expect rejection
      try {
        await runtime.executeTask('test-task', {});
      } catch (error) {
        // Expected error
      }
      
      try {
        await runtime.executeTask('test-task', {});
      } catch (error) {
        // Expected error
      }
      
      // Check statistics
      const stats = rateLimitingPlugin.getRateLimitStats('test-task');
      expect(stats.rejections).toBe(2);
    });
    
    it('should allow resetting rate limiters', async () => {
      // Use all tokens
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Reset the rate limiter
      rateLimitingPlugin.resetRateLimiter('test-task');
      
      // Should be able to execute more tasks
      const morePromises = [];
      for (let i = 0; i < 7; i++) {
        morePromises.push(runtime.executeTask('test-task', {}));
      }
      
      // All should complete without being rate limited
      await expect(Promise.all(morePromises)).resolves.toHaveLength(7);
    });
  });
}); 