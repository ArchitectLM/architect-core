/**
 * Task Types
 * 
 * This module defines the task types used in the reactive system.
 * These types are generated from the DSL and are read-only for LLM agents.
 */

/**
 * Task definition
 */
export interface Task {
  /**
   * Task ID
   */
  id: string;
  
  /**
   * Task name
   */
  name: string;
  
  /**
   * Task type
   */
  type: 'operation' | 'decision' | 'transformation';
  
  /**
   * Task description
   */
  description?: string;
  
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
 * Task implementation
 */
export interface TaskImplementation<TInput = any, TOutput = any> {
  /**
   * Task ID
   */
  taskId: string;
  
  /**
   * Execute the task
   * @param input Task input
   * @returns Task output
   */
  execute(input: TInput): Promise<TaskResult<TOutput>>;
}

/**
 * Task result
 */
export interface TaskResult<T = any> {
  /**
   * Whether the task was successful
   */
  success: boolean;
  
  /**
   * Task output
   */
  output?: T;
  
  /**
   * Error message if the task failed
   */
  error?: string;
}

/**
 * Todo task definitions
 * These are generated from the DSL
 */
export const TodoTasks: Record<string, Task> = {
  'validate-todo': {
    id: 'validate-todo',
    name: 'Validate Todo',
    type: 'operation',
    description: 'Validates a todo item',
    inputSchema: {
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      dueDate: { type: 'string', format: 'date', required: false }
    },
    outputSchema: {
      valid: { type: 'boolean' },
      errors: { type: 'array', items: { type: 'string' } }
    }
  },
  'save-todo': {
    id: 'save-todo',
    name: 'Save Todo',
    type: 'operation',
    description: 'Saves a todo item',
    inputSchema: {
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      dueDate: { type: 'string', format: 'date', required: false },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], required: false }
    },
    outputSchema: {
      id: { type: 'string' },
      created: { type: 'boolean' }
    }
  },
  'update-todo': {
    id: 'update-todo',
    name: 'Update Todo',
    type: 'operation',
    description: 'Updates a todo item',
    inputSchema: {
      id: { type: 'string', required: true },
      title: { type: 'string', required: false },
      description: { type: 'string', required: false },
      dueDate: { type: 'string', format: 'date', required: false },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], required: false },
      completed: { type: 'boolean', required: false }
    },
    outputSchema: {
      updated: { type: 'boolean' }
    }
  },
  'delete-todo': {
    id: 'delete-todo',
    name: 'Delete Todo',
    type: 'operation',
    description: 'Deletes a todo item',
    inputSchema: {
      id: { type: 'string', required: true }
    },
    outputSchema: {
      deleted: { type: 'boolean' }
    }
  },
  'mark-important': {
    id: 'mark-important',
    name: 'Mark Todo as Important',
    type: 'operation',
    description: 'Marks a todo item as important with a priority level',
    inputSchema: {
      todoId: { type: 'string', required: true },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], required: true }
    },
    outputSchema: {
      updated: { type: 'boolean' },
      priority: { type: 'string' }
    }
  },
  'filter-important-todos': {
    id: 'filter-important-todos',
    name: 'Filter Important Todos',
    type: 'transformation',
    description: 'Filters todos by minimum priority level',
    inputSchema: {
      todos: { type: 'array', items: { type: 'object' }, required: true },
      minPriority: { type: 'string', enum: ['low', 'medium', 'high'], required: false }
    },
    outputSchema: {
      filteredTodos: { type: 'array', items: { type: 'object' } }
    }
  }
};