/**
 * Runtime Core Types
 * 
 * This module defines the types used by the runtime core.
 */

import type { ReactiveSystem, Task, Process } from '../../schema/types';

/**
 * Task implementation function
 */
export type TaskImplementation = (input: any) => Promise<any>;

/**
 * Event handler function
 */
export type EventHandler = (payload: any) => void;

/**
 * Task execution options
 */
export interface TaskExecutionOptions {
  /**
   * Maximum number of retries
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Retry backoff factor
   */
  retryBackoffFactor?: number;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /**
   * Task ID
   */
  taskId: string;

  /**
   * Task output
   */
  output: any;

  /**
   * Whether the task succeeded
   */
  success: boolean;

  /**
   * Error message if the task failed
   */
  error?: string;

  /**
   * Number of retries
   */
  retries?: number;

  /**
   * Execution time in milliseconds
   */
  executionTime?: number;
}

/**
 * Flow definition
 */
export interface Flow {
  /**
   * Flow ID
   */
  id: string;

  /**
   * Flow name
   */
  name: string;

  /**
   * Flow description
   */
  description?: string;

  /**
   * Flow steps
   */
  steps: FlowStep[];
}

/**
 * Flow step types
 */
export enum FlowStepType {
  TASK = 'task',
  PARALLEL = 'parallel',
  CONDITION = 'condition',
  WAIT = 'wait'
}

/**
 * Flow step
 */
export interface FlowStep {
  /**
   * Step ID
   */
  id: string;

  /**
   * Step name
   */
  name?: string;

  /**
   * Step description
   */
  description?: string;

  /**
   * Step type
   */
  type: FlowStepType;

  /**
   * Task ID (for task steps)
   */
  taskId?: string;

  /**
   * Input mapping function
   */
  inputMapping?: (flowInput: any, previousOutputs: Record<string, any>) => any;

  /**
   * Output mapping function
   */
  outputMapping?: (taskOutput: any) => any;

  /**
   * Condition function (for condition steps)
   */
  condition?: (flowInput: any, previousOutputs: Record<string, any>) => boolean;

  /**
   * Steps to execute if condition is true (for condition steps)
   */
  thenSteps?: FlowStep[];

  /**
   * Steps to execute if condition is false (for condition steps)
   */
  elseSteps?: FlowStep[];

  /**
   * Steps to execute in parallel (for parallel steps)
   */
  parallelSteps?: FlowStep[];

  /**
   * Wait time in milliseconds (for wait steps)
   */
  waitTime?: number;

  /**
   * Task execution options
   */
  executionOptions?: TaskExecutionOptions;
}

/**
 * Flow execution options
 */
export interface FlowExecutionOptions {
  /**
   * Whether to continue execution if a step fails
   */
  continueOnError?: boolean;

  /**
   * Maximum number of parallel executions
   */
  maxParallelExecutions?: number;

  /**
   * Task execution options
   */
  taskExecutionOptions?: TaskExecutionOptions;
}

/**
 * Flow execution result
 */
export interface FlowExecutionResult {
  /**
   * Flow ID
   */
  flowId: string;

  /**
   * Whether the flow succeeded
   */
  success: boolean;

  /**
   * Step results
   */
  stepResults: Record<string, TaskExecutionResult>;

  /**
   * Flow output
   */
  output: any;

  /**
   * Error message if the flow failed
   */
  error?: string;

  /**
   * Execution time in milliseconds
   */
  executionTime?: number;
}

/**
 * Code generation options
 */
export interface CodeGenerationOptions {
  /**
   * Programming language
   */
  language: string;

  /**
   * Framework
   */
  framework?: string;

  /**
   * Whether to include comments
   */
  includeComments?: boolean;

  /**
   * Whether to include tests
   */
  includeTests?: boolean;

  /**
   * Whether to include error handling
   */
  includeErrorHandling?: boolean;
}

/**
 * Code generation result
 */
export interface CodeGenerationResult {
  /**
   * Generated code
   */
  code: string;

  /**
   * Generated tests
   */
  tests?: string;

  /**
   * Whether the generation succeeded
   */
  success: boolean;

  /**
   * Error message if the generation failed
   */
  error?: string;
}

/**
 * Runtime options
 */
export interface RuntimeOptions {
  /**
   * Task execution options
   */
  taskExecutionOptions?: TaskExecutionOptions;

  /**
   * Flow execution options
   */
  flowExecutionOptions?: FlowExecutionOptions;

  /**
   * Code generation options
   */
  codeGenerationOptions?: CodeGenerationOptions;
}

/**
 * Runtime events
 */
export enum RuntimeEvent {
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  TASK_RETRYING = 'task:retrying',
  FLOW_STARTED = 'flow:started',
  FLOW_COMPLETED = 'flow:completed',
  FLOW_FAILED = 'flow:failed',
  FLOW_STEP_STARTED = 'flow:step:started',
  FLOW_STEP_COMPLETED = 'flow:step:completed',
  FLOW_STEP_FAILED = 'flow:step:failed',
  PROCESS_STATE_CHANGED = 'process:state:changed',
  CODE_GENERATION_STARTED = 'code:generation:started',
  CODE_GENERATION_COMPLETED = 'code:generation:completed',
  CODE_GENERATION_FAILED = 'code:generation:failed'
} 