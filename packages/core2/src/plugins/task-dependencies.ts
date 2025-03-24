import { Extension, ExtensionPointName, ExtensionHookRegistration } from '../models/extension-system';
import { TaskDefinition, TaskExecution, TaskContext } from '../models/index';
import { EventBus, EventHandler } from '../models/event-system';
import { ExtensionSystem } from '../models/extension-system';
import { DomainEvent } from '../models/core-types';
import { v4 as uuidv4 } from 'uuid';

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
  metadata?: any;
  state?: any;
}

interface CompletionContext {
  execution: TaskExecution;
  result?: any;
  error?: Error;
}

export class TaskDependenciesPlugin implements Extension {
  id = 'task-dependencies';
  name = 'task-dependencies';
  description = 'Handles task dependencies and sequencing';
  dependencies: string[] = [];
  
  private dependencies_map: Map<string, TaskDependency> = new Map();
  private runningTasks: Map<string, TaskExecution> = new Map();

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem
  ) {}

  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return [
      {
        pointName: 'task:beforeDependencyCheck' as ExtensionPointName,
        hook: async (context: unknown) => {
          const ctx = context as any;
          const taskId = ctx.taskId;
          const dependencies = ctx.metadata?.dependencies as string[] || [];
          
          // Create dependency record
          const dependency: TaskDependency = {
            taskId,
            dependsOn: dependencies,
            status: 'pending'
          };

          this.dependencies_map.set(taskId, dependency);

          // Wait for all dependencies to complete
          const dependencyResults = await this.waitForDependencies(dependencies);

          return {
            success: true,
            value: {
              ...ctx,
              metadata: {
                ...ctx.metadata,
                dependency,
                dependencyResults
              }
            }
          };
        }
      },
      {
        pointName: 'task:beforeExecution' as ExtensionPointName,
        hook: async (context: unknown) => {
          const ctx = context as any;
          const taskType = ctx.taskType;
          const input = ctx.data;
          const dependencyResults = ctx.metadata?.dependencyResults;
          
          const execution = {
            id: `task-${Date.now()}`,
            status: 'running',
            attempts: 1,
            dependency: {
              dependsOn: [],
              waitingFor: []
            }
          } as unknown as TaskExecution; // Safe type assertion via unknown

          this.runningTasks.set(execution.id, execution);

          const executionContext: ExecutionContext = {
            taskType,
            input,
            dependencyResults: dependencyResults || {},
            execution,
            metadata: ctx.metadata
          };

          return {
            success: true,
            value: {
              ...ctx,
              metadata: {
                ...ctx.metadata,
                execution
              }
            }
          };
        }
      },
      {
        pointName: 'task:afterCompletion' as ExtensionPointName,
        hook: async (context: unknown) => {
          const ctx = context as any;
          const taskId = ctx.taskId;
          const result = ctx.result;
          const error = ctx.error;
          const execution = ctx.metadata?.execution as TaskExecution;
          
          if (execution) {
            // Update dependency status
            const dependency = this.dependencies_map.get(taskId);
            if (dependency) {
              dependency.status = error ? 'failed' : 'completed';
              dependency.result = result;
              dependency.error = error;
            }
            
            // Update execution status
            execution.status = error ? 'failed' : 'completed';
            
            // Remove from running tasks
            this.runningTasks.delete(execution.id);
            
            // Publish task completion event
            this.eventBus.publish({
              id: uuidv4(),
              type: error ? 'task.failed' : 'task.completed',
              timestamp: Date.now(),
              payload: {
                taskId,
                executionId: execution.id,
                result: result,
                error: error
              }
            });
          }
          
          return {
            success: true,
            value: ctx
          };
        }
      }
    ];
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): string[] {
    return ['task-dependencies', 'sequencing', 'dependency-management'];
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
        const dep = this.dependencies_map.get(depId);
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
    this.eventBus.publish({
      id: uuidv4(),
      type: 'task:scheduled',
      timestamp: Date.now(),
      payload: {
        taskId,
        taskType,
        scheduledTime,
        input
      },
      metadata: {}
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

    // Publish cancellation event
    this.eventBus.publish({
      id: uuidv4(),
      type: 'task:cancelled',
      timestamp: Date.now(),
      payload: {
        taskId,
      },
      metadata: {}
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
      metadata: (dependencyContext as any).value?.metadata
    });

    if ((executionContext as any).value?.skipExecution) {
      return ((executionContext as any).value?.metadata?.execution) as TaskExecution;
    }

    try {
      const result = await this.executeTaskHandler(taskType, {
        input,
        ...((executionContext as any).value?.metadata || {})
      });

      // Execute afterCompletion extension point
      const completionContext = await this.extensionSystem.executeExtensionPoint('task:afterCompletion', {
        data: input,
        state: {},
        metadata: (executionContext as any).value?.metadata || {},
        result
      });

      return ((completionContext as any).value?.metadata?.execution || (completionContext as any).value?.execution) as TaskExecution;
    } catch (error: unknown) {
      // Execute afterCompletion extension point with error
      const errorContext = await this.extensionSystem.executeExtensionPoint('task:afterCompletion', {
        data: input,
        state: {},
        metadata: (executionContext as any).value?.metadata || {},
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
    return new Map(this.dependencies_map);
  }

  getRunningTasks(): Map<string, TaskExecution> {
    return new Map(this.runningTasks);
  }

  clear(): void {
    this.dependencies_map.clear();
    this.runningTasks.clear();
  }
}

export function createTaskDependenciesPlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem
): Extension {
  return new TaskDependenciesPlugin(eventBus, extensionSystem);
} 