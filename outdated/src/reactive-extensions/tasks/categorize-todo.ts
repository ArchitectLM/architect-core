/**
 * Categorize Todo Task
 * 
 * This module provides an implementation of the Categorize Todo task.
 * It allows adding categories/tags to todos for better organization.
 */

import { EventBus } from '../../reactive-core/types/events';
import { TaskImplementation, TaskResult } from '../../reactive-core/types/tasks';
import { TodoRepository } from '../../reactive-core/types/models';

/**
 * Categorize todo task input
 */
interface CategorizeTodoInput {
  /**
   * Todo ID
   */
  todoId: string;
  
  /**
   * Categories/tags to add
   */
  categories: string[];
}

/**
 * Categorize todo task output
 */
interface CategorizeTodoOutput {
  /**
   * Whether the todo was updated
   */
  updated: boolean;
  
  /**
   * Categories/tags that were added
   */
  categories: string[];
}

/**
 * Categorize todo task implementation
 */
export class CategorizeTodoTaskImpl implements TaskImplementation<CategorizeTodoInput, CategorizeTodoOutput> {
  /**
   * Task ID
   */
  taskId = 'categorize-todo';
  
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
  async execute(input: CategorizeTodoInput): Promise<TaskResult<CategorizeTodoOutput>> {
    try {
      // Validate input
      if (!input.todoId) {
        return {
          success: false,
          error: 'todoId is required'
        };
      }
      
      if (!input.categories || !Array.isArray(input.categories) || input.categories.length === 0) {
        return {
          success: false,
          error: 'categories must be a non-empty array'
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
      
      // Prepare categories - merge with existing ones if any
      const existingCategories = todo.categories || [];
      const uniqueCategories = [...new Set([...existingCategories, ...input.categories])];
      
      // Update the todo
      await this.todoRepository.update(input.todoId, {
        categories: uniqueCategories
      });
      
      // Emit an event
      this.eventBus.emit({
        type: 'TODO_CATEGORIZED',
        payload: {
          todoId: input.todoId,
          categories: uniqueCategories,
          addedCategories: input.categories,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        success: true,
        output: {
          updated: true,
          categories: uniqueCategories
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