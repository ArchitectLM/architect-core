import { Extension, ExtensionPoint, ExtensionContext, ExtensionHook } from '../models/extension';
import { TaskDefinition, TaskExecution, TaskContext } from '../models/index';
import { EventBus } from '../models/event';
import { ExtensionSystem } from '../models/extension';

interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: Error;
}

interface DependencyCheckContext {
  taskId: string;
  dependencies: string[];
  dependency?: TaskDependency;
}

interface DependencyResultsContext {
  taskId: string;
  dependency: TaskDependency;
  dependencyResults?: Record<string, any>;
}

interface ExecutionContext {
  taskType: string;
  input: any;
  dependencyResults: Record<string, any>;
  execution?: TaskExecution;
  skipExecution?: boolean;
}

interface CompletionContext {
  execution: TaskExecution;
  result?: any;
  error?: Error;
}

export class TaskDependenciesPlugin {
  private extension: Extension;
  private dependencies: Map<string, TaskDependency> = new Map();
  private runningTasks: Map<string, TaskExecution> = new Map();

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem
  ) {
    this.extension = {
      name: 'task-dependencies',
      description: 'Handles task dependencies and sequencing',
      hooks: {
        'task:beforeDependencyCheck': async (context: ExtensionContext) => {
          const taskId = context.taskId!;
          const dependencies = context.metadata?.dependencies as string[] || [];
          
          // Create dependency record
          const dependency: TaskDependency = {
            taskId,
            dependsOn: dependencies,
            status: 'pending'
          };

          this.dependencies.set(taskId, dependency);

          // Wait for all dependencies to complete
          const dependencyResults = await this.waitForDependencies(dependencies);

          return {
            ...context,
            metadata: {
              ...context.metadata,
              dependency,
              dependencyResults
            }
          };
        },

        'task:beforeExecution': async (context: ExtensionContext) => {
          const taskType = context.taskType!;
          const input = context.data;
          const dependencyResults = context.metadata?.dependencyResults;
          
          const execution: TaskExecution = {
            id: `task-${Date.now()}`,
            type: taskType,
            input,
            status: 'running',
            startTime: Date.now(),
            attempts: 1,
            dependency: {
              dependsOn: [],
              waitingFor: []
            }
          };

          this.runningTasks.set(execution.id, execution);

          return {
            ...context,
            skipExecution: false,
            metadata: {
              ...context.metadata,
              execution
            }
          };
        },

        'task:afterCompletion': async (context: ExtensionContext) => {
          const execution = context.metadata?.execution as TaskExecution;
          const result = context.result;
          const error = context.error;
          
          if (error) {
            execution.status = 'failed';
            execution.error = error;
            execution.endTime = Date.now();

            // Publish failure event
            this.eventBus.publish('task:failed', {
              taskId: execution.id,
              taskType: execution.type,
              error
            });
          } else {
            execution.result = result;
            execution.status = 'completed';
            execution.endTime = Date.now();

            // Publish completion event
            this.eventBus.publish('task:completed', {
              taskId: execution.id,
              taskType: execution.type,
              result
            });
          }

          this.runningTasks.delete(execution.id);
          return context;
        }
      }
    };
  }

  getExtension(): Extension {
    return this.extension;
  }

  private async waitForDependencies(dependencies: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const errors: Error[] = [];

    // Wait for all dependencies to complete
    await Promise.all(
      dependencies.map(async (depId) => {
        try {
          const result = await this.waitForDependency(depId);
          results[depId] = result;
        } catch (error) {
          errors.push(error as Error);
        }
      })
    );

    // If any dependencies failed, throw the first error
    if (errors.length > 0) {
      throw errors[0];
    }

    return results;
  }

  private async waitForDependency(depId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkDependency = () => {
        const dep = this.dependencies.get(depId);
        if (!dep) {
          reject(new Error(`Dependency ${depId} not found`));
          return;
        }

        switch (dep.status) {
          case 'completed':
            resolve(dep.result);
            break;
          case 'failed':
            reject(dep.error);
            break;
          case 'running':
          case 'pending':
            // Wait and check again
            setTimeout(checkDependency, 10);
            break;
        }
      };

      checkDependency();
    });
  }

  async scheduleTask(
    taskType: string,
    input: any,
    scheduledTime: number
  ): Promise<string> {
    const taskId = `scheduled-task-${Date.now()}`;
    const delay = scheduledTime - Date.now();

    if (delay <= 0) {
      // Execute immediately if scheduled time is in the past
      this.executeTaskWithDependencies(taskType, input, []);
      return taskId;
    }

    // Schedule for future execution
    setTimeout(() => {
      this.executeTaskWithDependencies(taskType, input, []);
    }, delay);

    // Publish scheduling event
    this.eventBus.publish('task:scheduled', {
      taskId,
      taskType,
      scheduledTime,
      input
    });

    return taskId;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const execution = this.runningTasks.get(taskId);
    if (!execution) {
      return false;
    }

    // Update execution status
    execution.status = 'cancelled';
    execution.endTime = Date.now();

    // Publish cancellation event
    this.eventBus.publish('task:cancelled', {
      taskId,
      taskType: execution.type
    });

    return true;
  }

  async executeTaskWithDependencies(
    taskType: string,
    input: any,
    dependencies: string[]
  ): Promise<TaskExecution> {
    const taskId = `task-${Date.now()}`;

    // Execute beforeDependencyCheck extension point
    const dependencyContext = await this.extensionSystem.executeExtensionPoint('task:beforeDependencyCheck', {
      taskId,
      taskType,
      data: input,
      state: {},
      metadata: {
        dependencies
      }
    });

    // Execute beforeExecution extension point
    const executionContext = await this.extensionSystem.executeExtensionPoint('task:beforeExecution', {
      taskId,
      taskType,
      data: input,
      state: {},
      metadata: dependencyContext.metadata
    });

    if (executionContext.skipExecution) {
      return executionContext.metadata?.execution as TaskExecution;
    }

    try {
      // Execute the task
      const result = await this.executeTaskHandler(taskType, {
        input,
        ...executionContext.metadata
      });

      // Execute afterCompletion extension point
      const completionContext = await this.extensionSystem.executeExtensionPoint('task:afterCompletion', {
        taskId,
        taskType,
        data: input,
        state: {},
        metadata: executionContext.metadata,
        result
      });

      return completionContext.metadata?.execution as TaskExecution;
    } catch (error: unknown) {
      // Execute afterCompletion extension point with error
      const errorContext = await this.extensionSystem.executeExtensionPoint('task:afterCompletion', {
        taskId,
        taskType,
        data: input,
        state: {},
        metadata: executionContext.metadata,
        error: error instanceof Error ? error : new Error(String(error))
      });

      throw error;
    }
  }

  private async executeTaskHandler(
    taskType: string,
    context: TaskContext
  ): Promise<any> {
    // This would be implemented by the runtime system
    // For now, we'll just throw an error
    throw new Error(`Task handler for ${taskType} not implemented`);
  }

  // Utility methods for testing and debugging
  getDependencies(): Map<string, TaskDependency> {
    return new Map(this.dependencies);
  }

  getRunningTasks(): Map<string, TaskExecution> {
    return new Map(this.runningTasks);
  }

  clear(): void {
    this.dependencies.clear();
    this.runningTasks.clear();
  }
}

export function createTaskDependenciesPlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem
): TaskDependenciesPlugin {
  return new TaskDependenciesPlugin(eventBus, extensionSystem);
} 