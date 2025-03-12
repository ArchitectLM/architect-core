/**
 * Categorize Todo Flow
 * 
 * This module provides a flow for categorizing todos.
 */

import { Flow } from '../../reactive-core/types/flows';

/**
 * Categorize todo flow
 */
export const CategorizeTodoFlow: Flow = {
  id: 'categorize-todo-flow',
  name: 'Categorize Todo Flow',
  description: 'A flow for categorizing todos with tags',
  steps: [
    {
      id: 'categorize-todo',
      name: 'Categorize Todo',
      type: 'task',
      taskId: 'categorize-todo',
      inputMapping: {
        todoId: '$.todoId',
        categories: '$.categories'
      },
      outputMapping: {
        result: '$'
      },
      next: 'check-result'
    },
    {
      id: 'check-result',
      name: 'Check Result',
      type: 'condition',
      condition: '$.result.updated === true',
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
        categories: '$.result.categories'
      }
    },
    {
      id: 'handle-error',
      name: 'Handle Error',
      type: 'task',
      taskId: 'handle-error',
      inputMapping: {
        error: '$.result.error || "Failed to categorize todo"',
        errorType: '"categorization"'
      },
      next: 'error'
    },
    {
      id: 'error',
      name: 'Error',
      type: 'task',
      taskId: 'return-result',
      inputMapping: {
        success: 'false',
        error: '$.message'
      }
    }
  ],
  inputSchema: {
    type: 'object',
    properties: {
      todoId: {
        type: 'string',
        description: 'The ID of the todo to categorize'
      },
      categories: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'The categories to add to the todo'
      }
    },
    required: ['todoId', 'categories']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the operation was successful'
      },
      categories: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'The categories that were added to the todo'
      },
      error: {
        type: 'string',
        description: 'Error message if the operation failed'
      }
    },
    required: ['success']
  }
}; 