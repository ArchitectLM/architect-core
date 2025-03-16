/**
 * Process Types
 * 
 * This module defines the process types used in the reactive system.
 * These types are generated from the DSL and are read-only for LLM agents.
 */

import { EventBus } from './events';

/**
 * Process definition
 */
export interface Process {
  /**
   * Process ID
   */
  id: string;
  
  /**
   * Process name
   */
  name: string;
  
  /**
   * Process type
   */
  type: 'stateful' | 'stateless';
  
  /**
   * Process states (for stateful processes)
   */
  states?: string[];
  
  /**
   * Process transitions (for stateful processes)
   */
  transitions?: ProcessTransition[];
  
  /**
   * Process tasks
   */
  tasks?: string[];
}

/**
 * Process transition
 */
export interface ProcessTransition {
  /**
   * From state
   */
  from: string;
  
  /**
   * To state
   */
  to: string;
  
  /**
   * Trigger event
   */
  trigger: string;
  
  /**
   * Condition (optional)
   */
  condition?: string;
}

/**
 * Process handlers
 */
export interface ProcessHandlers {
  /**
   * Called when entering a state
   * @param state The state being entered
   * @param context The process context
   */
  onEnterState: (state: string, context: any) => void;
  
  /**
   * Called when exiting a state
   * @param state The state being exited
   * @param context The process context
   */
  onExitState?: (state: string, context: any) => void;
  
  /**
   * Called when evaluating if a transition should occur
   * @param from The from state
   * @param to The to state
   * @param event The event that triggered the transition
   * @param context The process context
   * @returns Whether the transition should occur
   */
  canTransition: (from: string, to: string, event: string, context: any) => boolean;
  
  /**
   * Called after a transition completes
   * @param from The from state
   * @param to The to state
   * @param event The event that triggered the transition
   * @param context The process context
   */
  afterTransition: (from: string, to: string, event: string, context: any) => void;
}

/**
 * Process engine interface
 */
export interface ProcessEngine {
  /**
   * Gets the current state of a process instance
   * @param instanceId The process instance ID
   * @returns The current state
   */
  getState(instanceId: string): string;
  
  /**
   * Transitions a process instance to a new state
   * @param instanceId The process instance ID
   * @param event The event that triggered the transition
   * @param context The process context
   * @returns The transition result
   */
  transition(instanceId: string, event: string, context: any): Promise<TransitionResult>;
  
  /**
   * Handles an event
   * @param event The event
   * @param payload The event payload
   * @returns The result of handling the event
   */
  handleEvent(event: string, payload: any): Promise<any>;
}

/**
 * Transition result
 */
export interface TransitionResult {
  /**
   * Whether the transition was successful
   */
  success: boolean;
  
  /**
   * The from state
   */
  fromState?: string;
  
  /**
   * The to state
   */
  toState?: string;
  
  /**
   * The process context
   */
  context?: any;
  
  /**
   * Error message if the transition failed
   */
  error?: string;
}

/**
 * Todo process definition
 * This is generated from the DSL
 */
export const TodoProcess: Process = {
  id: 'todo-process',
  name: 'Todo Process',
  type: 'stateful',
  states: ['active', 'completed', 'archived'],
  transitions: [
    { from: 'active', to: 'completed', trigger: 'complete' },
    { from: 'completed', to: 'active', trigger: 'reactivate' },
    { from: 'active', to: 'archived', trigger: 'archive' },
    { from: 'completed', to: 'archived', trigger: 'archive' },
    { from: 'archived', to: 'active', trigger: 'restore' }
  ],
  tasks: ['validate-todo', 'save-todo', 'update-todo', 'delete-todo', 'mark-important', 'filter-important-todos']
};