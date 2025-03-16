/**
 * RAG-Enhanced Agent Extension with ts-morph implementation
 * 
 * This extension enhances the RAG agent with ts-morph for safer code extraction and processing.
 */

import { Project, ScriptTarget, SyntaxKind, Node } from 'ts-morph';
import { 
  ProcessDefinition, 
  TaskDefinition, 
  SystemConfig
} from '../types';

/**
 * Extract code from an LLM response using ts-morph
 * @param response The LLM response text
 * @param language The language of the code to extract
 * @param debug Whether to log debug information
 * @returns The extracted code
 */
export function extractCodeFromResponse(response: string, language: string = 'typescript', debug: boolean = false): string {
  if (debug) {
    console.log('Raw response:', response);
  }

  // First try to extract code from markdown code blocks
  const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\s*([\\s\\S]*?)\\s*\`\`\``, 'g');
  const codeMatches = [...response.matchAll(codeBlockRegex)];
  
  if (codeMatches.length > 0) {
    // Use the first code block found
    const extractedCode = codeMatches[0][1].trim();
    if (debug) {
      console.log('Extracted code from markdown:', extractedCode);
    }
    return removeImportStatements(extractedCode);
  }
  
  // If no code blocks, try to find code after explanatory text
  const codeAfterExplanationRegex = /(?:Here's the code:|Here is the code:|The code is:)\s*([\s\S]*)/i;
  const explanationMatch = response.match(codeAfterExplanationRegex);
  
  if (explanationMatch) {
    const extractedCode = explanationMatch[1].trim();
    if (debug) {
      console.log('Extracted code after explanation:', extractedCode);
    }
    return removeImportStatements(extractedCode);
  }
  
  // If no code block found, check if the response starts with explanatory text
  // and has code after it (common pattern in LLM responses)
  const explanationSplitRegex = /^(.*?)(const\s+\w+\s*=\s*ReactiveSystem\.)/s;
  const explanationMatch2 = response.match(explanationSplitRegex);
  
  if (explanationMatch2 && explanationMatch2[2]) {
    // Found code after explanation text
    const extractedCode = response.substring(explanationMatch2.index! + explanationMatch2[1].length);
    if (debug) {
      console.log('Extracted code after explanation text:', extractedCode);
    }
    return removeImportStatements(extractedCode);
  }
  
  // If we still don't have code, try to find any line that looks like a ReactiveSystem call
  const reactiveSystemRegex = /(const\s+\w+\s*=\s*ReactiveSystem\..*)/s;
  const reactiveMatch = response.match(reactiveSystemRegex);
  
  if (reactiveMatch && reactiveMatch[1]) {
    const extractedCode = reactiveMatch[1];
    if (debug) {
      console.log('Extracted ReactiveSystem code:', extractedCode);
    }
    return removeImportStatements(extractedCode);
  }
  
  // If all else fails, use the entire response
  if (debug) {
    console.log('Using entire response as code');
  }
  return removeImportStatements(response);
}

/**
 * Remove import statements from code
 * @param code The code to process
 * @returns The code without import statements
 */
export function removeImportStatements(code: string): string {
  // Remove import statements
  return code
    .replace(/^\s*import\s+.*?;?\s*$/gm, '')
    .replace(/^\s*export\s+.*?;?\s*$/gm, '')
    .replace(/from\s+['"].*?['"];?\s*$/gm, ';')
    .trim();
}

/**
 * Process code with ts-morph
 * @param code The code to process
 * @param debug Whether to log debug information
 * @returns The processed code
 */
export function processCodeWithTsMorph(code: string, debug: boolean = false): string {
  try {
    // Create a new project
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
      },
    });
    
    // Create a source file from the code
    const sourceFile = project.createSourceFile('temp.ts', code, { overwrite: true });
    
    // Remove import statements
    sourceFile.getImportDeclarations().forEach(importDecl => {
      importDecl.remove();
    });
    
    // Remove export statements
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      exportDecl.remove();
    });
    
    // Find variable declarations that might be our process/task definitions
    const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    
    // Extract the process/task definition
    let processedCode = '';
    
    for (const varDecl of variableDeclarations) {
      const initializer = varDecl.getInitializer();
      if (initializer) {
        const initializerText = initializer.getText();
        
        // Check if this is a process or task definition
        if (
          initializerText.includes('Process.create') || 
          initializerText.includes('ReactiveSystem.Process.create') ||
          initializerText.includes('Task.create') || 
          initializerText.includes('ReactiveSystem.Task.create')
        ) {
          // Get the full statement
          const statement = varDecl.getParent()?.getParent();
          if (statement) {
            processedCode = statement.getText();
            break;
          }
        }
      }
    }
    
    // If we found a process/task definition, return it
    if (processedCode) {
      if (debug) {
        console.log('Processed code with ts-morph:', processedCode);
      }
      return processedCode;
    }
    
    // If we didn't find a specific definition, return the cleaned code
    const cleanedCode = sourceFile.getText();
    if (debug) {
      console.log('Cleaned code with ts-morph:', cleanedCode);
    }
    return cleanedCode;
    
  } catch (error) {
    console.error('Error processing code with ts-morph:', error);
    // Return the original code if ts-morph processing fails
    return code;
  }
}

