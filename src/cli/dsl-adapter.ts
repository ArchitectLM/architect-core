/**
 * DSL Adapter for CLI
 * 
 * This module provides adapters to integrate the Hybrid DSL with the CLI,
 * allowing for serialization, deserialization, and validation of DSL-created systems.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { 
  SystemBuilder, 
  migrateSchema, 
  EnhancedValidationResult,
  EnhancedValidationIssue
} from '../dsl';
import { SchemaFiles } from './schema-loader';
import { ValidationResult, ValidationIssue } from './schema-validator';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Converts a TypeScript DSL file to a JSON schema file
 * @param dslFilePath Path to the TypeScript DSL file
 * @returns Promise resolving to the JSON schema as a string
 */
export async function convertDslToJson(dslFilePath: string): Promise<string> {
  try {
    // Dynamically import the DSL file
    const dslModule = await import(path.resolve(dslFilePath));
    
    // Check if the module exports a createSystem function
    if (typeof dslModule.createTodoSystem === 'function') {
      const system = dslModule.createTodoSystem();
      return JSON.stringify(system, null, 2);
    } else if (typeof dslModule.serializeSystem === 'function') {
      return dslModule.serializeSystem();
    } else {
      throw new Error('DSL file does not export createTodoSystem or serializeSystem function');
    }
  } catch (error: any) {
    throw new Error(`Failed to convert DSL to JSON: ${error.message}`);
  }
}

/**
 * Loads a system from a DSL file or a JSON file
 * @param filePath Path to the DSL or JSON file
 * @returns Promise resolving to the loaded system
 */
export async function loadSystemFromFile(filePath: string): Promise<any> {
  try {
    if (filePath.endsWith('.ts')) {
      // It's a DSL file, convert it to JSON first
      const jsonContent = await convertDslToJson(filePath);
      return JSON.parse(jsonContent);
    } else if (filePath.endsWith('.json')) {
      // It's a JSON file, load it directly
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } else {
      throw new Error('Unsupported file format. Only .ts and .json files are supported.');
    }
  } catch (error: any) {
    throw new Error(`Failed to load system from file: ${error.message}`);
  }
}

/**
 * Converts a DSL-created system to SchemaFiles format for the CLI
 * @param system The system object
 * @returns SchemaFiles object
 */
export function convertSystemToSchemaFiles(system: any): SchemaFiles {
  // Create a virtual filename based on the system ID
  const filename = `${system.id}.json`;
  return { [filename]: system };
}

/**
 * Converts an EnhancedValidationResult to the CLI's ValidationResult format
 * @param enhancedResult The enhanced validation result from the DSL
 * @returns ValidationResult in the CLI format
 */
export function convertValidationResult(enhancedResult: EnhancedValidationResult): ValidationResult {
  const issues: ValidationIssue[] = enhancedResult.issues.map(issue => ({
    path: issue.path,
    message: issue.message,
    severity: issue.severity,
    source: 'dsl-validation'
  }));
  
  return {
    success: enhancedResult.success,
    issues
  };
}

/**
 * Validates a system using the DSL validation
 * @param system The system to validate
 * @returns ValidationResult in the CLI format
 */
export function validateDslSystem(system: any): ValidationResult {
  try {
    // Use the SystemBuilder to validate
    const builder = SystemBuilder.create(system.id)
      .transform(() => system);
    
    const enhancedResult = builder.validate();
    return convertValidationResult(enhancedResult);
  } catch (error: any) {
    return {
      success: false,
      issues: [{
        path: 'system',
        message: `Error validating system: ${error.message}`,
        severity: 'error',
        source: 'dsl-validation'
      }]
    };
  }
}

/**
 * Migrates a system to a new version
 * @param system The system to migrate
 * @param targetVersion The target version
 * @param transformerCode Optional JavaScript code string for the transformer function
 * @returns The migrated system
 */
export function migrateDslSystem(system: any, targetVersion: string, transformerCode?: string): any {
  try {
    let transformer;
    
    if (transformerCode) {
      // Create a transformer function from the code string
      // Note: This uses eval which can be dangerous - in a production environment,
      // you would want to use a safer approach like the vm module
      transformer = eval(`(system) => { ${transformerCode} }`);
    }
    
    return migrateSchema(system, targetVersion, transformer);
  } catch (error: any) {
    throw new Error(`Failed to migrate system: ${error.message}`);
  }
}

