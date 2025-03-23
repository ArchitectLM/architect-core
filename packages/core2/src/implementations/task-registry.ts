import { 
  TaskDefinition, 
  TaskRegistry 
} from '../models/task-system';
import { Result, DomainError } from '../models/core-types';

/**
 * Extended task definition with additional properties
 */
interface ExtendedTaskDefinition<TInput, TOutput> extends TaskDefinition<TInput, TOutput> {
  resources?: string[];
}

/**
 * In-memory implementation of TaskRegistry
 * Manages task definitions with proper error handling and type safety
 */
export class InMemoryTaskRegistry implements TaskRegistry {
  private tasks = new Map<string, TaskDefinition<unknown, unknown>>();

  /**
   * Register a task definition
   * @param definition The task definition to register
   */
  registerTask<TInput = unknown, TOutput = unknown>(
    definition: TaskDefinition<TInput, TOutput>
  ): void {
    if (!definition.type) {
      throw new DomainError(`Task definition must have a type`);
    }

    if (this.tasks.has(definition.type)) {
      throw new DomainError(`Task ${definition.type} is already registered`);
    }

    this.tasks.set(definition.type, definition as TaskDefinition<unknown, unknown>);
  }

  /**
   * Unregister a task definition
   * @param taskType The ID of the task definition to unregister
   */
  unregisterTask(taskType: string): void {
    if (!this.tasks.has(taskType)) {
      throw new DomainError(`Task ${taskType} not found`);
    }

    this.tasks.delete(taskType);
  }

  /**
   * Get a task definition by type
   * @param taskType The task type
   */
  getTask<TInput = unknown, TOutput = unknown>(
    taskType: string
  ): TaskDefinition<TInput, TOutput> | undefined {
    const task = this.tasks.get(taskType);
    return task as TaskDefinition<TInput, TOutput> | undefined;
  }

  /**
   * Get a task definition by type with a Result wrapper
   * @param taskType The task type to retrieve
   */
  async getTaskDefinition<TInput = unknown, TOutput = unknown>(
    taskType: string
  ): Promise<Result<TaskDefinition<TInput, TOutput>>> {
    try {
      const task = this.tasks.get(taskType);
      if (!task) {
        return {
          success: false,
          error: new DomainError(`Task ${taskType} not found`)
        };
      }

      return { success: true, value: task as TaskDefinition<TInput, TOutput> };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Check if a task definition exists
   * @param taskType The ID of the task definition to check
   */
  hasTask(taskType: string): boolean {
    return this.tasks.has(taskType);
  }

  /**
   * Get all registered task types
   */
  getTaskTypes(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get task definitions that match a specific criteria
   * @param filterFn Function to filter task definitions
   */
  getTaskDefinitionsByFilter(
    filterFn: (task: TaskDefinition<unknown, unknown>) => boolean
  ): TaskDefinition<unknown, unknown>[] {
    return Array.from(this.tasks.values()).filter(filterFn);
  }

  /**
   * Get task definitions that require specific resources
   * @param resourceName The resource name to filter by
   */
  getTaskDefinitionsByResource(
    resourceName: string
  ): TaskDefinition<unknown, unknown>[] {
    return this.getTaskDefinitionsByFilter(task => {
      const extendedTask = task as ExtendedTaskDefinition<unknown, unknown>;
      return extendedTask.resources !== undefined && 
        Array.isArray(extendedTask.resources) &&
        extendedTask.resources.includes(resourceName);
    });
  }

  /**
   * Clear all task definitions (primarily for testing)
   */
  clear(): void {
    this.tasks.clear();
  }

  /**
   * Get the count of registered task definitions
   */
  get count(): number {
    return this.tasks.size;
  }
}

/**
 * Factory function to create a new TaskRegistry
 */
export function createTaskRegistry(): TaskRegistry {
  return new InMemoryTaskRegistry();
} 