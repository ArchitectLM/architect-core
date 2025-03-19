/**
 * Command extension for the DSL
 * 
 * Adds validation and execution capabilities to command components.
 */
import { defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { ComponentType, CommandComponentDefinition } from '../models/component.js';

/**
 * Command extension options
 */
export interface CommandExtensionOptions {
  /**
   * Default timeout for command execution in milliseconds
   */
  defaultTimeout?: number;
  
  /**
   * Whether to enable automatic input validation before execution
   */
  autoValidateInput?: boolean;
  
  /**
   * Whether to enable automatic output validation after execution
   */
  autoValidateOutput?: boolean;
}

/**
 * Command extension setup
 */
export function setupCommandExtension(dsl: DSL, options: CommandExtensionOptions = {}): void {
  // Get all command components
  // Note: This would work if DSL had a getAllComponents method
  // const components = dsl.getAllComponents()
  //   .filter(component => component.type === ComponentType.COMMAND) as CommandComponentDefinition[];
  
  // Instead, we'll leave this as a placeholder with a TODO
  // TODO: Implement a way to get all command components from the DSL
}

/**
 * Extend a command component with validation and execution capabilities
 */
function extendCommandComponent(command: CommandComponentDefinition, options: CommandExtensionOptions, dsl: DSL): void {
  // Get the implementation for this command
  const implementation = dsl.getImplementation(command.id);
  
  // Skip if no implementation is found
  if (!implementation) {
    console.warn(`No implementation found for command: ${command.id}`);
    return;
  }
  
  // Get the input and output schemas if they exist
  const inputSchema = command.input?.ref ? dsl.getComponent(command.input.ref) : null;
  const outputSchema = command.output?.ref ? dsl.getComponent(command.output.ref) : null;
  
  // Create an execute method that validates input and output
  (command as any).execute = async (input: any, context: any = {}) => {
    // Validate input if auto-validation is enabled and input schema exists
    if (options.autoValidateInput && inputSchema && (inputSchema as any).validate) {
      const validation = (inputSchema as any).validate(input);
      if (!validation.valid) {
        throw new Error(`Invalid input for command ${command.id}: ${JSON.stringify(validation.errors)}`);
      }
    }
    
    // Create execution context
    const executionContext = {
      ...context,
      command: command.id,
      startTime: Date.now()
    };
    
    // Execution timeout
    const timeout = context.timeout || options.defaultTimeout;
    let timeoutId: any = null;
    
    try {
      // Create a promise that resolves with the result or rejects on timeout
      const result = await Promise.race([
        implementation.handler(input, executionContext),
        new Promise((_, reject) => {
          if (timeout) {
            timeoutId = setTimeout(() => {
              reject(new Error(`Command execution timed out after ${timeout}ms: ${command.id}`));
            }, timeout);
          }
        })
      ]);
      
      // Validate output if auto-validation is enabled and output schema exists
      if (options.autoValidateOutput && outputSchema && (outputSchema as any).validate) {
        const validation = (outputSchema as any).validate(result);
        if (!validation.valid) {
          throw new Error(`Invalid output from command ${command.id}: ${JSON.stringify(validation.errors)}`);
        }
      }
      
      return result;
    } finally {
      // Clear timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };
}

/**
 * Define the command extension
 */
export const commandExtension = defineExtension({
  id: 'command',
  name: 'Command Extension',
  description: 'Adds validation and execution capabilities to command components',
  
  async setup(options?: CommandExtensionOptions) {
    // This will be called when the extension is initialized
    console.log('Command extension setup with options:', options);
  }
}); 