/**
 * Saves a system to a file
 * @param system The system to save
 * @param outputPath The output file path
 * @returns Promise resolving when the file is saved
 */
export async function saveSystemToFile(system: any, outputPath: string): Promise<void> {
  try {
    const content = JSON.stringify(system, null, 2);
    await writeFile(outputPath, content);
  } catch (error: any) {
    throw new Error(`Failed to save system to file: ${error.message}`);
  }
}

/**
 * Converts a JSON schema to a DSL file
 * @param jsonSchema The JSON schema
 * @param outputPath The output file path
 * @returns Promise resolving when the file is saved
 */
export async function convertJsonToDsl(jsonSchema: any, outputPath: string): Promise<void> {
  try {
    const system = typeof jsonSchema === 'string' ? JSON.parse(jsonSchema) : jsonSchema;
    
    // Generate DSL code
    const dslCode = generateDslCode(system);
    
    // Save to file
    await writeFile(outputPath, dslCode);
  } catch (error: any) {
    throw new Error(`Failed to convert JSON to DSL: ${error.message}`);
  }
}

/**
 * Generates DSL code from a system object
 * @param system The system object
 * @returns The generated DSL code
 */
function generateDslCode(system: any): string {
  // Start with imports
  let code = `/**
 * Generated DSL for ${system.name}
 * Generated on: ${new Date().toISOString()}
 */

import { SystemBuilder } from '../src/dsl';

export function create${toPascalCase(system.id)}() {
  return SystemBuilder.create('${system.id}')
    .withName('${system.name}')
    .withVersion('${system.version}')`;
  
  // Add description if present
  if (system.description) {
    code += `
    .withDescription('${system.description}')`;
  }
  
  // Add bounded contexts
  if (system.boundedContexts) {
    for (const [id, context] of Object.entries<any>(system.boundedContexts)) {
      code += `
    .withBoundedContext('${id}', '${context.name}')`;
    }
  }
  
  // Add processes
  if (system.processes) {
    for (const [id, process] of Object.entries<any>(system.processes)) {
      if (process.type === 'stateful' && process.states && process.transitions) {
        // Stateful process
        code += `
    .withStatefulProcess('${id}', '${process.contextId}', {
      name: '${process.name}',
      states: [${process.states.map((s: string) => `'${s}'`).join(', ')}],
      transitions: [
        ${process.transitions.map((t: any) => `{ from: '${t.from}', to: '${t.to}', on: '${t.on || t.trigger}' }`).join(',\n        ')}
      ]
    })`;
      } else {
        // Stateless process
        code += `
    .withProcess('${id}', '${process.contextId}', '${process.name}')`;
      }
    }
  }
  
  // Add tasks
  if (system.tasks) {
    for (const [id, task] of Object.entries<any>(system.tasks)) {
      code += `
    .withTask('${id}', task => ({
      ...task,
      label: '${task.label || task.name}',
      type: '${task.type}'`;
      
      if (task.description) {
        code += `,
      description: '${task.description}'`;
      }
      
      if (task.input) {
        const inputArray = Array.isArray(task.input) 
          ? task.input 
          : (typeof task.input === 'object' 
            ? task.input.map((i: any) => i.name) 
            : [task.input]);
        
        code += `,
      input: [${inputArray.map((i: string) => `'${i}'`).join(', ')}]`;
      }
      
      if (task.output) {
        const outputArray = Array.isArray(task.output) 
          ? task.output 
          : (typeof task.output === 'object' 
            ? task.output.map((o: any) => o.name) 
            : [task.output]);
        
        code += `,
      output: [${outputArray.map((o: string) => `'${o}'`).join(', ')}]`;
      }
      
      code += `
    }))`;
    }
  }
  
  // Add process tasks
  if (system.processes) {
    for (const [processId, process] of Object.entries<any>(system.processes)) {
      if (process.tasks && Array.isArray(process.tasks)) {
        for (const taskId of process.tasks) {
          code += `
    .withProcessTask('${processId}', '${taskId}')`;
        }
      }
    }
  }
  
  // Close the builder
  code += `
    .build();
}

// Export the create function
export default create${toPascalCase(system.id)};

// For CLI usage
if (require.main === module) {
  const system = create${toPascalCase(system.id)}();
  console.log(JSON.stringify(system, null, 2));
}
`;
  
  return code;
}

/**
 * Converts a string to PascalCase
 * @param str The string to convert
 * @returns The PascalCase string
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
} 