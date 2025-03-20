/**
 * Mark Important Task
 * 
 * This module provides an implementation of the Mark Important task.
 */

import { EventBus } from '../../reactive-core/types/events';
import { TaskImplementation, TaskResult } from '../../reactive-core/types/tasks';
import { TodoRepository } from '../../reactive-core/types/models';

/**
 * Mark important task input
 */
interface MarkImportantInput {
  /**
   * Todo ID
   */
  todoId: string;
  
  /**
   * Priority
   */
  priority: 'low' | 'medium' | 'high';
}

/**
 * Mark important task output
 */
interface MarkImportantOutput {
  /**
   * Whether the todo was updated
   */
  updated: boolean;
  
  /**
   * Priority
   */
  priority: string;
}

/**
 * Mark important task implementation
 */
export class MarkImportantTaskImpl implements TaskImplementation<MarkImportantInput, MarkImportantOutput> {
  /**
   * Task ID
   */
  taskId = 'mark-important';
  
  /**
   * Todo repository
   */
  private todoRepository: TodoRepository;
  
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Constructor
   * @param todoRepository Todo repository
   * @param eventBus Event bus
   */
  constructor(todoRepository: TodoRepository, eventBus: EventBus) {
    this.todoRepository = todoRepository;
    this.eventBus = eventBus;
  }
  
  /**
   * Execute the task
   * @param input Task input
   * @returns Task output
   */
  async execute(input: MarkImportantInput): Promise<TaskResult<MarkImportantOutput> & { todo?: any }> {
    try {
      // Validate input
      if (!input.todoId) {
        return {
          success: false,
          error: 'todoId is required'
        };
      }
      
      if (!input.priority) {
        return {
          success: false,
          error: 'priority is required'
        };
      }
      
      // Get the todo
      const todo = await this.todoRepository.findById(input.todoId);
      if (!todo) {
        return {
          success: false,
          error: `Todo not found: ${input.todoId}`
        };
      }
      
      // Validate priority
      if (!['low', 'medium', 'high'].includes(input.priority as string)) {
        return {
          success: false,
          error: `Invalid priority: ${input.priority}`
        };
      }
      
      // Update the todo
      const updatedTodo = await this.todoRepository.update(input.todoId, {
        priority: input.priority
      });
      
      // If the repository doesn't return the updated todo, create it
      const resultTodo = updatedTodo || {
        ...todo,
        priority: input.priority
      };
      
      // Emit an event
      this.eventBus.emit({
        type: 'TODO_MARKED_IMPORTANT',
        payload: {
          id: input.todoId,
          priority: input.priority
        }
      });
      
      return {
        success: true,
        output: {
          updated: true,
          priority: input.priority
        },
        todo: resultTodo
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}