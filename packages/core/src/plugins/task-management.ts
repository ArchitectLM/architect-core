import { EventBus } from '../models/event-system';
import { BasePlugin, PluginOptions, PluginState, PluginLifecycle } from '../models/plugin-system';
import { Result, DomainEvent } from '../models/core-types';
import { DomainError } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { TaskDefinition, TaskExecution, TaskContext, CancellationToken } from '../models/task-system';
import { CancellationTokenImpl } from '../implementations/cancellation-token';

interface TaskManagementData {
  initialized: boolean;
  lastError?: Error;
  taskDefinitions: Map<string, TaskDefinition>;
  taskExecutions: Map<string, TaskExecution>;
  scheduledTasks: Map<string, { taskType: string; input: any; scheduledTime: number }>;
  [key: string]: unknown;
}

export interface TaskManagementPluginState extends PluginState {
  config: {
    enabled: boolean;
    maxConcurrentTasks: number;
    taskTimeout: number;
    [key: string]: unknown;
  };
  data: TaskManagementData;
  status: {
    enabled: boolean;
    lastError?: Error;
    lastActionTimestamp?: number;
    health: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export class TaskManagementPluginImpl extends BasePlugin<TaskManagementPluginState> {
  constructor(
    private eventBus: EventBus,
    options: PluginOptions
  ) {
    super(options);

    // Initialize plugin-specific state
    this.state = {
      id: options.id,
      config: {
        enabled: true,
        maxConcurrentTasks: 10,
        taskTimeout: 30000, // 30 seconds
        ...options.config
      },
      data: {
        initialized: false,
        taskDefinitions: new Map<string, TaskDefinition>(),
        taskExecutions: new Map<string, TaskExecution>(),
        scheduledTasks: new Map<string, { taskType: string; input: any; scheduledTime: number }>()
      },
      status: {
        enabled: false,
        health: 'unhealthy'
      }
    };

    // Register task management capabilities
    this.registerCapability({
      id: 'task-management.definition',
      name: 'Task Definition Management',
      description: 'Register and manage task definitions',
      implementation: {
        registerTaskDefinition: this.registerTaskDefinition.bind(this),
        getTaskDefinition: this.getTaskDefinition.bind(this),
        getTaskDefinitions: this.getTaskDefinitions.bind(this)
      }
    });

    this.registerCapability({
      id: 'task-management.execution',
      name: 'Task Execution Management',
      description: 'Execute and manage task executions',
      implementation: {
        executeTask: this.executeTask.bind(this),
        scheduleTask: this.scheduleTask.bind(this),
        cancelTask: this.cancelTask.bind(this),
        getTaskExecution: this.getTaskExecution.bind(this)
      }
    });
  }

  /**
   * Get the version of this plugin
   */
  getVersion(): string {
    return '1.0.0';
  }

  /** Plugin lifecycle methods */
  lifecycle: PluginLifecycle = {
    initialize: async (config: Record<string, unknown>): Promise<Result<void>> => {
      try {
        // Validate configuration
        const validationResult = this.validateConfig(config);
        if (!validationResult.success) {
          return validationResult;
        }

        // Subscribe to task events
        await this.eventBus.subscribe('task.*', this.handleTaskEvent.bind(this));

        // Update state
        this.setState({
          config: {
            ...this.state.config,
            ...config
          },
          data: {
            ...this.state.data,
            initialized: true
          },
          status: {
            ...this.state.status,
            health: 'healthy'
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },

    start: async (): Promise<Result<void>> => {
      try {
        if (!this.state.data.initialized) {
          return {
            success: false,
            error: new DomainError('Plugin must be initialized before starting')
          };
        }

        // Start processing scheduled tasks
        this.processScheduledTasks();

        this.setState({
          status: {
            ...this.state.status,
            enabled: true,
            lastActionTimestamp: Date.now()
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },

    stop: async (): Promise<Result<void>> => {
      try {
        // Cancel all running tasks
        for (const [taskId, execution] of this.state.data.taskExecutions.entries()) {
          if (execution.status === 'running') {
            await this.cancelTask(taskId);
          }
        }

        this.setState({
          status: {
            ...this.state.status,
            enabled: false,
            lastActionTimestamp: Date.now()
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },

    cleanup: async (): Promise<Result<void>> => {
      try {
        // Unsubscribe from events
        this.eventBus.unsubscribe('task.*', this.handleTaskEvent.bind(this));

        // Update state
        this.setState({
          status: {
            ...this.state.status,
            enabled: false,
            health: 'unhealthy'
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    }
  };

  /**
   * Check plugin health
   */
  healthCheck(): Result<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    return {
      success: true,
      value: {
        status: this.state.status.health,
        details: {
          enabled: this.state.status.enabled,
          initialized: this.state.data.initialized,
          lastError: this.state.status.lastError?.message,
          lastActionTimestamp: this.state.status.lastActionTimestamp,
          taskDefinitions: this.state.data.taskDefinitions.size,
          taskExecutions: this.state.data.taskExecutions.size,
          scheduledTasks: this.state.data.scheduledTasks.size
        }
      }
    };
  }

  protected validateConfig(config: Record<string, unknown>): Result<void> {
    if (typeof config.maxConcurrentTasks !== 'number' || config.maxConcurrentTasks < 1) {
      return {
        success: false,
        error: new DomainError('maxConcurrentTasks must be a positive number')
      };
    }
    if (typeof config.taskTimeout !== 'number' || config.taskTimeout < 0) {
      return {
        success: false,
        error: new DomainError('taskTimeout must be a non-negative number')
      };
    }
    return { success: true, value: undefined };
  }

  protected handleError(error: Error): void {
    this.setState({
      status: {
        ...this.state.status,
        health: 'degraded',
        lastError: error,
        lastActionTimestamp: Date.now()
      },
      data: {
        ...this.state.data,
        lastError: error
      }
    });
  }

  public registerTaskDefinition(definition: TaskDefinition): void {
    this.state.data.taskDefinitions.set(definition.type, definition);
  }

  public getTaskDefinition(taskType: string): TaskDefinition | undefined {
    return this.state.data.taskDefinitions.get(taskType);
  }

  public getTaskDefinitions(): TaskDefinition[] {
    return Array.from(this.state.data.taskDefinitions.values());
  }

  public async executeTask(taskType: string, input: any, options?: { cancellable?: boolean }): Promise<TaskExecution> {
    try {
      const definition = this.getTaskDefinition(taskType);
      if (!definition) {
        throw new DomainError(`No task definition found for type ${taskType}`);
      }

      const taskId = uuidv4();
      const execution: TaskExecution = {
        id: taskId,
        taskType,
        input,
        status: 'running',
        createdAt: Date.now(),
        startedAt: Date.now(),
        completedAt: undefined,
        attemptNumber: 1,
        result: undefined,
        error: undefined,
        metadata: {}
      };

      this.state.data.taskExecutions.set(taskId, execution);

      try {
        const result = await definition.handler({
          input,
          attemptNumber: 1,
          cancellationToken: options?.cancellable ? new CancellationTokenImpl() : undefined,
          state: {},
          metadata: {}
        });
        execution.status = 'completed';
        execution.completedAt = Date.now();
        execution.result = result;
      } catch (error) {
        execution.status = 'failed';
        execution.completedAt = Date.now();
        execution.error = error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : {
          message: String(error),
          name: 'Error'
        };
      }

      // Publish task completion event
      const event: DomainEvent<{ taskId: string; status: string; result?: any; error?: Error }> = {
        id: uuidv4(),
        type: 'task.completed',
        timestamp: Date.now(),
        payload: {
          taskId,
          status: execution.status,
          result: execution.result,
          error: execution.error
        }
      };
      await this.eventBus.publish(event);

      return execution;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async scheduleTask(taskType: string, input: any, scheduledTime: number): Promise<string> {
    try {
      const definition = this.getTaskDefinition(taskType);
      if (!definition) {
        throw new DomainError(`No task definition found for type ${taskType}`);
      }

      const taskId = uuidv4();
      this.state.data.scheduledTasks.set(taskId, { taskType, input, scheduledTime });

      // Publish task scheduled event
      const event: DomainEvent<{ taskId: string; taskType: string; scheduledTime: number }> = {
        id: uuidv4(),
        type: 'task.scheduled',
        timestamp: Date.now(),
        payload: {
          taskId,
          taskType,
          scheduledTime
        }
      };
      await this.eventBus.publish(event);

      return taskId;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    try {
      const execution = this.state.data.taskExecutions.get(taskId);
      if (!execution) {
        return false;
      }

      if (execution.status === 'running') {
        execution.status = 'cancelled';
        execution.completedAt = Date.now();

        // Publish task cancelled event
        const event: DomainEvent<{ taskId: string }> = {
          id: uuidv4(),
          type: 'task.cancelled',
          timestamp: Date.now(),
          payload: { taskId }
        };
        await this.eventBus.publish(event);

        return true;
      }

      return false;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async getTaskExecution(taskId: string): Promise<TaskExecution | undefined> {
    return this.state.data.taskExecutions.get(taskId);
  }

  private async processScheduledTasks(): Promise<void> {
    const now = Date.now();
    for (const [taskId, task] of this.state.data.scheduledTasks.entries()) {
      if (task.scheduledTime <= now) {
        await this.executeTask(task.taskType, task.input);
        this.state.data.scheduledTasks.delete(taskId);
      }
    }
  }

  private async handleTaskEvent(event: DomainEvent<any>): Promise<void> {
    try {
      switch (event.type) {
        case 'task.completed':
          // Handle task completion
          break;
        case 'task.failed':
          // Handle task failure
          break;
        case 'task.cancelled':
          // Handle task cancellation
          break;
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export function createTaskManagementPlugin(
  eventBus: EventBus,
  options: PluginOptions
): TaskManagementPluginImpl {
  return new TaskManagementPluginImpl(eventBus, options);
} 