import { Runtime } from './models/runtime.js';
import { EventBus, EventStorage } from './models/event.js';
import { ExtensionSystem } from './models/extension.js';
import { ProcessDefinition, TaskDefinition } from './models/index.js';
import { ReactiveRuntime } from './implementations/runtime.js';
import { EventBusImpl } from './implementations/event-bus.js';
import { ExtensionSystemImpl } from './implementations/extension-system.js';
import { TransactionPluginImpl } from './plugins/transaction-management.js';
import { TaskPrioritizationPlugin, SchedulingPolicy } from './plugins/task-prioritization.js';

/**
 * Creates a new runtime instance
 */
export function createReactiveRuntime(
  processDefinitions: Record<string, ProcessDefinition>,
  taskDefinitions: Record<string, TaskDefinition>,
  options: { 
    extensionSystem: ExtensionSystem; 
    eventBus: EventBus;
    eventStorage?: EventStorage;
  }
): Runtime {
  return new ReactiveRuntime(processDefinitions, taskDefinitions, options);
}

/**
 * Creates a new event bus instance
 */
export function createEventBusInstance(): EventBus {
  return new EventBusImpl();
}

/**
 * Creates a new extension system instance
 */
export function createExtensionSystemInstance(): ExtensionSystem {
  return new ExtensionSystemImpl();
}

/**
 * Creates a new transaction plugin
 */
export function createTransactionPluginInstance(eventBus: EventBus) {
  return new TransactionPluginImpl(eventBus);
}

/**
 * Creates a new task prioritization plugin
 */
export function createTaskPrioritizationPluginInstance(options: {
  defaultPriority: string;
  defaultPolicy: string;
  maxConcurrentTasks: number;
  enablePreemption?: boolean;
}) {
  const plugin = new TaskPrioritizationPlugin({
    defaultPriority: parseInt(options.defaultPriority),
    schedulingPolicy: options.defaultPolicy as SchedulingPolicy,
    maxConcurrentTasks: options.maxConcurrentTasks,
    preemptionEnabled: options.enablePreemption
  });

  return {
    name: plugin.name,
    description: plugin.description,
    hooks: plugin.hooks,
    initialize: () => plugin.initialize(),
    setTaskPriority: (taskId: string, priority: string) => plugin.setTaskPriority(taskId, parseInt(priority)),
    getTaskPriority: (taskId: string) => String(plugin.getTaskPriority(taskId)),
    setTaskExecutionTime: (taskId: string, time: number) => plugin.setTaskExecutionTime(taskId, time),
    setSchedulingPolicy: (policy: string) => plugin.setSchedulingPolicy(policy as SchedulingPolicy),
    setMaxConcurrentTasks: (max: number) => plugin.setMaxConcurrentTasks(max),
    enablePreemption: (enabled: boolean) => plugin.enablePreemption(enabled),
    setTaskDeadline: (taskId: string, deadline: number) => plugin.setTaskDeadline(taskId, deadline),
    enablePriorityAging: (options: { waitingTimeThreshold: number, boostAmount: number }) => plugin.enablePriorityAging(options),
    createTaskGroup: (groupId: string, options: { priority: string, maxConcurrent: number }) => plugin.createTaskGroup(groupId, { priority: parseInt(options.priority), maxConcurrent: options.maxConcurrent }),
    assignTaskToGroup: (taskId: string, groupId: string) => plugin.assignTaskToGroup(taskId, groupId),
    getRunningTasks: () => plugin.getRunningTasks(),
    defineResource: (resourceId: string, capacity: number) => plugin.defineResource(resourceId, capacity),
    setTaskResourceRequirements: (taskId: string, requirements: Record<string, number>) => plugin.setTaskResourceRequirements(taskId, requirements),
    getResourceAllocations: (resourceId: string) => plugin.getResourceAllocations(resourceId),
    getExecutionOrder: () => plugin.getExecutionOrder()
  };
}

/**
 * Creates a new retry plugin
 */
export function createRetryPluginInstance(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  options: {
    maxRetries?: number;
    retryableErrors?: ErrorConstructor[];
    backoffStrategy?: string;
    initialDelay?: number;
    maxDelay?: number;
  } = {}
) {
  // TODO: Implement retry plugin
  return {
    initialize: () => {},
    setRetryOptions: (taskId: string, options: any) => {},
    getRetryStats: (taskId: string) => ({
      attempts: 0,
      failures: 0,
      lastAttempt: 0
    })
  };
}

/**
 * Creates a new performance monitoring plugin
 */
export function createPerformanceMonitoringPluginInstance(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem
) {
  // TODO: Implement performance monitoring plugin
  return {
    initialize: () => {},
    trackExecution: (taskId: string, startTime: number) => {},
    trackCompletion: (taskId: string, endTime: number) => {},
    getMetrics: () => ({
      taskExecutions: 0,
      averageExecutionTime: 0,
      failures: 0
    })
  };
}

/**
 * Creates a new validation plugin
 */
export function createValidationPluginInstance(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem
) {
  // TODO: Implement validation plugin
  return {
    initialize: () => {},
    validateTask: (taskId: string, input: any) => true,
    validateProcess: (processId: string, event: string) => true
  };
}

/**
 * Creates a new workflow optimization plugin
 */
export function createWorkflowOptimizationPluginInstance(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem
) {
  // TODO: Implement workflow optimization plugin
  return {
    initialize: () => {},
    analyzeWorkflow: (workflowId: string) => ({
      bottlenecks: [],
      suggestions: []
    }),
    optimizeWorkflow: (workflowId: string) => {}
  };
} 