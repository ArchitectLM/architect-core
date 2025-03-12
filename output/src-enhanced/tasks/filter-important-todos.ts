
/**
 * Filter Important Todos
 * 
 * This task filters a list of todos based on their priority level.
 */

/**
 * Executes the Filter Important Todos task
 * @param input Input data for the task
 * @returns Result of executing the task
 */
export async function executeFilterImportantTodos(input: any): Promise<{
  success: boolean;
  output?: any;
  error?: string;
}> {
  try {
    // Validate input
    if (!input.todos || !Array.isArray(input.todos)) {
      throw new Error('todos must be an array');
    }
    
    // Define priority levels and their numeric values
    const priorityLevels = {
      'low': 1,
      'medium': 2,
      'high': 3
    };
    
    // Default to 'low' if not specified
    const minPriority = input.minPriority?.toLowerCase() || 'low';
    
    // Validate minPriority
    if (!priorityLevels[minPriority]) {
      throw new Error('minPriority must be one of: low, medium, high');
    }
    
    const minPriorityValue = priorityLevels[minPriority];
    
    // Filter todos based on priority
    const filteredTodos = input.todos.filter(todo => {
      // If todo has no priority, treat as lowest priority
      if (!todo.priority) return false;
      
      const todoPriority = todo.priority.toLowerCase();
      const todoPriorityValue = priorityLevels[todoPriority] || 0;
      
      return todoPriorityValue >= minPriorityValue;
    });
    
    return {
      success: true,
      output: {
        filteredTodos
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error filtering important todos: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export default {
  execute: executeFilterImportantTodos
};
