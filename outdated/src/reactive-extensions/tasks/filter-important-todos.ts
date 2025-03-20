/**
 * Filter Important Todos Task
 * 
 * This module provides an implementation of the Filter Important Todos task.
 */

import { TaskImplementation, TaskResult } from '../../reactive-core/types/tasks';
import { Todo } from '../../reactive-core/types/models';

/**
 * Filter important todos task input
 */
interface FilterImportantTodosInput {
  /**
   * Todos to filter
   */
  todos: Todo[];
  
  /**
   * Minimum priority
   */
  minPriority?: 'low' | 'medium' | 'high';
}

/**
 * Filter important todos task output
 */
interface FilterImportantTodosOutput {
  /**
   * Filtered todos
   */
  filteredTodos: Todo[];
}

/**
 * Filter important todos task implementation
 */
export class FilterImportantTodosTaskImpl implements TaskImplementation<FilterImportantTodosInput, FilterImportantTodosOutput> {
  /**
   * Task ID
   */
  taskId = 'filter-important-todos';
  
  /**
   * Execute the task
   * @param input Task input
   * @returns Task output
   */
  async execute(input: FilterImportantTodosInput): Promise<TaskResult<FilterImportantTodosOutput>> {
    try {
      // Validate input
      if (!input.todos || !Array.isArray(input.todos)) {
        return {
          success: false,
          error: 'todos must be an array'
        };
      }
      
      // Default to low priority if not specified
      const minPriority = input.minPriority || 'low';
      
      // Validate priority
      if (!['low', 'medium', 'high'].includes(minPriority as string)) {
        return {
          success: false,
          error: `minPriority must be one of: low, medium, high`
        };
      }
      
      // Define priority levels
      const priorityLevels = {
        low: 1,
        medium: 2,
        high: 3
      };
      
      // Filter todos by priority
      const filteredTodos = input.todos.filter(todo => {
        // If the todo has no priority, it's not important
        if (!todo.priority) {
          return false;
        }
        
        // Check if the todo's priority is at least the minimum priority
        return priorityLevels[todo.priority as keyof typeof priorityLevels] >= priorityLevels[minPriority as keyof typeof priorityLevels];
      });
      
      return {
        success: true,
        output: {
          filteredTodos
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}