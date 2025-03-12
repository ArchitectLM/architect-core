/**
 * Todo Event Handlers
 * 
 * This module provides the event handlers for Todo events.
 */

import { EventBus } from '../../reactive-core/types/events';
import { ProcessEngine } from '../../reactive-core/types/processes';
import { TodoRepository } from '../../reactive-core/types/models';

/**
 * Todo event handlers
 */
export class TodoEventHandlers {
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Process engine
   */
  private processEngine: ProcessEngine;
  
  /**
   * Todo repository
   */
  private todoRepository: TodoRepository;
  
  /**
   * Constructor
   * @param eventBus Event bus
   * @param processEngine Process engine
   * @param todoRepository Todo repository
   */
  constructor(
    eventBus: EventBus,
    processEngine: ProcessEngine,
    todoRepository: TodoRepository
  ) {
    this.eventBus = eventBus;
    this.processEngine = processEngine;
    this.todoRepository = todoRepository;
    
    // Register event handlers
    this.registerEventHandlers();
  }
  
  /**
   * Register event handlers
   */
  private registerEventHandlers(): void {
    // Handle TODO_CREATED events
    this.eventBus.subscribe('TODO_CREATED', this.handleTodoCreated.bind(this));
    
    // Handle TODO_COMPLETED events
    this.eventBus.subscribe('TODO_COMPLETED', this.handleTodoCompleted.bind(this));
    
    // Handle TODO_MARKED_IMPORTANT events
    this.eventBus.subscribe('TODO_MARKED_IMPORTANT', this.handleTodoMarkedImportant.bind(this));
    
    // Handle TODO_ARCHIVED events
    this.eventBus.subscribe('TODO_ARCHIVED', this.handleTodoArchived.bind(this));
  }
  
  /**
   * Handle TODO_CREATED events
   * @param event The event
   */
  private async handleTodoCreated(event: any): Promise<void> {
    try {
      const todo = event.payload;
      
      // Create a process instance for the todo
      (this.processEngine as any).createInstance(
        'todo-process',
        `todo-${todo.id}`,
        'active',
        { todo }
      );
      
      console.log(`[TodoEventHandlers] Created process instance for todo: ${todo.id}`);
    } catch (error) {
      console.error('[TodoEventHandlers] Error handling TODO_CREATED event:', error);
      
      // Emit an error event
      this.eventBus.emit({
        type: 'ERROR',
        payload: {
          message: 'Error handling TODO_CREATED event',
          error: error instanceof Error ? error.message : String(error),
          originalEvent: event
        }
      });
    }
  }
  
  /**
   * Handle TODO_COMPLETED events
   * @param event The event
   */
  private async handleTodoCompleted(event: any): Promise<void> {
    try {
      const { todoId } = event.payload;
      
      // Get the todo
      const todo = await this.todoRepository.findById(todoId);
      if (!todo) {
        throw new Error(`Todo not found: ${todoId}`);
      }
      
      // Update the todo if not already completed
      if (!todo.completed) {
        await this.todoRepository.update(todoId, {
          completed: true
        });
      }
      
      // Transition the process instance
      const result = await this.processEngine.transition(
        `todo-${todoId}`,
        'complete',
        { todo: { ...todo, completed: true } }
      );
      
      if (!result.success) {
        console.error(`[TodoEventHandlers] Failed to transition todo process: ${result.error}`);
      } else {
        console.log(`[TodoEventHandlers] Completed todo: ${todoId}`);
      }
    } catch (error) {
      console.error('[TodoEventHandlers] Error handling TODO_COMPLETED event:', error);
      
      // Emit an error event
      this.eventBus.emit({
        type: 'ERROR',
        payload: {
          message: 'Error handling TODO_COMPLETED event',
          error: error instanceof Error ? error.message : String(error),
          originalEvent: event
        }
      });
    }
  }
  
  /**
   * Handle TODO_MARKED_IMPORTANT events
   * @param event The event
   */
  private async handleTodoMarkedImportant(event: any): Promise<void> {
    try {
      const { id, priority } = event.payload;
      
      // Get the todo
      const todo = await this.todoRepository.findById(id);
      if (!todo) {
        throw new Error(`Todo not found: ${id}`);
      }
      
      // Update the todo
      await this.todoRepository.update(id, {
        priority
      });
      
      console.log(`[TodoEventHandlers] Marked todo as important: ${id} (${priority})`);
    } catch (error) {
      console.error('[TodoEventHandlers] Error handling TODO_MARKED_IMPORTANT event:', error);
      
      // Emit an error event
      this.eventBus.emit({
        type: 'ERROR',
        payload: {
          message: 'Error handling TODO_MARKED_IMPORTANT event',
          error: error instanceof Error ? error.message : String(error),
          originalEvent: event
        }
      });
    }
  }
  
  /**
   * Handle TODO_ARCHIVED events
   * @param event The event
   */
  private async handleTodoArchived(event: any): Promise<void> {
    try {
      const { todoId } = event.payload;
      
      // Get the todo
      const todo = await this.todoRepository.findById(todoId);
      if (!todo) {
        throw new Error(`Todo not found: ${todoId}`);
      }
      
      // Update the todo
      await this.todoRepository.update(todoId, {
        archived: true
      });
      
      // Transition the process instance
      await this.processEngine.transition(
        `todo-${todoId}`,
        'archive',
        { todo: { ...todo, archived: true } }
      );
      
      console.log(`[TodoEventHandlers] Archived todo: ${todoId}`);
    } catch (error) {
      console.error('[TodoEventHandlers] Error handling TODO_ARCHIVED event:', error);
      
      // Emit an error event
      this.eventBus.emit({
        type: 'ERROR',
        payload: {
          message: 'Error handling TODO_ARCHIVED event',
          error: error instanceof Error ? error.message : String(error),
          originalEvent: event
        }
      });
    }
  }
}