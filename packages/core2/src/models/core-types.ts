/**
 * Core domain types for the reactive architecture system
 */

// Import Result and DomainError from our utility module
import { Result, DomainError } from '../utils';

// Re-export to maintain API compatibility
export { Result, DomainError };

/**
 * Unique identifier type
 */
export type Identifier = string;

/**
 * Timestamp type - milliseconds since epoch
 */
export type Timestamp = number;

/**
 * Metadata container for additional contextual information
 */
export type Metadata = Record<string, unknown>;

/**
 * Domain event interface
 */
export interface DomainEvent<T = unknown> {
  /** Event unique identifier */
  id: Identifier;
  
  /** Event type */
  type: string;
  
  /** Event timestamp */
  timestamp: number;
  
  /** Event payload */
  payload: T;
  
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  
  /** Optional correlation ID for tracing */
  correlationId?: string;
}

/**
 * Command interface with proper generics
 */
export interface Command<T> {
  /** Unique command identifier */
  id: Identifier;
  
  /** Type of the command for routing */
  type: string;
  
  /** Actual command payload */
  payload: T;
  
  /** Additional contextual information */
  metadata?: Metadata;
}

/**
 * Result of a command execution
 */
export interface CommandResult<T> {
  /** Status of the command execution */
  status: 'success' | 'failure';
  
  /** Result data */
  data?: T;
  
  /** Error information if status is failure */
  error?: Error;
  
  /** Additional contextual information */
  metadata?: Metadata;
}

/**
 * State transition type
 */
export type State<D extends object = Record<string, unknown>> = {
  /** Current state name */
  name: string;
  
  /** Associated data */
  data: D;
  
  /** When the state was created */
  timestamp: Timestamp;
}; 