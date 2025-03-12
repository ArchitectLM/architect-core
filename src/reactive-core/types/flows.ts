/**
 * Flow Types
 * 
 * This module defines the flow types used in the reactive system.
 * These types are generated from the DSL and are read-only for LLM agents.
 */

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
  
  /**
   * Input schema
   */
  inputSchema?: Record<string, any>;
  
  /**
   * Output schema
   */
  outputSchema?: Record<string, any>;
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
  name: string;
  
  /**
   * Step type
   */
  type: 'task' | 'condition' | 'parallel' | 'wait';
  
  /**
   * Task ID (for task steps)
   */
  taskId?: string;
  
  /**
   * Wait time in milliseconds (for wait steps)
   */
  waitTime?: number;
  
  /**
   * Condition (for condition steps)
   */
  condition?: string;
  
  /**
   * True branch (for condition steps)
   */
  trueBranch?: string[];
  
  /**
   * False branch (for condition steps)
   */
  falseBranch?: string[];
  
  /**
   * Parallel branches (for parallel steps)
   */
  branches?: string[][];
  
  /**
   * Next step ID
   */
  next?: string;
  
  /**
   * Input mapping
   */
  inputMapping?: Record<string, string>;
  
  /**
   * Output mapping
   */
  outputMapping?: Record<string, string>;
}

/**
 * Flow execution options
 */
export interface FlowExecutionOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to continue on error
   */
  continueOnError?: boolean;
  
  /**
   * Whether to trace execution
   */
  trace?: boolean;
}

/**
 * Flow execution result
 */
export interface FlowExecutionResult<T = any> {
  /**
   * Whether the flow was successful
   */
  success: boolean;
  
  /**
   * Flow output
   */
  output?: T;
  
  /**
   * Error message if the flow failed
   */
  error?: string;
  
  /**
   * Execution trace
   */
  trace?: FlowExecutionTrace[];
}

/**
 * Flow execution trace
 */
export interface FlowExecutionTrace {
  /**
   * Step ID
   */
  stepId: string;
  
  /**
   * Step name
   */
  stepName: string;
  
  /**
   * Step type
   */
  stepType: string;
  
  /**
   * Start time
   */
  startTime: number;
  
  /**
   * End time
   */
  endTime: number;
  
  /**
   * Step input
   */
  input: any;
  
  /**
   * Step output
   */
  output: any;
  
  /**
   * Error message if the step failed
   */
  error?: string;
}

/**
 * Todo flows
 * These are generated from the DSL
 */
export const TodoFlows: Record<string, Flow> = {
  'create-todo-flow': {
    id: 'create-todo-flow',
    name: 'Create Todo Flow',
    description: 'Creates a new todo item',
    steps: [
      {
        id: 'validate',
        name: 'Validate Todo',
        type: 'task',
        taskId: 'validate-todo',
        next: 'check-validation'
      },
      {
        id: 'check-validation',
        name: 'Check Validation Result',
        type: 'condition',
        condition: 'input.valid === true',
        trueBranch: ['save'],
        falseBranch: ['handle-validation-error']
      },
      {
        id: 'save',
        name: 'Save Todo',
        type: 'task',
        taskId: 'save-todo'
      },
      {
        id: 'handle-validation-error',
        name: 'Handle Validation Error',
        type: 'task',
        taskId: 'handle-error',
        inputMapping: {
          errorType: '"validation"',
          errors: 'input.errors'
        }
      }
    ],
    inputSchema: {
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      dueDate: { type: 'string', format: 'date', required: false },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], required: false }
    },
    outputSchema: {
      success: { type: 'boolean' },
      todoId: { type: 'string' },
      errors: { type: 'array', items: { type: 'string' } }
    }
  },
  'mark-important-flow': {
    id: 'mark-important-flow',
    name: 'Mark Todo as Important Flow',
    description: 'Marks a todo item as important with a priority level',
    steps: [
      {
        id: 'mark-important',
        name: 'Mark Todo as Important',
        type: 'task',
        taskId: 'mark-important',
        next: 'check-result'
      },
      {
        id: 'check-result',
        name: 'Check Result',
        type: 'condition',
        condition: 'input.updated === true',
        trueBranch: ['success'],
        falseBranch: ['handle-error']
      },
      {
        id: 'success',
        name: 'Success',
        type: 'task',
        taskId: 'return-result',
        inputMapping: {
          success: 'true',
          message: '"Todo marked as important"',
          priority: 'input.priority'
        }
      },
      {
        id: 'handle-error',
        name: 'Handle Error',
        type: 'task',
        taskId: 'handle-error',
        inputMapping: {
          errorType: '"update"',
          message: '"Failed to mark todo as important"'
        }
      }
    ],
    inputSchema: {
      todoId: { type: 'string', required: true },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], required: true }
    },
    outputSchema: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      priority: { type: 'string' }
    }
  }
};
