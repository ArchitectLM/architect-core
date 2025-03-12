/**
 * Enhanced Fallbacks Example
 * 
 * This example demonstrates a comprehensive fallback strategy for DSL-based applications
 * when LLM agents don't fully implement the required logic.
 */

import fs from 'fs';
import path from 'path';
import { loadSystemFromFile, saveSystemToFile, validateDslSystem } from '../cli/dsl-adapter';
import { ValidationIssue } from '../cli/schema-validator';
import { applySchemaEdit } from '../cli/schema-editor';
import { generateTests } from '../cli/test-generator';
import { generateCode } from '../cli/code-generator';
import { ReactiveSystemRuntime } from '../runtime-core/lib/runtime';
import { CodeGenerator } from '../runtime-core/lib/code-generation';

// Define types for our fallback implementations
interface TaskFallback {
  id: string;
  schema: any;
  implementation: string;
  test: string;
}

interface ProcessFallback {
  id: string;
  schema: any;
  implementation?: string;
  test?: string;
}

// Registry of fallback implementations
const fallbackRegistry = {
  tasks: {
    'mark-important': {
      id: 'mark-important',
      schema: {
        id: 'mark-important',
        name: 'Mark Todo as Important',
        type: 'operation',
        description: 'Marks a todo as important with a priority level',
        input: [
          {
            name: 'todoId',
            type: 'string',
            required: true
          },
          {
            name: 'priority',
            type: 'string',
            required: true
          }
        ],
        output: [
          {
            name: 'success',
            type: 'boolean'
          }
        ]
      },
      implementation: `
/**
 * Mark Todo as Important
 * 
 * This task marks a todo item as important with a specified priority level.
 * It updates the todo item in the database with the priority information.
 */

/**
 * Executes the Mark Todo as Important task
 * @param input Input data for the task
 * @returns Result of executing the task
 */
export async function executeMarkImportant(input: any): Promise<{
  success: boolean;
  output?: any;
  error?: string;
}> {
  try {
    // Validate input
    if (!input.todoId) {
      throw new Error('todoId is required');
    }
    
    if (!input.priority) {
      throw new Error('priority is required');
    }
    
    // Validate priority value (assuming valid values are 'low', 'medium', 'high')
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(input.priority.toLowerCase())) {
      throw new Error('priority must be one of: low, medium, high');
    }
    
    console.log(\`Marking todo \${input.todoId} as important with priority: \${input.priority}\`);
    
    // In a real implementation, we would:
    // 1. Fetch the todo from the database
    // 2. Update its priority
    // 3. Save it back to the database
    
    // Simulate database interaction
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      output: {
        success: true,
        todoId: input.todoId,
        priority: input.priority,
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: \`Error marking todo as important: \${error instanceof Error ? error.message : String(error)}\`
    };
  }
}

export default {
  execute: executeMarkImportant
};
`,
      test: `
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMarkImportant } from '../../src/tasks/mark-important';

describe('Mark Todo as Important', () => {
  it('should mark a todo as important with valid priority', async () => {
    const result = await executeMarkImportant({
      todoId: '123',
      priority: 'high'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.success).toBe(true);
    expect(result.output.todoId).toBe('123');
    expect(result.output.priority).toBe('high');
    expect(result.output.updatedAt).toBeDefined();
  });
  
  it('should fail when todoId is missing', async () => {
    const result = await executeMarkImportant({
      priority: 'high'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('todoId is required');
  });
  
  it('should fail when priority is missing', async () => {
    const result = await executeMarkImportant({
      todoId: '123'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('priority is required');
  });
  
  it('should fail with invalid priority value', async () => {
    const result = await executeMarkImportant({
      todoId: '123',
      priority: 'invalid'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('priority must be one of');
  });
});
`
    },
    'filter-important-todos': {
      id: 'filter-important-todos',
      schema: {
        id: 'filter-important-todos',
        name: 'Filter Important Todos',
        type: 'operation',
        description: 'Filters todos by priority level',
        input: [
          {
            name: 'todos',
            type: 'array',
            required: true
          },
          {
            name: 'minPriority',
            type: 'string',
            required: false
          }
        ],
        output: [
          {
            name: 'filteredTodos',
            type: 'array'
          }
        ]
      },
      implementation: `
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
      error: \`Error filtering important todos: \${error instanceof Error ? error.message : String(error)}\`
    };
  }
}

export default {
  execute: executeFilterImportantTodos
};
`,
      test: `
import { describe, it, expect } from 'vitest';
import { executeFilterImportantTodos } from '../../src/tasks/filter-important-todos';

describe('Filter Important Todos', () => {
  const sampleTodos = [
    { id: '1', title: 'Task 1', priority: 'low' },
    { id: '2', title: 'Task 2', priority: 'medium' },
    { id: '3', title: 'Task 3', priority: 'high' },
    { id: '4', title: 'Task 4', priority: 'low' },
    { id: '5', title: 'Task 5' } // No priority
  ];
  
  it('should filter todos with low priority and above', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'low'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(4);
    expect(result.output.filteredTodos.map(t => t.id)).toContain('1');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('2');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('3');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('4');
  });
  
  it('should filter todos with medium priority and above', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'medium'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(2);
    expect(result.output.filteredTodos.map(t => t.id)).toContain('2');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('3');
  });
  
  it('should filter todos with high priority only', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'high'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(1);
    expect(result.output.filteredTodos[0].id).toBe('3');
  });
  
  it('should default to low priority if not specified', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(4);
  });
  
  it('should fail with invalid todos input', async () => {
    const result = await executeFilterImportantTodos({
      todos: 'not an array'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('todos must be an array');
  });
  
  it('should fail with invalid priority value', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'invalid'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('minPriority must be one of');
  });
});
`
    }
  },
  processes: {
    'manage-priorities': {
      id: 'manage-priorities',
      schema: {
        id: 'manage-priorities',
        name: 'Manage Todo Priorities',
        type: 'stateless',
        contextId: 'todos',
        description: 'Manages priority levels for todo items',
        tasks: ['mark-important', 'filter-important-todos']
      }
    }
  }
};

