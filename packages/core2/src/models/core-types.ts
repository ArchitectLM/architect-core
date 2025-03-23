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
 * Result type for operations
 */
export interface Result<T = void> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The result value, if successful */
  value?: T;
  
  /** The error, if unsuccessful */
  error?: DomainError;
}

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
 * Domain error class
 */
export class DomainError extends Error {
  /** Error code */
  public code?: string;
  
  /** Additional context */
  public context?: Record<string, unknown>;
  
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;
  }
} 