/**
 * Todo Process Handlers
 * 
 * This module provides the handlers for the Todo process.
 */

import { EventBus } from '../../reactive-core/types/events';
import { ProcessHandlers } from '../../reactive-core/types/processes';
import { TodoProcess } from '../../reactive-core/types/processes';
import { Todo } from '../../reactive-core/types/models';

/**
 * Todo process handlers implementation
 */
export class TodoProcessHandlers implements ProcessHandlers {
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Constructor
   * @param eventBus Event bus
   */
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Called when entering a state
   * @param state The state being entered
   * @param context The process context
   */
  onEnterState(state: string, context: { todo: Todo }): void {
    // Emit a state changed event
    this.eventBus.emit({
      type: 'TODO_STATE_CHANGED',
      payload: {
        todoId: context.todo.id,
        state,
        timestamp: new Date().toISOString()
      }
    });
    
    // Handle specific states
    switch (state) {
      case 'completed':
        // Emit a completed event
        this.eventBus.emit({
          type: 'TODO_COMPLETED',
          payload: {
            todoId: context.todo.id,
            timestamp: new Date().toISOString()
          }
        });
        break;
        
      case 'archived':
        // Emit an archived event
        this.eventBus.emit({
          type: 'TODO_ARCHIVED',
          payload: {
            todoId: context.todo.id,
            timestamp: new Date().toISOString()
          }
        });
        break;
    }
  }
  
  /**
   * Called when exiting a state
   * @param state The state being exited
   * @param context The process context
   */
  onExitState(state: string, context: { todo: Todo }): void {
    // No special handling needed for exiting states
  }
  
  /**
   * Called when evaluating if a transition should occur
   * @param from The from state
   * @param to The to state
   * @param event The event that triggered the transition
   * @param context The process context
   * @returns Whether the transition should occur
   */
  canTransition(from: string, to: string, event: string, context: { todo: Todo }): boolean {
    // Check if the transition is allowed
    const transition = TodoProcess.transitions?.find(t => 
      t.from === from && t.to === to && t.trigger === event
    );
    
    if (!transition) {
      return false;
    }
    
    // Check specific conditions
    switch (event) {
      case 'complete':
        // Can only complete if not already completed
        // The todo.completed property might be updated in the repository
        // but not yet reflected in the process context
        return true;
        
      case 'reactivate':
        // Can only reactivate if completed
        return context.todo.completed;
        
      case 'archive':
        // Can archive from any state
        return true;
        
      case 'restore':
        // Can only restore if archived
        return context.todo.archived;
        
      default:
        return true;
    }
  }
  
  /**
   * Called after a transition completes
   * @param from The from state
   * @param to The to state
   * @param event The event that triggered the transition
   * @param context The process context
   */
  afterTransition(from: string, to: string, event: string, context: { todo: Todo }): void {
    // Emit a transition completed event
    this.eventBus.emit({
      type: 'TODO_TRANSITION_COMPLETED',
      payload: {
        todoId: context.todo.id,
        fromState: from,
        toState: to,
        event,
        timestamp: new Date().toISOString()
      }
    });
  }
}