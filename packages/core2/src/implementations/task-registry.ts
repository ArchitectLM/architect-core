import { 
  TaskDefinition, 
  TaskRegistry 
} from '../models/task-system';
import { Result } from '../models/core-types';

/**
 * In-memory implementation of TaskRegistry
 * Manages task definitions with proper error handling and type safety
 */
export class InMemoryTaskRegistry implements TaskRegistry {
  private tasks = new Map<string, TaskDefinition<unknown, unknown, unknown>>();

  /**
   * Register a task definition
   * @param definition The task definition to register
   */
  registerTask<TInput, TOutput, TState>(
    definition: TaskDefinition<TInput, TOutput, TState>
  ): Result<void> {
    try {
      if (this.tasks.has(definition.id)) {
        return {
          success: false,
          error: new Error(`Task ${definition.id} is already registered`)
        };
      }

      this.tasks.set(definition.id, definition as unknown as TaskDefinition<unknown, unknown, unknown>);
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Unregister a task definition
   * @param taskId The ID of the task definition to unregister
   */
  unregisterTask(taskId: string): Result<void> {
    try {
      if (!this.tasks.has(taskId)) {
        return {
          success: false,
          error: new Error(`Task ${taskId} not found`)
        };
      }

      this.tasks.delete(taskId);
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get a task definition by ID
   * @param taskId The ID of the task definition to retrieve
   */
  getTaskDefinition<TInput, TOutput, TState>(
    taskId: string
  ): Result<TaskDefinition<TInput, TOutput, TState>> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return {
          success: false,
          error: new Error(`Task ${taskId} not found`)
        };
      }

      return { success: true, value: task as unknown as TaskDefinition<TInput, TOutput, TState> };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Check if a task definition exists
   * @param taskId The ID of the task definition to check
   */
  hasTaskDefinition(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Get all registered task definitions
   */
  getAllTaskDefinitions(): TaskDefinition<unknown, unknown, unknown>[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task definitions that match a specific criteria
   * @param filterFn Function to filter task definitions
   */
  getTaskDefinitionsByFilter(
    filterFn: (task: TaskDefinition<unknown, unknown, unknown>) => boolean
  ): TaskDefinition<unknown, unknown, unknown>[] {
    return Array.from(this.tasks.values()).filter(filterFn);
  }

  /**
   * Get task definitions that require specific resources
   * @param resourceName The resource name to filter by
   */
  getTaskDefinitionsByResource(
    resourceName: string
  ): TaskDefinition<unknown, unknown, unknown>[] {
    return this.getTaskDefinitionsByFilter(task => 
      task.resources !== undefined && 
      task.resources.includes(resourceName)
    );
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