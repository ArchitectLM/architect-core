/**
 * Schema Editor
 * 
 * Uses LLM to edit schemas based on natural language prompts.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { SchemaFiles } from './schema-loader';
import { validateSchema } from './schema-validator';
import { SchemaEditingAgent } from '../intelligence/schema-editing-agent';

const readFile = promisify(fs.readFile);

/**
 * Result of applying a schema edit
 */
export interface SchemaEditResult {
  /**
   * The modified schema
   */
  modifiedSchema: SchemaFiles;
  
  /**
   * Explanation of the changes made
   */
  explanation: string;
  
  /**
   * Whether the edit was successful
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
 * Applies a schema edit based on a natural language prompt
 * @param schemaFiles Schema files to edit
 * @param prompt Natural language prompt describing the changes to make
 * @param templatePath Path to the prompt template file (or 'default')
 * @returns Result of applying the schema edit
 */
export async function applySchemaEdit(
  schemaFiles: SchemaFiles,
  prompt: string,
  templatePath: string = 'default'
): Promise<SchemaEditResult> {
  try {
    // Load the prompt template
    const template = await loadPromptTemplate(templatePath);
    
    // Create a schema editing agent
    const agent = new SchemaEditingAgent();
    
    // Find the main system schema
    const systemSchema = findSystemSchema(schemaFiles);
    if (!systemSchema) {
      throw new Error('No system schema found in the provided files');
    }
    
    // Apply the schema change
    console.log('Applying schema change...');
    const result = await agent.applySchemaChange(systemSchema.schema, prompt);
    
    if (!result.success) {
      return {
        modifiedSchema: schemaFiles,
        explanation: result.explanation || 'Failed to apply schema change',
        success: false,
        validationIssues: result.validationIssues
      };
    }
    
    // Update the schema files with the modified system schema
    const modifiedSchemaFiles = { ...schemaFiles };
    modifiedSchemaFiles[systemSchema.filename] = result.system;
    
    return {
      modifiedSchema: modifiedSchemaFiles,
      explanation: result.explanation || 'Schema updated successfully',
      success: true
    };
  } catch (error) {
    return {
      modifiedSchema: schemaFiles,
      explanation: `Error applying schema edit: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    };
  }
}

/**
 * Loads a prompt template from a file or uses the default template
 * @param templatePath Path to the template file or 'default'
 * @returns The prompt template
 */
async function loadPromptTemplate(templatePath: string): Promise<string> {
  if (templatePath === 'default') {
    return `
You are a schema editing assistant for the ArchitectLM framework.
Your task is to modify the provided system schema based on the user's request.

The system schema follows this structure:
- id: Unique identifier for the system
- name: Name of the system
- version: Version of the system
- boundedContexts: Logical boundaries within the system
- processes: Workflows that can be stateful or stateless
- tasks: Individual operations that perform specific functions

Please make the requested changes while maintaining the integrity of the schema.
Ensure that all references between components remain valid.

User request: {{prompt}}

System schema:
{{schema}}
`;
  }
  
  try {
    return await readFile(templatePath, 'utf-8');
  } catch (error) {
    console.warn(`Warning: Failed to load prompt template from ${templatePath}. Using default template.`);
    return loadPromptTemplate('default');
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
 * Mock implementation of the SchemaEditingAgent for testing
 */
export class MockSchemaEditingAgent {
  /**
   * Applies a schema change based on a natural language prompt
   * @param schema Schema to modify
   * @param prompt Natural language prompt describing the changes to make
   * @returns Result of applying the schema change
   */
  async applySchemaChange(schema: any, prompt: string): Promise<{
    success: boolean;
    system: any;
    explanation?: string;
    validationIssues?: Array<{
      path: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  }> {
    // This is a mock implementation that simulates adding a task
    if (prompt.toLowerCase().includes('add task') || prompt.toLowerCase().includes('create task')) {
      const taskName = extractTaskName(prompt);
      const taskId = taskName.toLowerCase().replace(/\s+/g, '-');
      
      // Create a copy of the schema
      const modifiedSchema = JSON.parse(JSON.stringify(schema));
      
      // Add the new task
      if (!modifiedSchema.tasks) {
        modifiedSchema.tasks = {};
      }
      
      modifiedSchema.tasks[taskId] = {
        id: taskId,
        name: taskName,
        type: 'operation',
        description: `Task created from prompt: ${prompt}`,
        input: [],
        output: []
      };
      
      return {
        success: true,
        system: modifiedSchema,
        explanation: `Added a new task '${taskName}' with ID '${taskId}'.`
      };
    }
    
    // Simulate adding a process
    if (prompt.toLowerCase().includes('add process') || prompt.toLowerCase().includes('create process')) {
      const processName = extractProcessName(prompt);
      const processId = processName.toLowerCase().replace(/\s+/g, '-');
      
      // Create a copy of the schema
      const modifiedSchema = JSON.parse(JSON.stringify(schema));
      
      // Add the new process
      if (!modifiedSchema.processes) {
        modifiedSchema.processes = {};
      }
      
      modifiedSchema.processes[processId] = {
        id: processId,
        name: processName,
        type: 'stateful',
        description: `Process created from prompt: ${prompt}`,
        tasks: [],
        states: ['initial', 'processing', 'completed'],
        transitions: [
          {
            from: 'initial',
            to: 'processing',
            on: 'start'
          },
          {
            from: 'processing',
            to: 'completed',
            on: 'complete'
          }
        ]
      };
      
      return {
        success: true,
        system: modifiedSchema,
        explanation: `Added a new process '${processName}' with ID '${processId}'.`
      };
    }
    
    // Default response for unrecognized prompts
    return {
      success: false,
      system: schema,
      explanation: 'I could not understand how to modify the schema based on your prompt. Please try again with a more specific request, such as "Add a task called send-email" or "Create a process called order-fulfillment".'
    };
  }
}

/**
 * Extracts a task name from a prompt
 * @param prompt Prompt to extract from
 * @returns Extracted task name
 */
function extractTaskName(prompt: string): string {
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
function extractProcessName(prompt: string): string {
  // This is a very simple extraction logic for demonstration
  // In a real implementation, we would use more sophisticated NLP
  
  const processRegex = /(?:add|create)\s+(?:a\s+)?process\s+(?:called\s+)?['"]?([a-zA-Z0-9\s-]+)['"]?/i;
  const match = prompt.match(processRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return 'new-process';
} 