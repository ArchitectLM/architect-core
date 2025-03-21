import { Runtime } from '../models/runtime.js';
import { ProcessDefinition, TaskDefinition, ProcessInstance, TaskExecution, ProcessMetrics, TaskMetrics, EventMetrics, HealthCheckResult } from '../models/index.js';
import { EventBus, EventStorage } from '../models/event.js';
import { ExtensionSystem } from '../models/extension.js';
import { createTaskDependenciesPlugin, TaskDependenciesPlugin } from '../plugins/task-dependencies.js';
import { createRetryPlugin, RetryPlugin, RetryPluginOptions, TaskRetryOptions, RetryStats, BackoffStrategy } from '../plugins/retry.js';
import { createProcessRecoveryPlugin, ProcessRecoveryPlugin } from '../plugins/process-recovery.js';
import { createEventPersistencePlugin, EventPersistencePlugin } from '../plugins/event-persistence.js';
import { createProcessManagementPlugin, ProcessManagementPlugin } from '../plugins/process-management.js';
import { createTaskManagementPlugin, TaskManagementPlugin } from '../plugins/task-management.js';
import { createTransactionPluginInstance } from '../factories.js';
import { TransactionPlugin } from '../plugins/transaction-management.js';

/**
 * Reactive implementation of the Runtime interface that delegates to plugins for all functionality
 */
export class ReactiveRuntime implements Runtime {
  // Core services
  private extensionSystem: ExtensionSystem;
  private eventBus: EventBus;
  
  // Plugins
  private processManagement: ProcessManagementPlugin;
  private taskManagement: TaskManagementPlugin;
  private taskDependencies: TaskDependenciesPlugin;
  private retry: RetryPlugin;
  private processRecovery: ProcessRecoveryPlugin;
  private eventPersistence?: EventPersistencePlugin;
  private transactionPlugin?: TransactionPlugin;
  
  // Process and task definitions
  private processDefinitions: Record<string, ProcessDefinition>;
  private taskDefinitions: Record<string, TaskDefinition>;
  
  // Process and task instances
  private processes: Map<string, ProcessInstance> = new Map();
  private taskExecutions: Map<string, TaskExecution> = new Map();
  
  // Metrics
  private taskMetrics: Map<string, TaskMetrics> = new Map();
  private processMetrics: Map<string, ProcessMetrics> = new Map();

  /**
   * Create a new ReactiveRuntime instance
   */
  constructor(
    processDefinitions: Record<string, ProcessDefinition>,
    taskDefinitions: Record<string, TaskDefinition>,
    options: { 
      extensionSystem: ExtensionSystem; 
      eventBus: EventBus;
      eventStorage?: EventStorage;
    }
  ) {
    this.extensionSystem = options.extensionSystem;
    this.eventBus = options.eventBus;
    this.processDefinitions = processDefinitions;
    this.taskDefinitions = taskDefinitions;
    
    // Register extension points for task execution
    this.extensionSystem.registerExtensionPoint({
      name: 'beforeTaskExecution',
      description: 'Called before a task is executed',
      handlers: []
    });
    
    this.extensionSystem.registerExtensionPoint({
      name: 'afterTaskCompletion',
      description: 'Called after a task is completed',
      handlers: []
    });
    
    // Initialize plugins
    this.processManagement = createProcessManagementPlugin(
      this.eventBus, 
      this.extensionSystem,
      this.processDefinitions
    );
    
    this.taskManagement = createTaskManagementPlugin(
      this.eventBus,
      this.extensionSystem,
      this.taskDefinitions
    );
    
    this.taskDependencies = createTaskDependenciesPlugin(
      this.eventBus, 
      this.extensionSystem
    );
    
    // Initialize retry plugin with default options
    const retryOptions: RetryPluginOptions = {
      maxRetries: 3,
      retryableErrors: [Error],
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 100,
      maxDelay: 30000
    };
    this.retry = createRetryPlugin(
      this.eventBus, 
      this.extensionSystem, 
      retryOptions
    );
    
    this.processRecovery = createProcessRecoveryPlugin(
      this.eventBus,
      this.extensionSystem
    );
    
    // Initialize optional plugins if dependencies are provided
    if (options.eventStorage) {
      this.eventPersistence = createEventPersistencePlugin(
        this.eventBus, 
        this.extensionSystem, 
        { storage: options.eventStorage }
      );
    }
    
    this.transactionPlugin = createTransactionPluginInstance(this.eventBus);
    
    // Register process versions
    Object.values(this.processDefinitions).forEach(definition => {
      this.processRecovery.registerProcessVersion(definition);
    });
    
    // Initialize all plugins
    this.processManagement.initialize();
    this.taskManagement.initialize();
    if (this.taskDependencies) this.taskDependencies.initialize();
    if (this.retry) this.retry.initialize();
    if (this.processRecovery) this.processRecovery.initialize();
    if (this.eventPersistence) this.eventPersistence.initialize();
    if (this.transactionPlugin) this.transactionPlugin.initialize();
    
    // Set up event listeners for metrics
    this.setupMetricsListeners();
  }

