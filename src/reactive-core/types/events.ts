/**
 * Event Types
 * 
 * This module defines the event types used in the reactive system.
 * These types are generated from the DSL and are read-only for LLM agents.
 */

/**
 * Base event
 */
export interface BaseEvent {
  /**
   * Event type
   */
  type: string;
  
  /**
   * Event payload
   */
  payload: any;
}

/**
 * Todo event types
 */
export type TodoEventType = 
  | 'TODO_CREATED'
  | 'TODO_UPDATED'
  | 'TODO_DELETED'
  | 'TODO_COMPLETED'
  | 'TODO_MARKED_IMPORTANT'
  | 'TODO_STATE_CHANGED'
  | 'TODO_TRANSITION_COMPLETED'
  | 'TODO_ARCHIVED';

/**
 * Process event types
 */
export type ProcessEventType =
  | 'PROCESS_INSTANCE_CREATED'
  | 'PROCESS_STATE_CHANGED'
  | 'PROCESS_CONTEXT_UPDATED'
  | 'PROCESS_TRANSITION_COMPLETED';

/**
 * Flow event types
 */
export type FlowEventType =
  | 'FLOW_STARTED'
  | 'FLOW_COMPLETED'
  | 'FLOW_FAILED'
  | 'FLOW_STEP_STARTED'
  | 'FLOW_STEP_COMPLETED'
  | 'FLOW_STEP_FAILED';

/**
 * System event types
 */
export type SystemEventType = 
  | 'SYSTEM_INITIALIZED'
  | 'SYSTEM_SHUTDOWN'
  | 'ERROR';

/**
 * All event types
 */
export type EventType = TodoEventType | ProcessEventType | FlowEventType | SystemEventType;

/**
 * Todo event
 */
export interface TodoEvent extends BaseEvent {
  type: TodoEventType;
  payload: 
    | { id: string; title: string; [key: string]: any }  // TODO_CREATED
    | { id: string; changes: any }                       // TODO_UPDATED
    | { id: string }                                     // TODO_DELETED, TODO_COMPLETED
    | { todoId: string; timestamp?: string }             // TODO_ARCHIVED
    | { id: string; priority: string }                   // TODO_MARKED_IMPORTANT
    | { id: string; fromState: string; toState: string } // TODO_STATE_CHANGED
    | { id: string; transition: string }                 // TODO_TRANSITION_COMPLETED
}

/**
 * Process event
 */
export interface ProcessEvent extends BaseEvent {
  type: ProcessEventType;
  payload:
    | { processId: string; instanceId: string; state: string; context: any }                                  // PROCESS_INSTANCE_CREATED
    | { processId: string; instanceId: string; fromState: string; toState: string; event: string; context: any } // PROCESS_STATE_CHANGED
    | { processId: string; instanceId: string; context: any }                                                 // PROCESS_CONTEXT_UPDATED
    | { processId: string; instanceId: string; transition: string; success: boolean; error?: string }         // PROCESS_TRANSITION_COMPLETED
}

/**
 * Flow event
 */
export interface FlowEvent extends BaseEvent {
  type: FlowEventType;
  payload:
    | { flowId: string; input: any }                                                // FLOW_STARTED
    | { flowId: string; success: boolean; output: any }                             // FLOW_COMPLETED
    | { flowId: string; error: string }                                             // FLOW_FAILED
    | { flowId: string; stepId: string; stepType: string }                          // FLOW_STEP_STARTED
    | { flowId: string; stepId: string; success: boolean; output: any }             // FLOW_STEP_COMPLETED
    | { flowId: string; stepId: string; error: string }                             // FLOW_STEP_FAILED
}

/**
 * System event
 */
export interface SystemEvent extends BaseEvent {
  type: SystemEventType;
  payload: 
    | { version: string; timestamp: string }                                // SYSTEM_INITIALIZED
    | { reason: string; timestamp: string }                                 // SYSTEM_SHUTDOWN
    | { message: string; error: string; originalEvent?: BaseEvent }         // ERROR
}

/**
 * App event
 */
export type AppEvent = TodoEvent | ProcessEvent | FlowEvent | SystemEvent;

/**
 * Subscription
 */
export interface Subscription {
  /**
   * Unsubscribe from the event
   */
  unsubscribe: () => void;
}

/**
 * Event bus
 */
export interface EventBus {
  /**
   * Emit an event
   * @param event The event to emit
   */
  emit<T extends BaseEvent>(event: T): void;
  
  /**
   * Subscribe to an event
   * @param eventType The event type to subscribe to
   * @param handler The handler to call when the event is emitted
   * @returns A subscription that can be used to unsubscribe
   */
  subscribe<T extends BaseEvent>(eventType: EventType | '*', handler: (event: T) => void): Subscription;
  
  /**
   * Subscribe to all events
   * @param handler The handler to call when any event is emitted
   * @returns A subscription that can be used to unsubscribe
   */
  subscribeToAll<T extends BaseEvent>(handler: (event: T) => void): Subscription;
}