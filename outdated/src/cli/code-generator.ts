/**
 * Code Generator
 * 
 * Generates implementation code for a schema using LLM.
 */

import { SchemaFiles } from './schema-loader';

/**
 * Result of generating code
 */
export interface CodeGenerationResult {
  /**
   * Generated code, mapping filenames to content
   */
  code: Record<string, string>;
  
  /**
   * Whether the generation was successful
   */
  success: boolean;
  
  /**
   * Error message, if any
   */
  error?: string;
}

/**
 * Generates implementation code for a schema
 * @param schemaFiles Schema files to generate code for
 * @returns Result of generating code
 */
export async function generateCode(schemaFiles: SchemaFiles): Promise<CodeGenerationResult> {
  try {
    // Find the main system schema
    const systemSchema = findSystemSchema(schemaFiles);
    if (!systemSchema) {
      throw new Error('No system schema found in the provided files');
    }
    
    // Generate code for the system
    console.log('Generating code for system...');
    const generatedCode = await mockGenerateCode(systemSchema.schema);
    
    return {
      code: generatedCode,
      success: true
    };
  } catch (error) {
    return {
      code: {},
      success: false,
      error: `Error generating code: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Finds the main system schema in the schema files
 * @param schemaFiles Schema files to search
 * @returns The system schema and its filename, or null if not found
 */
function findSystemSchema(schemaFiles: SchemaFiles): { schema: any; filename: string } | null {
  for (const [filename, schema] of Object.entries(schemaFiles)) {
    if (isSystemSchema(schema)) {
      return { schema, filename };
    }
  }
  
  return null;
}

/**
 * Determines if a schema is a system schema
 * @param schema Schema to check
 * @returns True if the schema is a system schema
 */
function isSystemSchema(schema: any): boolean {
  return schema && 
         typeof schema === 'object' && 
         schema.id && 
         schema.name && 
         schema.version && 
         (schema.boundedContexts || schema.processes || schema.tasks);
}

/**
 * Mock implementation of code generation for testing
 * @param system System to generate code for
 * @returns Generated code
 */
async function mockGenerateCode(system: any): Promise<Record<string, string>> {
  const code: Record<string, string> = {};
  
  // Generate system file
  code['system.ts'] = `
    /**
     * ${system.name}
     * 
     * ${system.description || 'System definition'}
     * Version: ${system.version}
     */
    
    export const system = ${JSON.stringify(system, null, 2)};
    
    export default system;
  `;
  
  // Generate process implementations
  if (system.processes) {
    for (const [processId, process] of Object.entries(system.processes)) {
      if (typeof process === 'object') {
        code[`processes/${processId}.ts`] = generateProcessImplementation(processId, process);
      }
    }
  }
  
  // Generate task implementations
  if (system.tasks) {
    for (const [taskId, task] of Object.entries(system.tasks)) {
      if (typeof task === 'object') {
        code[`tasks/${taskId}.ts`] = generateTaskImplementation(taskId, task);
      }
    }
  }
  
  // Generate index files
  code['index.ts'] = `
    /**
     * ${system.name}
     * 
     * Main entry point for the system
     */
    
    import { system } from './system';
    import { ProcessEngine } from './core/process-engine';
    
    // Create a process engine
    const processEngine = new ProcessEngine(system);
    
    // Export the process engine
    export { processEngine };
    
    // Export the system
    export { system };
  `;
  
  // Generate process engine
  code['core/process-engine.ts'] = `
    /**
     * Process Engine
     * 
     * Executes processes defined in the system
     */
    
    export class ProcessEngine {
      /**
       * The system definition
       */
      private system: any;
      
      /**
       * Creates a new ProcessEngine
       * @param system The system definition
       */
      constructor(system: any) {
        this.system = system;
      }
      
      /**
       * Executes a process
       * @param processId ID of the process to execute
       * @param input Input data for the process
       * @returns Result of executing the process
       */
      async executeProcess(processId: string, input: any): Promise<{
        success: boolean;
        output?: any;
        error?: string;
      }> {
        try {
          // Get the process
          const process = this.system.processes[processId];
          if (!process) {
            throw new Error(\`Process not found: \${processId}\`);
          }
          
          // Execute the process based on its type
          if (process.type === 'stateful') {
            return this.executeStatefulProcess(process, input);
          } else {
            return this.executeStatelessProcess(process, input);
          }
        } catch (error) {
          return {
            success: false,
            error: \`Error executing process: \${error instanceof Error ? error.message : String(error)}\`
          };
        }
      }
      
      /**
       * Executes a stateful process
       * @param process Process to execute
       * @param input Input data for the process
       * @returns Result of executing the process
       */
      private async executeStatefulProcess(process: any, input: any): Promise<{
        success: boolean;
        output?: any;
        error?: string;
      }> {
        try {
          // Initialize process state
          let currentState = process.states[0];
          let processData = { ...input };
          
          // Execute tasks for the initial state
          const initialTasks = this.getTasksForState(process, currentState);
          for (const taskId of initialTasks) {
            const taskResult = await this.executeTask(taskId, processData);
            if (!taskResult.success) {
              return taskResult;
            }
            
            // Update process data with task output
            processData = { ...processData, ...taskResult.output };
          }
          
          // Find a transition from the current state
          const transition = process.transitions.find((t: any) => t.from === currentState);
          if (transition) {
            currentState = transition.to;
          }
          
          return {
            success: true,
            output: {
              state: currentState,
              data: processData
            }
          };
        } catch (error) {
          return {
            success: false,
            error: \`Error executing stateful process: \${error instanceof Error ? error.message : String(error)}\`
          };
        }
      }
      
      /**
       * Executes a stateless process
       * @param process Process to execute
       * @param input Input data for the process
       * @returns Result of executing the process
       */
      private async executeStatelessProcess(process: any, input: any): Promise<{
        success: boolean;
        output?: any;
        error?: string;
      }> {
        try {
          let processData = { ...input };
          
          // Execute all tasks in sequence
          for (const taskId of process.tasks) {
            const taskResult = await this.executeTask(taskId, processData);
            if (!taskResult.success) {
              return taskResult;
            }
            
            // Update process data with task output
            processData = { ...processData, ...taskResult.output };
          }
          
          return {
            success: true,
            output: processData
          };
        } catch (error) {
          return {
            success: false,
            error: \`Error executing stateless process: \${error instanceof Error ? error.message : String(error)}\`
          };
        }
      }
      
      /**
       * Gets tasks for a state in a stateful process
       * @param process Process to get tasks for
       * @param state State to get tasks for
       * @returns Array of task IDs
       */
      private getTasksForState(process: any, state: string): string[] {
        // This is a simplified implementation
        // In a real system, we would have a more sophisticated way to determine
        // which tasks to execute for a given state
        
        return process.tasks || [];
      }
      
      /**
       * Executes a task
       * @param taskId ID of the task to execute
       * @param input Input data for the task
       * @returns Result of executing the task
       */
      private async executeTask(taskId: string, input: any): Promise<{
        success: boolean;
        output?: any;
        error?: string;
      }> {
        try {
          // Get the task
          const task = this.system.tasks[taskId];
          if (!task) {
            throw new Error(\`Task not found: \${taskId}\`);
          }
          
          // Execute the task based on its type
          if (task.type === 'operation') {
            return this.executeOperationTask(task, input);
          } else if (task.type === 'decision') {
            return this.executeDecisionTask(task, input);
          } else {
            throw new Error(\`Unknown task type: \${task.type}\`);
          }
        } catch (error) {
          return {
            success: false,
            error: \`Error executing task: \${error instanceof Error ? error.message : String(error)}\`
          };
        }
      }
      
      /**
       * Executes an operation task
       * @param task Task to execute
       * @param input Input data for the task
       * @returns Result of executing the task
       */
      private async executeOperationTask(task: any, input: any): Promise<{
        success: boolean;
        output?: any;
        error?: string;
      }> {
        // This is a mock implementation
        // In a real system, we would execute the actual operation
        
        return {
          success: true,
          output: {
            result: \`Executed operation task: \${task.id}\`
          }
        };
      }
      
      /**
       * Executes a decision task
       * @param task Task to execute
       * @param input Input data for the task
       * @returns Result of executing the task
       */
      private async executeDecisionTask(task: any, input: any): Promise<{
        success: boolean;
        output?: any;
        error?: string;
      }> {
        // This is a mock implementation
        // In a real system, we would evaluate the decision logic
        
        return {
          success: true,
          output: {
            decision: \`Made decision for task: \${task.id}\`
          }
        };
      }
    }
    
    /**
     * Executes a process
     * @param system System definition
     * @param processId ID of the process to execute
     * @param input Input data for the process
     * @returns Result of executing the process
     */
    export async function executeProcess(system: any, processId: string, input: any): Promise<{
      success: boolean;
      output?: any;
      error?: string;
    }> {
      const processEngine = new ProcessEngine(system);
      return processEngine.executeProcess(processId, input);
    }
  `;
  
  return code;
}

/**
 * Generates implementation code for a process
 * @param processId ID of the process
 * @param process Process to generate code for
 * @returns Generated code
 */
function generateProcessImplementation(processId: string, process: any): string {
  const processDescription = process.description || `Process implementation for ${processId}`;
  
  return `
    /**
     * ${process.name}
     * 
     * ${processDescription}
     */
    
    import { executeProcess } from '../core/process-engine';
    import system from '../system';
    
    /**
     * Executes the ${process.name} process
     * @param input Input data for the process
     * @returns Result of executing the process
     */
    export async function execute${toPascalCase(processId)}(input: any): Promise<{
      success: boolean;
      output?: any;
      error?: string;
    }> {
      return executeProcess(system, '${processId}', input);
    }
    
    export default {
      execute: execute${toPascalCase(processId)}
    };
  `;
}

/**
 * Generates implementation code for a task
 * @param taskId ID of the task
 * @param task Task to generate code for
 * @returns Generated code
 */
function generateTaskImplementation(taskId: string, task: any): string {
  const taskName = task.name || taskId;
  const taskDescription = task.description || `Task implementation for ${taskId}`;
  
  return `
    /**
     * ${taskName}
     * 
     * ${taskDescription}
     */
    
    /**
     * Executes the ${taskName} task
     * @param input Input data for the task
     * @returns Result of executing the task
     */
    export async function execute${toPascalCase(taskId)}(input: any): Promise<{
      success: boolean;
      output?: any;
      error?: string;
    }> {
      try {
        // This is a placeholder implementation
        // In a real system, we would implement the actual task logic
        
        console.log(\`Executing task ${taskId} with input: \${JSON.stringify(input)}\`);
        
        // Simulate task execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          success: true,
          output: {
            result: \`Executed task: ${taskId}\`
          }
        };
      } catch (error) {
        return {
          success: false,
          error: \`Error executing task: \${error instanceof Error ? error.message : String(error)}\`
        };
      }
    }
    
    export default {
      execute: execute${toPascalCase(taskId)}
    };
  `;
}

/**
 * Converts a string to PascalCase
 * @param str String to convert
 * @returns Converted string
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
} 