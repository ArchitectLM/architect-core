/**
 * Schema Editing Agent
 * 
 * Uses LLM to edit schemas based on natural language prompts.
 */

import { SystemBuilder } from '../dsl';
import { validateSystemWithResult } from '../schema/validation';
import type { ReactiveSystem } from '../schema/types';

/**
 * Result of applying a schema change
 */
export interface SchemaChangeResult {
  /**
   * The modified system schema
   */
  system: ReactiveSystem;
  
  /**
   * Explanation of the changes made
   */
  explanation: string;
  
  /**
   * Whether the change was successful
   */
  success: boolean;
  
  /**
   * Validation issues, if any
   */
  validationIssues?: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * Schema Editing Agent
 * 
 * Uses LLM to edit schemas based on natural language prompts.
 */
export class SchemaEditingAgent {
  /**
   * Whether to simulate validation failures
   */
  private shouldReturnInvalidSystem: boolean = false;
  
  /**
   * Creates a new SchemaEditingAgent
   */
  constructor() {
    // Initialize the agent
  }
  
  /**
   * Sets whether to simulate validation failures
   * @param value Whether to simulate validation failures
   */
  setShouldReturnInvalidSystem(value: boolean): void {
    this.shouldReturnInvalidSystem = value;
  }
  
  /**
   * Gets whether to simulate validation failures
   * @returns Whether to simulate validation failures
   */
  getShouldReturnInvalidSystem(): boolean {
    return this.shouldReturnInvalidSystem;
  }
  
  /**
   * Applies a schema change based on a natural language prompt
   * @param schema Schema to modify
   * @param prompt Natural language prompt describing the changes to make
   * @returns Result of applying the schema change
   */
  async applySchemaChange(schema: ReactiveSystem, prompt: string): Promise<SchemaChangeResult> {
    // Check if we should return an invalid system
    if (this.shouldReturnInvalidSystem) {
      return {
        system: schema,
        explanation: 'Failed to apply schema change due to validation issues',
        success: false,
        validationIssues: [
          {
            path: 'system.processes.process-1',
            message: 'Process is missing required ID',
            severity: 'error'
          }
        ]
      };
    }
    
    try {
      // Create a SystemBuilder from the existing schema
      const builder = SystemBuilder.create(schema.id)
        .transform(() => schema);
      
      // This is a mock implementation that simulates adding a task
      if (prompt.toLowerCase().includes('add task') || prompt.toLowerCase().includes('create task')) {
        const taskName = this.extractTaskName(prompt);
        const taskId = taskName.toLowerCase().replace(/\s+/g, '-');
        
        // Add the task using the builder
        builder.withTask(taskId, task => ({
          ...task,
          name: taskName,
          type: 'operation',
          description: `Task created from prompt: ${prompt}`,
          input: [],
          output: []
        }));
        
        // Validate the modified system
        const validationResult = builder.validate();
        
        if (!validationResult.success) {
          return {
            system: schema,
            explanation: 'Failed to apply schema change due to validation issues',
            success: false,
            validationIssues: validationResult.issues
          };
        }
        
        // Build the modified system
        const modifiedSystem = builder.build();
        
        return {
          success: true,
          system: modifiedSystem,
          explanation: `Added a new task '${taskName}' with ID '${taskId}'.`
        };
      }
      
      // Simulate adding a process
      if (prompt.toLowerCase().includes('add process') || prompt.toLowerCase().includes('create process')) {
        const processName = this.extractProcessName(prompt);
        const processId = processName.toLowerCase().replace(/\s+/g, '-');
        
        // Find a bounded context to add the process to
        const contextId = schema.boundedContexts ? Object.keys(schema.boundedContexts)[0] : 'default-context';
        
        // Add the process using the builder
        if (prompt.toLowerCase().includes('stateful')) {
          builder.withStatefulProcess(processId, contextId, {
            name: processName,
            states: ['initial', 'processing', 'completed'],
            transitions: [
              { from: 'initial', to: 'processing', on: 'start' },
              { from: 'processing', to: 'completed', on: 'complete' }
            ]
          });
        } else {
          builder.withProcess(processId, contextId, processName);
        }
        
        // Validate the modified system
        const validationResult = builder.validate();
        
        if (!validationResult.success) {
          return {
            system: schema,
            explanation: 'Failed to apply schema change due to validation issues',
            success: false,
            validationIssues: validationResult.issues
          };
        }
        
        // Build the modified system
        const modifiedSystem = builder.build();
        
        return {
          success: true,
          system: modifiedSystem,
          explanation: `Added a new process '${processName}' with ID '${processId}'.`
        };
      }
      
      // Add a field to a task
      if (prompt.toLowerCase().includes('add field') || prompt.toLowerCase().includes('add a field')) {
        const fieldMatch = prompt.match(/add (?:a )?field (?:called )?['"]?([a-zA-Z0-9_]+)['"]? to (?:the )?task ['"]?([a-zA-Z0-9_-]+)['"]?/i);
        
        if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
          const fieldName = fieldMatch[1];
          const taskId = fieldMatch[2];
          
          // Create a copy of the schema
          const modifiedSchema = JSON.parse(JSON.stringify(schema));
          
          // Add the field to the task
          if (modifiedSchema.tasks && modifiedSchema.tasks[taskId]) {
            modifiedSchema.tasks[taskId][fieldName] = 'pending';
            
            // If it's a status field, add possible values
            if (fieldName === 'status') {
              modifiedSchema.tasks[taskId].statusValues = ['pending', 'in-progress', 'completed'];
            }
            
            // Validate the modified system
            const validationResult = validateSystemWithResult(modifiedSchema);
            
            if (!validationResult.success) {
              return {
                system: schema,
                explanation: 'Failed to apply schema change due to validation issues',
                success: false,
                validationIssues: validationResult.errors.map(error => ({
                  path: error.path,
                  message: error.message,
                  severity: 'error'
                }))
              };
            }
            
            return {
              success: true,
              system: modifiedSchema,
              explanation: `Added field '${fieldName}' to task '${taskId}'.`
            };
          }
        }
      }
      
      // Default response for unrecognized prompts
      return {
        success: false,
        system: schema,
        explanation: 'I could not understand how to modify the schema based on your prompt. Please try again with a more specific request, such as "Add a task called send-email" or "Create a process called order-fulfillment".'
      };
    } catch (error) {
      console.error('Error applying schema change:', error);
      return {
        success: false,
        system: schema,
        explanation: `Error applying schema change: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Extracts a task name from a prompt
   * @param prompt Prompt to extract from
   * @returns Extracted task name
   */
  private extractTaskName(prompt: string): string {
    // This is a very simple extraction logic for demonstration
    // In a real implementation, we would use more sophisticated NLP
    
    const taskRegex = /(?:add|create)\s+(?:a\s+)?task\s+(?:called\s+)?['"]?([a-zA-Z0-9\s-]+)['"]?/i;
    const match = prompt.match(taskRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return 'new-task';
  }
  
  /**
   * Extracts a process name from a prompt
   * @param prompt Prompt to extract from
   * @returns Extracted process name
   */
  private extractProcessName(prompt: string): string {
    // This is a very simple extraction logic for demonstration
    // In a real implementation, we would use more sophisticated NLP
    
    const processRegex = /(?:add|create)\s+(?:a\s+)?process\s+(?:called\s+)?['"]?([a-zA-Z0-9\s-]+)['"]?/i;
    const match = prompt.match(processRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return 'new-process';
  }
} 