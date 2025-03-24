import { describe, it, expect, beforeEach } from 'vitest';
import { ObservabilityPlugin, ObservabilityOptions, LogLevel, MetricType, createObservabilityPlugin } from '../../src/plugins/observability';
import { Extension } from '../../src/models/extension-system';
import { Runtime } from '../../src/models/runtime';
import { mockRuntime } from '../helpers/mock-runtime';
import { asTestRuntime } from '../helpers/test-runtime';
import { InMemoryTaskRegistry } from '../../src/implementations/task-registry';
import { createTaskExecutor, InMemoryTaskExecutor } from '../../src/implementations/task-executor';
import { ExtensionPointName, ExtensionHookRegistration } from '../../src/models/extension-system';

interface TestTaskInput {
  param1?: string;
  param2?: number;
}

interface TestTaskOutput {
  success: boolean;
  result?: any;
}

class ObservabilityPluginExtension implements Extension {
  id = 'observability-plugin';
  name = 'Observability Plugin';
  description = 'Provides observability features for task execution';
  dependencies: string[] = [];
  
  constructor(private plugin: ObservabilityPlugin) {}
  
  getHooks(): ExtensionHookRegistration<ExtensionPointName>[] {
    return this.plugin.hooks['task:beforeExecution'] 
      ? [
        {
          pointName: 'task:beforeExecution' as ExtensionPointName,
          hook: async (context: any) => {
            return await this.plugin.hooks['task:beforeExecution'](context);
          },
          priority: 10
        },
        {
          pointName: 'task:afterExecution' as ExtensionPointName,
          hook: async (context: any) => {
            if (this.plugin.hooks['task:afterExecution']) {
              return await this.plugin.hooks['task:afterExecution'](context);
            }
            return context;
          },
          priority: 10
        },
      ]
      : [];
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['metrics', 'tracing', 'logging'];
  }
}

describe('Observability Plugin', () => {
  let runtime: Runtime;
  let testRuntime: any;
  let observabilityPlugin: ObservabilityPlugin;
  let observabilityPluginExtension: Extension;
  let taskExecutor: InMemoryTaskExecutor;
  
  // Define test tasks
  const fastTask = {
    type: 'fast-task',
    name: 'Fast Task',
    description: 'A task that executes quickly',
    handler: async () => ({ success: true })
  };
  
  const slowTask = {
    type: 'slow-task',
    name: 'Slow Task',
    description: 'A task that executes slowly',
    handler: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    }
  };
  
  const errorTask = {
    type: 'error-task',
    name: 'Error Task',
    description: 'A task that throws an error',
    handler: async () => {
      throw new Error('Task error');
    }
  };
  
  const memoryIntensiveTask = {
    type: 'memory-intensive-task',
    name: 'Memory Intensive Task',
    description: 'A task that uses a lot of memory',
    handler: async () => {
      // Simulate memory usage
      const bigArray = new Array(10000).fill('x');
      return { success: true, size: bigArray.length };
    }
  };
  
  beforeEach(async () => {
    // Create runtime using the helper
    runtime = mockRuntime();
    testRuntime = asTestRuntime(runtime);
    
    // Ensure we have a task registry
    if (!testRuntime.taskRegistry) {
      testRuntime.taskRegistry = new InMemoryTaskRegistry();
    }
    
    // Create a proper task executor
    taskExecutor = new InMemoryTaskExecutor(
      testRuntime.taskRegistry,
      testRuntime.eventBus
    );
    
    // Create observability plugin
    observabilityPlugin = createObservabilityPlugin({
      enableMetrics: true,
      enableTracing: true,
      enableLogging: true,
      logLevel: LogLevel.INFO,
      samplingRate: 1.0
    }) as unknown as ObservabilityPlugin;
    
    // Create the Extension wrapper for the plugin
    observabilityPluginExtension = new ObservabilityPluginExtension(observabilityPlugin);
    
    // Create a fake extension to register our hooks
    const extension = {
      id: 'debug-extension',
      name: 'Debug Extension',
      description: 'Extension for debugging',
      dependencies: [],
      getHooks: () => {
        return [
          {
            pointName: 'task:beforeExecution' as ExtensionPointName,
            hook: async (context: any) => {
              console.log(`Debug: Before executing task ${context.taskType}`);
              return context;
            },
            priority: 10
          },
          {
            pointName: 'task:afterExecution' as ExtensionPointName,
            hook: async (context: any) => {
              console.log(`Debug: After completing task ${context.taskType}`);
              return context;
            },
            priority: 10
          },
        ];
      },
      getVersion: () => '1.0.0',
      getCapabilities: () => ['debugging']
    } as Extension;
    
    // Register both extensions with the runtime's extension system
    testRuntime.extensionSystem.registerExtension(observabilityPluginExtension);
    testRuntime.extensionSystem.registerExtension(extension);
    
    // Register task definitions
    testRuntime.taskRegistry.registerTask(fastTask);
    testRuntime.taskRegistry.registerTask(slowTask);
    testRuntime.taskRegistry.registerTask(errorTask);
    testRuntime.taskRegistry.registerTask(memoryIntensiveTask);
  });
  
  // Example test case:
  it('should track task execution metrics', async () => {
    const taskId = 'test-task-1';
    const taskType = 'fast-task';
    
    // Manually trigger task execution events to simulate running the fast task
    const startContext = {
      taskId: taskId,
      taskType: taskType,
      task: {
        name: 'Fast Task',
        type: taskType
      },
      metadata: {
        source: 'test'
      }
    };
    
    // Simulate task execution start - this should trigger metric recording
    await testRuntime.extensionSystem.executeExtensionPoint('task:beforeExecution', startContext);
    
    // Execute the actual handler
    const result = await fastTask.handler();
    
    // Simulate task execution completion
    const completionContext = {
      ...startContext,
      result,
      duration: 10 // mock duration in ms
    };
    await testRuntime.extensionSystem.executeExtensionPoint('task:afterExecution', completionContext);
    
    // Check if metrics were recorded
    const metrics = observabilityPlugin.getMetrics();
    
    // Check for task execution count metrics
    expect(metrics['task.execution.count']).toBeDefined();
    expect(metrics['task.execution.count'].values.length).toEqual(1);
    
    // Check for task-specific execution count metrics
    const taskMetricKey = `task.execution.count.${taskId}`;
    expect(metrics[taskMetricKey]).toBeDefined();
    expect(metrics[taskMetricKey].values).toEqual([{ value: 1, timestamp: expect.any(Number) }]);
    
    // Check for duration metrics
    expect(metrics['task.execution.duration']).toBeDefined();
    expect(metrics['task.execution.duration'].values.length).toEqual(1);
    expect(metrics['task.execution.duration'].values[0].value).toEqual(10);
  });
}); 