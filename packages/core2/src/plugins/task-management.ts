import { EventBus } from '../models/event.js';
import { ExtensionSystem } from '../models/extension.js';
import { Extension } from '../models/extension.js';
import { TaskDefinition, TaskExecution, TaskContext, CancellationToken } from '../models/index.js';
import { CancellationTokenImpl } from '../implementations/cancellation-token.js';

/**
 * TaskManagementPlugin provides capabilities for managing task definitions and executions
 */
export interface TaskManagementPlugin {
  /**
   * Register a task definition
   */
  registerTaskDefinition(definition: TaskDefinition): void;
  
  /**
   * Get a task definition by type
   */
  getTaskDefinition(taskType: string): TaskDefinition | undefined;
  
  /**
   * Get all registered task definitions
   */
  getTaskDefinitions(): TaskDefinition[];
  
  /**
   * Execute a task with the given input
   */
  executeTask(taskType: string, input: any, options?: { cancellable?: boolean }): Promise<TaskExecution>;
  
  /**
   * Schedule a task for future execution
   */
  scheduleTask(taskType: string, input: any, scheduledTime: number): Promise<string>;
  
  /**
   * Cancel a running or scheduled task
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Get task execution details
   */
  getTaskExecution(taskId: string): Promise<TaskExecution | undefined>;
  
  /**
   * Initialize the plugin
   */
  initialize(): void;
}

/**
 * Implementation of the TaskManagementPlugin
 */
