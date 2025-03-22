/**
 * Core domain types for the reactive architecture system
 */

/**
 * Unique identifier type
 */
export type Identifier = string;

/**
 * Timestamp representation in milliseconds
 */
export type Timestamp = number;

/**
 * Metadata container for additional contextual information
 */
export type Metadata = Record<string, unknown>;

/**
 * Domain event interface with proper generics
 */
export interface DomainEvent<T> {
  /** Unique event identifier */
  id: Identifier;
  
  /** Type of the event for classification */
  type: string;
  
  /** When the event occurred */
  timestamp: Timestamp;
  
  /** Actual event payload */
  payload: T;
  
  /** Additional contextual information */
  metadata?: Metadata;
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
 * Result of a domain operation
 */
export type Result<T> = 
  | { success: true; value: T; metadata?: Metadata }
  | { success: false; error: Error; metadata?: Metadata };

/**
 * State pattern type for domain entities
 */
export type State<T extends string, D> = {
  /** Current state name */
  state: T;
  
  /** Associated data */
  data: D;
  
  /** When the state was created */
  timestamp: Timestamp;
};

/**
 * Rich domain error with context
 */
export class DomainError extends Error {
  /** Additional contextual information about the error */
  context: Record<string, unknown>;
  
  /** Underlying cause if this is a wrapper */
  cause?: Error;
  
  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.cause = cause;
  }
} 