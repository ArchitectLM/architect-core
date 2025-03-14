/**
 * Process Types for ArchitectLM
 */
import { z } from 'zod';
import { Event } from './event-types';

/**
 * Process state definition
 */
export interface ProcessState<TContext = any> {
  name: string;                      // State name
  description?: string;              // State description
  type?: 'normal' | 'initial' | 'final' | 'parallel'; // State type
  parent?: string;                   // Parent state for hierarchical states
  onEnter?: (context: TContext) => Promise<void> | void; // Handler when entering state
  onExit?: (context: TContext) => Promise<void> | void;  // Handler when exiting state
  metadata?: Record<string, unknown>; // Additional metadata
  isFinal?: boolean;                 // Whether this is a final state
  transitions?: Record<string, any>; // State transitions
}

/**
 * Transition definition with improved typing
 */
export interface Transition<
  TState extends string = string,
  TEvent extends string = string,
  TContext = any
> {
  from: TState | TState[] | '*';     // Source state(s) - can use '*' for any state
  to: TState;                        // Target state
  on: TEvent;                        // Event type that triggers transition
  description?: string;              // Transition description
  guard?: (context: TContext, event: Event<TEvent>) => boolean | Promise<boolean>; // Optional condition
  action?: (context: TContext, event: Event<TEvent>) => Promise<void> | void; // Action to perform during transition
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Process definition with generic type parameters
 */
export interface ProcessDefinition<
  TState extends string = string,
  TEvent extends string = string,
  TContext = any
> {
  id: string;                        // Unique process identifier
  description?: string;              // Process description
  states: Array<ProcessState<TContext>> | Record<TState, ProcessState<TContext>>; // Valid states
  initialState?: TState;             // Initial state (defaults to first state)
  transitions: Array<Transition<TState, TEvent, TContext>>; // Valid state transitions
  contextSchema?: z.ZodType<TContext>; // Schema for process context validation
  metadata?: Record<string, unknown>; // Additional metadata
  
  // LLM-specific metadata to help with generation and understanding
  llmMetadata?: {
    domainConcepts?: string[];       // Domain concepts this process relates to
    businessRules?: string[];        // Business rules implemented by this process
    designPatterns?: string[];       // Design patterns used in this process
    relatedProcesses?: string[];     // Other processes this one interacts with
  };
}

/**
 * Process instance representing a running process
 */
export interface ProcessInstance<TState extends string = string, TContext = any> {
  id: string;                        // Unique instance identifier
  processId: string;                 // Reference to process definition
  state: TState;                     // Current state
  context: TContext;                 // Process context data
  history: Array<{                   // State transition history
    from: TState;                    // Previous state
    to: TState;                      // New state
    event: string;                   // Event that triggered transition
    timestamp: Date;                 // When transition occurred
  }>;
  createdAt: Date;                   // When instance was created
  updatedAt: Date;                   // When instance was last updated
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Process options for creating a new process instance
 */
export interface ProcessOptions {
  id?: string;                       // Optional custom instance ID
  metadata?: Record<string, unknown>; // Additional metadata
} 