export class TaskManagementPluginImpl implements TaskManagementPlugin {
  private taskDefinitions: Map<string, TaskDefinition> = new Map();
  private runningTasks: Map<string, { execution: TaskExecution; cancellationToken: CancellationTokenImpl }> = new Map();
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();
  private readonly extension: Extension;

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem
  ) {
    this.extension = {
      name: 'task-management',
      description: 'Provides task definition and execution management',
      hooks: {
        'beforeTaskExecution': async (context) => {
          // We could add validation or enrichment here
          return context;
        },
        'afterTaskCompletion': async (context) => {
          // Emit task completed event
          this.eventBus.publish('task.completed', {
            taskId: context.taskId,
            taskType: context.taskType,
            timestamp: Date.now(),
            result: context.result,
            duration: context.endTime - context.startTime
          });
          return context;
        }
      }
    };
  }

  registerTaskDefinition(definition: TaskDefinition): void {
    // Validate definition
    if (!definition.id || !definition.handler) {
      throw new Error('Invalid task definition');
    }
    
    this.taskDefinitions.set(definition.id, definition);
  }

  getTaskDefinition(taskType: string): TaskDefinition | undefined {
    return this.taskDefinitions.get(taskType);
  }

  getTaskDefinitions(): TaskDefinition[] {
    return Array.from(this.taskDefinitions.values());
  }

  async executeTask(taskType: string, input: any, options: { cancellable?: boolean } = {}): Promise<TaskExecution> {
    const definition = this.getTaskDefinition(taskType);
    if (!definition) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    // Create task execution with unique ID
    const taskExecution: TaskExecution = {
      id: `${taskType}-${Date.now()}`,
      type: taskType,
      status: 'running',
      input,
      startTime: Date.now(),
      metadata: input.metadata || {}
    };

    // Create cancellation token if task is cancellable
    const cancellationToken = new CancellationTokenImpl();
    
    // Store running task
    this.runningTasks.set(taskExecution.id, {
      execution: taskExecution,
      cancellationToken
    });

    try {
      // Execute beforeExecute extension point
      const executeContext = await this.extensionSystem.executeExtensionPoint('beforeTaskExecution', {
        taskId: taskExecution.id,
        taskType,
        input,
        cancellationToken,
        startTime: taskExecution.startTime,
        metadata: input.metadata || taskExecution.metadata
      });

      // Execute task handler
      taskExecution.result = await this.executeTaskHandler(
        definition, 
        taskExecution, 
        executeContext.input || input, 
        cancellationToken
      );
      
      // Update task status
      taskExecution.status = 'completed';
      taskExecution.endTime = Date.now();
      
      // Execute afterExecute extension point
      await this.extensionSystem.executeExtensionPoint('afterTaskCompletion', {
        taskId: taskExecution.id,
        taskType,
        input: executeContext.input || input,
        result: taskExecution.result,
        startTime: taskExecution.startTime,
        endTime: taskExecution.endTime,
        metadata: input.metadata
      });

      return taskExecution;
    } catch (error) {
      // Update task status to failed
      taskExecution.status = 'failed';
      taskExecution.error = error;
      taskExecution.endTime = Date.now();
      
      // Execute onError extension point
      await this.extensionSystem.executeExtensionPoint('afterTaskCompletion', {
        taskId: taskExecution.id,
        taskType,
        input,
        error,
        startTime: taskExecution.startTime,
        endTime: taskExecution.endTime,
        metadata: input.metadata
      });

      throw error;
    } finally {
      // Remove from running tasks if not completed
      if (taskExecution.status !== 'completed') {
        this.runningTasks.delete(taskExecution.id);
      }
    }
  }

  async scheduleTask(taskType: string, input: any, scheduledTime: number): Promise<string> {
    const definition = this.getTaskDefinition(taskType);
    if (!definition) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    const taskId = `scheduled-task-${Date.now()}`;
    const delay = Math.max(0, scheduledTime - Date.now());
    
    // Create timeout to execute task at scheduled time
    const timeout = setTimeout(async () => {
      try {
        // Remove from scheduled tasks
        this.scheduledTasks.delete(taskId);
        
        // Execute the task
        await this.executeTask(taskType, input);
        
        // Emit task executed event
        this.eventBus.publish('task.scheduled.executed', {
          taskId,
          taskType,
          timestamp: Date.now(),
          scheduledTime
        });
      } catch (error) {
        // Emit task failed event
        this.eventBus.publish('task.scheduled.failed', {
          taskId,
          taskType,
          timestamp: Date.now(),
          scheduledTime,
          error
        });
      }
    }, delay);
    
    // Store scheduled task
    this.scheduledTasks.set(taskId, timeout);
    
    // Emit task scheduled event
    this.eventBus.publish('task.scheduled', {
      taskId,
      taskType,
      timestamp: Date.now(),
      scheduledTime
    });
    
    return taskId;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    // Check if task is scheduled
    if (this.scheduledTasks.has(taskId)) {
      // Clear timeout
      clearTimeout(this.scheduledTasks.get(taskId));
      this.scheduledTasks.delete(taskId);
      
      // Emit task cancelled event
      this.eventBus.publish('task.cancelled', {
        taskId,
        timestamp: Date.now(),
        reason: 'scheduled_task_cancelled'
      });
      
      return true;
    }
    
    // Check if task is running
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      // Cancel task
      runningTask.cancellationToken.cancel();
      
      // Emit task cancellation requested event
      this.eventBus.publish('task.cancellation_requested', {
        taskId,
        timestamp: Date.now()
      });
      
      return true;
    }
    
    return false;
  }

  async getTaskExecution(taskId: string): Promise<TaskExecution | undefined> {
    const runningTask = this.runningTasks.get(taskId);
    return runningTask?.execution;
  }

  private async executeTaskHandler(
    definition: TaskDefinition,
    execution: TaskExecution,
    input: any,
    cancellationToken: CancellationToken
  ): Promise<any> {
    // Create task context
    const context: TaskContext = {
      input,
      cancellationToken
    };

    // Check for cancellation before executing
    if (cancellationToken.isCancelled) {
      throw new Error('Task was cancelled before execution');
    }

    // Execute task handler
    return definition.handler(context);
  }

  initialize(): void {
    this.extensionSystem.registerExtension(this.extension);
  }

  getExtension(): Extension {
    return this.extension;
  }
}

/**
 * Factory function to create a TaskManagementPlugin instance
 */
export function createTaskManagementPlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  initialDefinitions: Record<string, TaskDefinition> = {}
): TaskManagementPlugin {
  const plugin = new TaskManagementPluginImpl(eventBus, extensionSystem);
  
  // Register initial definitions
  Object.values(initialDefinitions).forEach(definition => {
    plugin.registerTaskDefinition(definition);
  });
  
  return plugin;
} 