/**
 * DSL Sandbox Environment
 * 
 * This module provides a sandbox environment for DSL runtime modules.
 * It exposes global functions and objects that can be used in DSL files
 * without explicit imports.
 */

import { ProcessBuilder } from '../builders/process-builder';
import { TaskBuilder } from '../builders/task-builder';
import { ReactiveSystemBuilder } from './reactive-system';
import { registerProcess, registerTask, getProcess, getTask } from './dsl-registry';
import { setupGlobalDSL, resetGlobalDSL } from './global-dsl';
import * as vm from 'vm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DSL Sandbox Context
 * Contains all the global objects and functions available in the sandbox
 */
export interface DSLSandboxContext {
  Process: {
    create: (id: string) => ProcessBuilder;
  };
  Task: {
    create: (id: string) => TaskBuilder;
  };
  ReactiveSystem: {
    define: typeof ReactiveSystemBuilder.define;
    getProcess: typeof getProcess;
    getTask: typeof getTask;
  };
  console: typeof console;
  import: (modulePath: string) => any;
  export: (name: string, value: any) => void;
  __exports: Record<string, any>;
  __filename: string;
  __dirname: string;
}

/**
 * Create a sandbox context with global DSL objects and functions
 */
export function createSandboxContext(filename: string): DSLSandboxContext {
  const dirname = path.dirname(filename);
  const exports: Record<string, any> = {};
  
  // Set up global DSL objects
  setupGlobalDSL();
  
  return {
    // Use the global DSL objects
    Process: (global as any).Process,
    Task: (global as any).Task,
    ReactiveSystem: (global as any).ReactiveSystem,
    console,
    // ESM import function (simplified for sandbox)
    import: (modulePath: string) => {
      if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
        const resolvedPath = path.resolve(dirname, modulePath);
        const ext = path.extname(resolvedPath) || '.ts';
        const fullPath = resolvedPath + (ext ? '' : ext);
        
        try {
          return executeDSLFile(fullPath);
        } catch (error) {
          console.error(`Error importing module ${modulePath}:`, error);
          throw error;
        }
      }
      
      // For built-in or node_modules, we can't really support them in the sandbox
      // Just return an empty object
      return {};
    },
    // ESM export function
    export: (name: string, value: any) => {
      exports[name] = value;
    },
    __exports: exports,
    __filename: filename,
    __dirname: dirname
  };
}

/**
 * Remove TypeScript type annotations from code
 * @param code The TypeScript code
 * @returns JavaScript code without type annotations
 */
function removeTypeAnnotations(code: string): string {
  // Remove type annotations in function parameters
  let result = code
    // Remove parameter type annotations like (input: { ... })
    .replace(/\(([^)]*)\)/g, (match, params) => {
      // Replace type annotations in parameters
      const newParams = params.replace(/:\s*\{[^}]*\}/g, '')
                              .replace(/:\s*[a-zA-Z0-9_<>[\]|&]+/g, '');
      return `(${newParams})`;
    })
    // Remove generic type parameters like <T>
    .replace(/<[^>]*>/g, '')
    // Remove return type annotations like (): void
    .replace(/\):\s*[a-zA-Z0-9_<>[\]|&]+/g, ')');
  
  return result;
}

/**
 * Preprocess the code to fix common syntax issues
 * @param content The original code
 * @returns Fixed code
 */
function preprocessCode(content: string): string {
  // Initialize result with the original content
  let result = content;
  
  // Fix missing colon after 'from' in transitions
  // This regex specifically targets the pattern "from'" or "from[" without a colon
  result = result.replace(/from(['"]|\[)/g, 'from: $1');
  
  // Also handle the specific case we're seeing in the error
  result = result.replace(/from'([^']+)'/g, "from: '$1'");
  
  // Fix missing colons in array transitions
  result = result.replace(/from\s*\[/g, 'from: [');
  
  // Fix missing commas in object literals
  result = result.replace(/}\s*\n\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '}, $1:');
  
  // Fix missing semicolons
  result = result.replace(/}\s*\n\s*\/\//g, '};\n//');
  
  // Fix missing parentheses in function calls
  result = result.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*{/g, '$1) => {');
  
  // Fix incomplete if statements
  result = result.replace(/if\s*\(\s*([^)]+)\s*\)\s*\{([^}]*)\}\s*;/g, 'if ($1) {$2}');
  
  // Fix missing closing braces in objects
  let openBraces = 0;
  let closeBraces = 0;
  for (const char of result) {
    if (char === '{') openBraces++;
    if (char === '}') closeBraces++;
  }
  
  // Add missing closing braces if needed
  if (openBraces > closeBraces) {
    const missingBraces = openBraces - closeBraces;
    result += '\n' + '}'.repeat(missingBraces);
  }
  
  return result;
}

/**
 * Transform ESM code to be compatible with our sandbox
 * @param content The original ESM code
 * @returns Transformed code that works in our sandbox
 */