async function enhancedFallbacks() {
  try {
    console.log('Loading system from file...');
    const systemPath = path.resolve('examples/todo-system.json');
    const system = await loadSystemFromFile(systemPath);

    console.log('Validating original system...');
    const validationResult = validateDslSystem(system);
    if (!validationResult.success) {
      console.error('Original system has validation errors:');
      validationResult.issues?.forEach((issue: ValidationIssue) => {
        console.error(`- ${issue.message}`);
      });
      process.exit(1);
    }

    console.log('Applying schema edits based on prompt...');
    const prompt = "Add tasks for managing todo priorities, including marking todos as important and filtering by priority";
    const editResult = await applySchemaEdit({ 'todo-system.json': system }, prompt, 'default');

    // Get the modified system
    let modifiedSystem = editResult.modifiedSchema['todo-system.json'];
    
    // Apply fallbacks based on what's missing
    console.log('Checking for missing components and applying fallbacks...');
    
    // Track what we've added
    const addedComponents = {
      tasks: [] as string[],
      processes: [] as string[]
    };
    
    // 1. Check for missing tasks and add fallbacks
    for (const [taskId, fallback] of Object.entries(fallbackRegistry.tasks)) {
      if (!modifiedSystem.tasks || !modifiedSystem.tasks[taskId]) {
        console.log(`Adding fallback for missing task: ${taskId}`);
        
        // Add the task to the system
        modifiedSystem.tasks = {
          ...modifiedSystem.tasks,
          [taskId]: fallback.schema
        };
        
        addedComponents.tasks.push(taskId);
      }
    }
    
    // 2. Check for missing processes and add fallbacks
    for (const [processId, fallback] of Object.entries(fallbackRegistry.processes)) {
      if (!modifiedSystem.processes || !modifiedSystem.processes[processId]) {
        console.log(`Adding fallback for missing process: ${processId}`);
        
        // Add the process to the system
        modifiedSystem.processes = {
          ...modifiedSystem.processes,
          [processId]: fallback.schema
        };
        
        // Add the process to its bounded context
        const contextId = fallback.schema.contextId;
        if (modifiedSystem.boundedContexts && modifiedSystem.boundedContexts[contextId]) {
          const context = modifiedSystem.boundedContexts[contextId];
          context.processes = [...(context.processes || []), processId];
        }
        
        addedComponents.processes.push(processId);
      }
    }
    
    // 3. Ensure all tasks are assigned to appropriate processes
    if (addedComponents.tasks.length > 0 && modifiedSystem.processes) {
      // Find or create a suitable process for priority-related tasks
      let priorityProcess = modifiedSystem.processes['manage-priorities'];
      
      if (!priorityProcess && addedComponents.processes.includes('manage-priorities')) {
        priorityProcess = modifiedSystem.processes['manage-priorities'];
      } else if (!priorityProcess) {
        // If we don't have a dedicated process, add tasks to manage-todos
        const manageTodosProcess = modifiedSystem.processes['manage-todos'];
        if (manageTodosProcess) {
          manageTodosProcess.tasks = [
            ...(manageTodosProcess.tasks || []),
            ...addedComponents.tasks.filter(taskId => !manageTodosProcess.tasks?.includes(taskId))
          ];
        }
      }
    }

    console.log('Validating modified system...');
    const modifiedValidationResult = validateDslSystem(modifiedSystem);
    if (!modifiedValidationResult.success) {
      console.error('Modified system has validation errors:');
      modifiedValidationResult.issues?.forEach((issue: ValidationIssue) => {
        console.error(`- ${issue.message}`);
      });
      process.exit(1);
    }

    // Save the modified system
    console.log('Saving modified system...');
    const outputDir = path.resolve('output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'todo-system-enhanced-fallbacks.json');
    await saveSystemToFile(modifiedSystem, outputPath);
    console.log(`Saved ${outputPath}`);

    // Generate tests
    console.log('Generating tests...');
    const testsDir = path.join(outputDir, 'tests-enhanced');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const testResult = await generateTests({ 'todo-system.json': modifiedSystem });
    
    // Apply fallback tests for components we added
    for (const taskId of addedComponents.tasks) {
      const fallback = fallbackRegistry.tasks[taskId];
      if (fallback && fallback.test) {
        const taskTestPath = path.join(testsDir, 'tasks', `${taskId}.test.ts`);
        
        // Create subdirectories if needed
        const dirPath = path.dirname(taskTestPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Write the fallback test
        fs.writeFileSync(taskTestPath, fallback.test);
        console.log(`Saved fallback test for ${taskId}: ${taskTestPath}`);
      }
    }
    
    // Save the generated tests
    for (const [filename, content] of Object.entries(testResult.tests)) {
      // Skip tests for components we've added fallbacks for
      const taskMatch = filename.match(/tasks\/(.+)\.test\.ts$/);
      if (taskMatch && addedComponents.tasks.includes(taskMatch[1])) {
        continue;
      }
      
      const testOutputPath = path.join(testsDir, filename);
      
      // Create subdirectories if needed
      const dirPath = path.dirname(testOutputPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(testOutputPath, content);
      console.log(`Saved test ${testOutputPath}`);
    }

    // Generate code
    console.log('Generating implementation code...');
    const codeDir = path.join(outputDir, 'src-enhanced');
    if (!fs.existsSync(codeDir)) {
      fs.mkdirSync(codeDir, { recursive: true });
    }

    const codeResult = await generateCode({ 'todo-system.json': modifiedSystem });
    
    // Apply fallback implementations for components we added
    for (const taskId of addedComponents.tasks) {
      const fallback = fallbackRegistry.tasks[taskId];
      if (fallback && fallback.implementation) {
        const taskImplPath = path.join(codeDir, 'tasks', `${taskId}.ts`);
        
        // Create subdirectories if needed
        const dirPath = path.dirname(taskImplPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Write the fallback implementation
        fs.writeFileSync(taskImplPath, fallback.implementation);
        console.log(`Saved fallback implementation for ${taskId}: ${taskImplPath}`);
      }
    }
    
    // Save the generated code
    for (const [filename, content] of Object.entries(codeResult.code)) {
      // Skip implementations for components we've added fallbacks for
      const taskMatch = filename.match(/tasks\/(.+)\.ts$/);
      if (taskMatch && addedComponents.tasks.includes(taskMatch[1])) {
        continue;
      }
      
      const codeOutputPath = path.join(codeDir, filename);
      
      // Create subdirectories if needed
      const dirPath = path.dirname(codeOutputPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(codeOutputPath, content);
      console.log(`Saved code ${codeOutputPath}`);
    }

    // Demonstrate using the runtime core with the modified system
    console.log('Creating runtime with the modified system...');
    const runtime = new ReactiveSystemRuntime(modifiedSystem);

    // Register implementations for our fallback tasks
    for (const taskId of addedComponents.tasks) {
      // For demonstration purposes, we'll use a simple implementation
      runtime.registerTaskImplementation(taskId, async (input) => {
        console.log(`Executing ${taskId} task with input:`, input);
        
        if (taskId === 'mark-important') {
          return {
            success: true,
            todoId: input.todoId,
            priority: input.priority
          };
        } else if (taskId === 'filter-important-todos') {
          const filteredTodos = (input.todos || []).filter(todo => 
            todo.priority && ['medium', 'high'].includes(todo.priority.toLowerCase())
          );
          return {
            filteredTodos
          };
        }
        
        return { success: true };
      });
    }

    // Execute the mark-important task
    if (addedComponents.tasks.includes('mark-important')) {
      console.log('Executing mark-important task...');
      const result = await runtime.executeTask('mark-important', {
        todoId: '123',
        priority: 'high'
      });
      console.log('Task execution result:', result);
    }

    // Execute the filter-important-todos task
    if (addedComponents.tasks.includes('filter-important-todos')) {
      console.log('Executing filter-important-todos task...');
      const todos = [
        { id: '1', title: 'Task 1', priority: 'low' },
        { id: '2', title: 'Task 2', priority: 'medium' },
        { id: '3', title: 'Task 3', priority: 'high' }
      ];
      const result = await runtime.executeTask('filter-important-todos', {
        todos,
        minPriority: 'medium'
      });
      console.log('Task execution result:', result);
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
enhancedFallbacks().catch(console.error); 