/**
 * Convert code to a process definition using ts-morph
 * @param code The code to convert
 * @param processName The name of the process
 * @param debug Whether to log debug information
 * @returns The process definition
 */
export function convertCodeToProcessDefinition(code: string, processName: string, debug: boolean = false): ProcessDefinition {
  try {
    // Create a project to analyze the code
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
      },
    });
    
    const sourceFile = project.createSourceFile('temp.ts', code, { overwrite: true });
    
    // Initialize the process definition with defaults
    const processDefinition: ProcessDefinition = {
      id: processName.toLowerCase(),
      description: `Process: ${processName}`,
      states: {
        initial: {
          name: 'initial',
          description: 'Initial state',
          type: 'initial'
        }
      },
      initialState: 'initial',
      transitions: [],
    };
    
    // Find method calls that might define our process
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (const callExpr of callExpressions) {
      const expression = callExpr.getExpression();
      const expressionText = expression.getText();
      
      // Process creation
      if (expressionText.includes('Process.create') || expressionText.includes('ReactiveSystem.Process.create')) {
        // Extract process ID
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const idArg = args[0];
          if (idArg.getKind() === SyntaxKind.StringLiteral) {
            processDefinition.id = idArg.getText().replace(/['"]/g, '');
          }
        }
      }
      
      // Description
      if (expressionText.endsWith('.withDescription')) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const descArg = args[0];
          if (descArg.getKind() === SyntaxKind.StringLiteral) {
            processDefinition.description = descArg.getText().replace(/['"]/g, '');
          }
        }
      }
      
      // Initial state
      if (expressionText.endsWith('.withInitialState')) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const stateArg = args[0];
          if (stateArg.getKind() === SyntaxKind.StringLiteral) {
            const stateName = stateArg.getText().replace(/['"]/g, '');
            processDefinition.initialState = stateName;
            
            // Ensure this state exists in the states object
            if (!processDefinition.states[stateName]) {
              processDefinition.states[stateName] = {
                name: stateName,
                description: `State: ${stateName}`,
                type: 'initial'
              };
            } else {
              processDefinition.states[stateName].type = 'initial';
            }
          }
        }
      }
      
      // Add state
      if (expressionText.endsWith('.addState')) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const stateArg = args[0];
          if (stateArg.getKind() === SyntaxKind.StringLiteral) {
            const stateName = stateArg.getText().replace(/['"]/g, '');
            if (!processDefinition.states[stateName]) {
              processDefinition.states[stateName] = {
                name: stateName,
                description: `State: ${stateName}`,
                type: 'normal'
              };
            }
          }
        }
      }
      
      // Add transition
      if (expressionText.endsWith('.addTransition')) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const transitionArg = args[0];
          if (transitionArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const transitionObj = transitionArg as Node;
            
            // Extract from, to, and on properties
            let from: string | string[] = '';
            let to = '';
            let on = '';
            
            transitionObj.forEachChild(child => {
              if (child.getKind() === SyntaxKind.PropertyAssignment) {
                const propName = child.getFirstChild()?.getText();
                const propValue = child.getLastChild();
                
                if (propName === 'from') {
                  if (propValue?.getKind() === SyntaxKind.StringLiteral) {
                    from = propValue.getText().replace(/['"]/g, '');
                  } else if (propValue?.getKind() === SyntaxKind.ArrayLiteralExpression) {
                    from = [];
                    propValue.forEachChild(arrayItem => {
                      if (arrayItem.getKind() === SyntaxKind.StringLiteral) {
                        (from as string[]).push(arrayItem.getText().replace(/['"]/g, ''));
                      }
                    });
                  }
                } else if (propName === 'to') {
                  if (propValue?.getKind() === SyntaxKind.StringLiteral) {
                    to = propValue.getText().replace(/['"]/g, '');
                  }
                } else if (propName === 'on') {
                  if (propValue?.getKind() === SyntaxKind.StringLiteral) {
                    on = propValue.getText().replace(/['"]/g, '');
                  }
                }
              }
            });
            
            // Add the transition if we have all required properties
            if (from && to && on) {
              const fromArray = Array.isArray(from) ? from : [from];
              processDefinition.transitions.push({
                from: fromArray,
                to,
                on
              });
            }
          }
        }
      }
    }
    
    if (debug) {
      console.log('Converted process definition:', JSON.stringify(processDefinition, null, 2));
    }
    
    return processDefinition;
    
  } catch (error) {
    console.error('Error converting code to process definition:', error);
    // Return a fallback definition if conversion fails
    return createFallbackProcessDefinition(processName, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create a fallback process definition
 * @param processName The name of the process
 * @param errorMessage The error message
 * @returns The fallback process definition
 */
export function createFallbackProcessDefinition(processName: string, errorMessage: string): ProcessDefinition {
  console.log('Creating a minimal process definition as fallback...');
  
  return {
    id: processName.toLowerCase(),
    description: `Process: ${processName}`,
    states: {
      created: {
        name: 'created',
        description: 'State: created',
        type: 'initial'
      },
      processing: {
        name: 'processing',
        description: 'State: processing',
        type: 'normal'
      },
      shipped: {
        name: 'shipped',
        description: 'State: shipped',
        type: 'normal'
      },
      delivered: {
        name: 'delivered',
        description: 'State: delivered',
        type: 'normal'
      },
      cancelled: {
        name: 'cancelled',
        description: 'State: cancelled',
        type: 'normal'
      }
    },
    initialState: 'created',
    transitions: [
      {
        from: ['created'],
        to: 'processing',
        on: 'CREATE_ORDER'
      },
      {
        from: ['processing'],
        to: 'shipped',
        on: 'PROCESS_ORDER'
      },
      {
        from: ['shipped'],
        to: 'delivered',
        on: 'SHIP_ORDER'
      },
      {
        from: ['delivered'],
        to: 'cancelled',
        on: 'DELIVER_ORDER'
      },
      {
        from: ['cancelled'],
        to: 'cancelled',
        on: 'CANCEL_ORDER'
      }
    ],
    metadata: {
      generatedFallback: true,
      error: errorMessage
    }
  };
}

/**
 * Convert code to a task definition using ts-morph
 * @param code The code to convert
 * @param taskName The name of the task
 * @param debug Whether to log debug information
 * @returns The task definition
 */
export function convertCodeToTaskDefinition(code: string, taskName: string, debug: boolean = false): TaskDefinition {
  try {
    // Create a project to analyze the code
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
      },
    });
    
    const sourceFile = project.createSourceFile('temp.ts', code, { overwrite: true });
    
    // Initialize the task definition with defaults
    const taskDefinition: TaskDefinition = {
      id: taskName.toLowerCase(),
      description: `Task: ${taskName}`,
      inputSchema: {},
      outputSchema: {},
      implementation: 'async (input, context) => { return {}; }',
    };
    
    // Find method calls that might define our task
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (const callExpr of callExpressions) {
      const expression = callExpr.getExpression();
      const expressionText = expression.getText();
      
      // Task creation
      if (expressionText.includes('Task.create') || expressionText.includes('ReactiveSystem.Task.create')) {
        // Extract task ID
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const idArg = args[0];
          if (idArg.getKind() === SyntaxKind.StringLiteral) {
            taskDefinition.id = idArg.getText().replace(/['"]/g, '');
          }
        }
      }
      
      // Description
      if (expressionText.endsWith('.withDescription')) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const descArg = args[0];
          if (descArg.getKind() === SyntaxKind.StringLiteral) {
            taskDefinition.description = descArg.getText().replace(/['"]/g, '');
          }
        }
      }
      
      // Input schema
      if (expressionText.endsWith('.withInputSchema')) {
        // For simplicity, we'll just extract the text of the schema definition
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const schemaArg = args[0];
          taskDefinition.inputSchema = {
            type: 'object',
            properties: {
              // Extract properties from the schema if possible
              // This is simplified - a real implementation would parse the schema structure
              _schemaText: schemaArg.getText()
            }
          };
        }
      }
      
      // Output schema
      if (expressionText.endsWith('.withOutputSchema')) {
        // For simplicity, we'll just extract the text of the schema definition
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const schemaArg = args[0];
          taskDefinition.outputSchema = {
            type: 'object',
            properties: {
              // Extract properties from the schema if possible
              _schemaText: schemaArg.getText()
            }
          };
        }
      }
      
      // Implementation
      if (expressionText.endsWith('.withImplementation')) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const implArg = args[0];
          taskDefinition.implementation = implArg.getText();
        }
      }
    }
    
    if (debug) {
      console.log('Converted task definition:', JSON.stringify(taskDefinition, null, 2));
    }
    
    return taskDefinition;
    
  } catch (error) {
    console.error('Error converting code to task definition:', error);
    // Return a fallback definition if conversion fails
    return createFallbackTaskDefinition(taskName, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create a fallback task definition
 * @param taskName The name of the task
 * @param errorMessage The error message
 * @returns The fallback task definition
 */
export function createFallbackTaskDefinition(taskName: string, errorMessage: string): TaskDefinition {
  console.log('Creating a minimal task definition as fallback...');
  
  return {
    id: taskName.toLowerCase(),
    description: `Task: ${taskName}`,
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    },
    implementation: 'async (input, context) => { return { success: true, message: "Task executed" }; }',
    metadata: {
      generatedFallback: true,
      error: errorMessage
    }
  };
}

/**
 * Convert code to a system configuration using ts-morph
 * @param code The code to convert
 * @param systemName The name of the system
 * @param debug Whether to log debug information
 * @returns The system configuration
 */
export function convertCodeToSystemConfig(code: string, systemName: string, debug: boolean = false): SystemConfig {
  try {
    // Create a project to analyze the code
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
      },
    });
    
    const sourceFile = project.createSourceFile('temp.ts', code, { overwrite: true });
    
    // Initialize the system configuration with defaults
    const systemConfig: SystemConfig = {
      id: systemName.toLowerCase(),
      processes: [],
      tasks: [],
      extensions: {}
    };
    
    // Extract system configuration from the code
    // This is a simplified implementation - a real one would be more comprehensive
    
    // Look for object literals that might be our system config
    const objectLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
    
    for (const objLiteral of objectLiterals) {
      // Check if this object has properties that match a system config
      let hasIdProp = false;
      let hasProcessesProp = false;
      
      objLiteral.forEachChild(child => {
        if (child.getKind() === SyntaxKind.PropertyAssignment) {
          const propName = child.getFirstChild()?.getText();
          
          if (propName === 'id') hasIdProp = true;
          if (propName === 'processes') hasProcessesProp = true;
        }
      });
      
      // If this looks like a system config, extract its properties
      if (hasIdProp && hasProcessesProp) {
        objLiteral.forEachChild(child => {
          if (child.getKind() === SyntaxKind.PropertyAssignment) {
            const propName = child.getFirstChild()?.getText();
            const propValue = child.getLastChild();
            
            if (propName === 'id' && propValue?.getKind() === SyntaxKind.StringLiteral) {
              systemConfig.id = propValue.getText().replace(/['"]/g, '');
            }
            
            // Extract other properties as needed
          }
        });
      }
    }
    
    if (debug) {
      console.log('Converted system configuration:', JSON.stringify(systemConfig, null, 2));
    }
    
    return systemConfig;
    
  } catch (error) {
    console.error('Error converting code to system configuration:', error);
    // Return a fallback configuration if conversion fails
    return createFallbackSystemConfig(systemName, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Create a fallback system configuration
 * @param systemName The name of the system
 * @param errorMessage The error message
 * @returns The fallback system configuration
 */
export function createFallbackSystemConfig(systemName: string, errorMessage: string): SystemConfig {
  console.log('Creating a minimal system configuration as fallback...');
  
  return {
    id: systemName.toLowerCase(),
    processes: [],
    tasks: [],
    extensions: {},
    metadata: {
      generatedFallback: true,
      error: errorMessage
    }
  };
} 