function transformESMCode(content: string): string {
  return content
    // Remove import statements for ReactiveSystem, Process, and Task (they're global)
    .replace(/import\s+\{\s*ReactiveSystem\s*\}\s+from\s+['"].*['"]\s*;?/g, '// ReactiveSystem is globally available')
    .replace(/import\s+\{\s*Process\s*\}\s+from\s+['"].*['"]\s*;?/g, '// Process is globally available')
    .replace(/import\s+\{\s*Task\s*\}\s+from\s+['"].*['"]\s*;?/g, '// Task is globally available')
    
    // Transform relative imports to use our sandbox import function
    .replace(/import\s+(\w+)\s+from\s+(['"])([\.\/][^'"]+)(['"])\s*;?/g, 'const $1 = import($2$3$4);')
    .replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+(['"])([\.\/][^'"]+)(['"])\s*;?/g, (_, imports, q1, path, q2) => {
      const importNames = imports.split(',').map((i: string) => i.trim());
      const importObj = `import(${q1}${path}${q2})`;
      return importNames.map((name: string) => `const ${name} = ${importObj}.${name};`).join('\n');
    })
    
    // Transform named exports
    .replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 =')
    .replace(/export\s+function\s+(\w+)/g, 'function $1')
    .replace(/export\s+class\s+(\w+)/g, 'class $1')
    
    // Transform export statements at the end of the file
    .replace(/export\s+\{\s*([^}]+)\s*\};/g, (_, exports) => {
      const exportNames = exports.split(',').map((e: string) => e.trim());
      return exportNames.map((name: string) => `__exports.${name} = ${name};`).join('\n');
    })
    
    // Transform default exports
    .replace(/export\s+default\s+(\w+);?/g, '__exports.default = $1;')
    
    // Handle module.exports (for backward compatibility)
    .replace(/module\.exports\s*=\s*\{([^}]+)\}/g, (_, exports) => {
      const exportPairs = exports.split(',').map((e: string) => e.trim());
      return exportPairs.map((pair: string) => {
        const [name, value] = pair.split(':').map(p => p.trim());
        return `__exports.${name} = ${value || name};`;
      }).join('\n');
    });
}

/**
 * Execute a DSL file in the sandbox environment
 * @param filePath Path to the DSL file
 * @returns The exports from the DSL file
 */
export function executeDSLFile<T = any>(filePath: string): T {
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Directly fix the specific syntax error we're seeing
    // This regex specifically targets the pattern "from'" without a colon
    let fixedContent = content.replace(/from'([^']+)'/g, "from: '$1'");
    // Also fix the pattern "from[" without a colon
    fixedContent = fixedContent.replace(/from\[/g, "from: [");
    
    // Preprocess the code to fix common syntax issues
    const preprocessedContent = preprocessCode(fixedContent);
    
    // Transform ESM code to be compatible with our sandbox
    let transformedContent = transformESMCode(preprocessedContent);
    
    // Remove TypeScript type annotations
    transformedContent = removeTypeAnnotations(transformedContent);
    
    // Fix any issues with the metadata
    transformedContent = transformedContent.replace(/tags'([^']+)'/g, "tags: ['$1'");
    
    // Create the sandbox context
    const context = createSandboxContext(filePath);
    
    // Create a VM context with the sandbox context
    const vmContext = vm.createContext(context);
    
    try {
      // Execute the script in the VM context
      vm.runInContext(transformedContent, vmContext);
      
      // Get the exports
      const result = context.__exports;
      
      // Reset global DSL objects
      resetGlobalDSL();
      
      return result as T;
    } catch (error) {
      // Reset global DSL objects even if there's an error
      resetGlobalDSL();
      
      console.error(`Error executing DSL file ${filePath}:`, error);
      console.error(`Transformed content:\n${transformedContent}`);
      throw error;
    }
  } catch (error) {
    console.error(`Error executing DSL file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Load a DSL file and execute it in the sandbox environment
 * @param filePath Path to the DSL file
 * @returns The exports from the DSL file
 */
export function loadDSLFile<T = any>(filePath: string): T {
  try {
    return executeDSLFile<T>(filePath);
  } catch (error) {
    console.error(`Error loading DSL file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Load all DSL files in a directory
 * @param directoryPath Path to the directory containing DSL files
 * @returns An object with file names as keys and exports as values
 */
export function loadDSLDirectory<T = any>(directoryPath: string): Record<string, T> {
  const result: Record<string, T> = {};
  
  // Get all .ts files in the directory
  const files = fs.readdirSync(directoryPath)
    .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
  
  // Load each file
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const fileName = path.basename(file, '.ts');
    try {
      result[fileName] = loadDSLFile<T>(filePath);
    } catch (error) {
      console.error(`Error loading DSL file ${filePath}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return result;
} 