  //====================
  // PROCESS MANAGEMENT
  //====================
  
  async createProcess(processType: string, data: any, options: { version?: string } = {}): Promise<ProcessInstance> {
    try {
      const process = await this.processManagement.createProcess(processType, data, options);
      this.processes.set(process.id, process);
      this.updateProcessMetrics(processType);
      return process;
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'createProcess',
        processType,
        error
      });
      throw error;
    }
  }

  async getProcess(processId: string): Promise<ProcessInstance | undefined> {
    return this.processes.get(processId);
  }

  async transitionProcess(processId: string, event: string): Promise<ProcessInstance> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }
    
    try {
      const updatedProcess = await this.processManagement.transitionProcess(process, event);
      this.processes.set(updatedProcess.id, updatedProcess);
      this.updateProcessMetrics(updatedProcess.type);
      return updatedProcess;
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'transitionProcess',
        processId,
        event,
        error
      });
      throw error;
    }
  }

  async saveProcessCheckpoint(processId: string, checkpointId: string): Promise<ProcessInstance> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }
    
    try {
      const savedProcess = await this.processRecovery.saveCheckpoint(process, checkpointId);
      return savedProcess;
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'saveProcessCheckpoint',
        processId,
        checkpointId,
        error
      });
      throw error;
    }
  }

  async restoreProcessFromCheckpoint(processId: string, checkpointId: string): Promise<ProcessInstance> {
    try {
      const restoredProcess = await this.processRecovery.restoreFromCheckpoint(processId, checkpointId);
      if (restoredProcess) {
        this.processes.set(restoredProcess.id, restoredProcess);
        return restoredProcess;
      }
      throw new Error(`Could not restore process ${processId} from checkpoint ${checkpointId}`);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'restoreProcessFromCheckpoint',
        processId,
        checkpointId,
        error
      });
      throw error;
    }
  }

  //==================
  // TASK MANAGEMENT
  //==================
  
  async executeTask(taskType: string, input: any): Promise<TaskExecution> {
    try {
      const execution = await this.taskManagement.executeTask(taskType, input);
      this.taskExecutions.set(execution.id, execution);
      this.updateTaskMetrics(taskType);
      return execution;
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'executeTask',
        taskType,
        error
      });
      throw error;
    }
  }

  async executeTaskWithDependencies(taskType: string, input: any, dependencies: string[]): Promise<TaskExecution> {
    try {
      const result = await this.taskDependencies.executeWithDependencies(taskType, input, dependencies);
      this.updateTaskMetrics(taskType);
      return result;
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'executeTaskWithDependencies',
        taskType,
        dependencies,
        error
      });
      throw error;
    }
  }

  async scheduleTask(taskType: string, input: any, scheduledTime: number): Promise<string> {
    try {
      return await this.taskManagement.scheduleTask(taskType, input, scheduledTime);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'scheduleTask',
        taskType,
        scheduledTime,
        error
      });
      throw error;
    }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    try {
      return await this.taskManagement.cancelTask(taskId);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'cancelTask',
        taskId,
        error
      });
      throw error;
    }
  }

  //==================
  // EVENT MANAGEMENT
  //==================
  
  subscribe(eventType: string, handler: (event: any) => void): () => void {
    return this.eventBus.subscribe(eventType, handler);
  }

  unsubscribe(eventType: string, handler: (event: any) => void): void {
    this.eventBus.unsubscribe(eventType, handler);
  }

  publish(eventType: string, payload: any): void {
    this.eventBus.publish(eventType, payload);
  }

  async persistEvent(event: any): Promise<void> {
    if (!this.eventPersistence) {
      throw new Error('Event persistence is not enabled');
    }
    
    try {
      await this.eventPersistence.persistEvent(event);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'persistEvent',
        error
      });
      throw error;
    }
  }

  async replayEvents(fromTimestamp: number, toTimestamp: number, eventTypes?: string[]): Promise<void> {
    if (!this.eventPersistence) {
      throw new Error('Event persistence is not enabled');
    }
    
    try {
      await this.eventPersistence.replayEvents(fromTimestamp, toTimestamp, eventTypes);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'replayEvents',
        fromTimestamp,
        toTimestamp,
        eventTypes,
        error
      });
      throw error;
    }
  }

  async correlateEvents(correlationId: string): Promise<any[]> {
    if (!this.eventPersistence) {
      throw new Error('Event persistence is not enabled');
    }
    
    try {
      return await this.eventPersistence.correlateEvents(correlationId);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'correlateEvents',
        correlationId,
        error
      });
      throw error;
    }
  }

  //==================
  // TRANSACTION MANAGEMENT
  //==================
  
  beginTransaction(): string {
    if (!this.transactionPlugin) {
      throw new Error('Transaction management is not enabled');
    }
    
    try {
      const transaction = this.transactionPlugin.beginTransaction();
      return transaction.id;
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'beginTransaction',
        error
      });
      throw error;
    }
  }
  
  commitTransaction(transactionId: string): void {
    if (!this.transactionPlugin) {
      throw new Error('Transaction management is not enabled');
    }
    
    try {
      this.transactionPlugin.commitTransaction(transactionId);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'commitTransaction',
        transactionId,
        error
      });
      throw error;
    }
  }
  
  rollbackTransaction(transactionId: string): void {
    if (!this.transactionPlugin) {
      throw new Error('Transaction management is not enabled');
    }
    
    try {
      this.transactionPlugin.rollbackTransaction(transactionId);
    } catch (error) {
      this.eventBus.publish('runtime.error', {
        operation: 'rollbackTransaction',
        transactionId,
        error
      });
      throw error;
    }
  }

  //==================
  // RETRY MANAGEMENT
  //==================
  
  setTaskRetryOptions(taskId: string, options: TaskRetryOptions): void {
    this.retry.setTaskRetryOptions(taskId, options);
  }

  getRetryStats(taskId: string): RetryStats {
    return this.retry.getRetryStats(taskId);
  }

  //==================
  // METRICS & HEALTH
  //==================

  async getTaskMetrics(taskId?: string): Promise<TaskMetrics[]> {
    if (taskId) {
      const metrics = this.taskMetrics.get(taskId);
      return metrics ? [metrics] : [];
    }
    return Array.from(this.taskMetrics.values());
  }

  async getProcessMetrics(processType?: string): Promise<ProcessMetrics[]> {
    if (processType) {
      const metrics = this.processMetrics.get(processType);
      return metrics ? [metrics] : [];
    }
    return Array.from(this.processMetrics.values());
  }

  async getEventMetrics(eventType?: string): Promise<EventMetrics[]> {
    return this.eventBus.getEventMetrics(eventType);
  }

  async getHealthStatus(): Promise<HealthCheckResult> {
    // Get counts of processes and tasks
    const processes = this.processes.size;
    const tasks = this.taskExecutions.size;
    
    // Get plugin health status
    const pluginStatus: Record<string, boolean> = {
      'process-management': true,
      'task-management': true,
      'task-dependencies': this.taskDependencies !== undefined,
      'retry': this.retry !== undefined,
      'process-recovery': this.processRecovery !== undefined,
      'event-persistence': this.eventPersistence !== undefined,
      'transaction-management': this.transactionPlugin !== undefined
    };
    
    // Check event bus health
    const eventBusConnected = true; // In a real implementation, this would check the event bus connection
    
    return {
      status: 'healthy',
      timestamp: Date.now(),
      components: {
        eventBus: {
          status: eventBusConnected ? 'connected' : 'disconnected'
        },
        plugins: pluginStatus,
        runtime: {
          processes,
          tasks
        }
      }
    };
  }

  //==================
  // PRIVATE METHODS
  //==================
  
  private updateProcessMetrics(processType: string): void {
    // Count processes by type
    const count = Array.from(this.processes.values())
      .filter(p => p.type === processType)
      .length;
    
    // Group processes by state
    const stateDistribution: Record<string, number> = {};
    for (const process of this.processes.values()) {
      if (process.type !== processType) continue;
      stateDistribution[process.state] = (stateDistribution[process.state] || 0) + 1;
    }
    
    // Update metrics
    this.processMetrics.set(processType, {
      processType,
      count,
      stateDistribution,
      lastUpdated: Date.now()
    });
  }

  private updateTaskMetrics(taskType: string): void {
    // Get executions of this task type
    const executions = Array.from(this.taskExecutions.values())
      .filter(t => t.type === taskType);
    
    // Count by status
    const statusDistribution: Record<string, number> = {};
    for (const execution of executions) {
      statusDistribution[execution.status] = (statusDistribution[execution.status] || 0) + 1;
    }
    
    // Calculate average execution time
    const completedExecutions = executions.filter(e => e.status === 'completed' && e.startTime && e.endTime);
    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.endTime! - e.startTime!), 0) / completedExecutions.length
      : 0;
    
    // Update metrics
    this.taskMetrics.set(taskType, {
      taskType,
      count: executions.length,
      statusDistribution,
      averageExecutionTime,
      lastUpdated: Date.now()
    });
  }

  private setupMetricsListeners(): void {
    // Process events
    this.eventBus.subscribe('process.created', () => {
      // Update process metrics on creation
      const event = arguments[0];
      if (event && event.processType) {
        this.updateProcessMetrics(event.processType);
      }
    });
    
    this.eventBus.subscribe('process.transitioned', () => {
      // Update process metrics on transition
      const event = arguments[0];
      if (event && event.processType) {
        this.updateProcessMetrics(event.processType);
      }
    });
    
    // Task events
    this.eventBus.subscribe('task.completed', () => {
      // Update task metrics on completion
      const event = arguments[0];
      if (event && event.taskType) {
        this.updateTaskMetrics(event.taskType);
      }
    });
    
    this.eventBus.subscribe('task.failed', () => {
      // Update task metrics on failure
      const event = arguments[0];
      if (event && event.taskType) {
        this.updateTaskMetrics(event.taskType);
      }
    });
  }
}

/**
 * Factory function to create a ReactiveRuntime instance
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