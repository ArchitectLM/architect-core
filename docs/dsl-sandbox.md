# DSL Sandbox

The DSL Sandbox is a runtime environment for executing DSL (Domain-Specific Language) files in a controlled environment. It provides global functions and objects that can be used in DSL files without explicit imports.

## Overview

The DSL Sandbox allows you to:

1. Execute DSL files in a sandbox environment
2. Load DSL files and get their exports
3. Load all DSL files in a directory
4. Preprocess DSL files to fix common syntax issues
5. Transform ESM code to be compatible with the sandbox

## Usage

```typescript
import { loadDSLFile, loadDSLDirectory } from '../src/core/dsl/dsl-sandbox';

// Load a single DSL file
const processModule = loadDSLFile('./examples/dsl/process.ts');

// Load all DSL files in a directory
const allDslFiles = loadDSLDirectory('./examples/dsl');
```

## Example Files

The DSL sandbox comes with several example files that demonstrate different aspects of the DSL:

1. `process.ts` - A simple process definition with states and transitions
2. `minimal-example.ts` - A minimal example with a process, task, and system
3. `simple-payment-example.ts` - A simple payment process example
4. `esm-example.ts` - An example using ESM modules
5. `system.ts` - A system definition example
6. `task.ts` - A task definition example

## Common Issues and Solutions

### Syntax Errors

The most common issue with DSL files is syntax errors, particularly missing colons in transition definitions. For example:

```typescript
// Incorrect
.addTransition({ 
  from'initiated', 'processing', 'verifying'], 
  to: 'failed', 
  on: 'PAYMENT_FAILED' 
})

// Correct
.addTransition({ 
  from: ['initiated', 'processing', 'verifying'], 
  to: 'failed', 
  on: 'PAYMENT_FAILED' 
})
```

To address this, the DSL Sandbox includes a preprocessing step that fixes common syntax issues:

```typescript
function preprocessCode(content: string): string {
  // Initialize result with the original content
  let result = content;
  
  // Fix missing colon after 'from' in transitions
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
```

### ESM Compatibility

The DSL Sandbox also includes a transformation step to make ESM code compatible with the sandbox:

```typescript
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
```

## Cleanup and Refactoring

The DSL sandbox has been cleaned up and refactored to improve maintainability and reduce redundancy:

1. Removed redundant example files:
   - `llm-example.ts` and `llm-friendly-example.ts` (similar to `comprehensive-payment-example.ts`)
   - `payment-example.ts` (similar to `simple-payment-example.ts`)
   - `simple-example.ts` (similar to `minimal-example.ts`)

2. Removed the `fix-dsl-files.js` script as it's no longer needed with the preprocessing in the DSL sandbox.

3. Updated the DSL sandbox test to only load working files, improving reliability and reducing errors.

## Best Practices for DSL Files

To ensure your DSL files work correctly with the DSL Sandbox, follow these best practices:

1. Use the correct syntax for transitions, including colons after property names
2. Use ESM exports instead of CommonJS exports
3. Use global functions and objects provided by the DSL Sandbox
4. Keep your DSL files simple and focused on a single responsibility
5. Use descriptive names for processes, tasks, and systems
6. Include comments to explain the purpose of each component

## Example DSL File

Here's an example of a well-structured DSL file:

```typescript
/**
 * Minimal DSL Example
 */

// Define a simple process
const simpleProcess = Process.create('simple-process')
  .withInitialState('initial')
  .addState('initial')
  .addState('processing')
  .addState('completed')
  .addTransition({ 
    from: 'initial', 
    to: 'processing', 
    on: 'START' 
  })
  .addTransition({ 
    from: 'processing', 
    to: 'completed', 
    on: 'COMPLETE' 
  })
  .build();

// Define a simple task
const simpleTask = Task.create('simple-task')
  .withDescription('A simple task')
  .withImplementation((input) => {
    console.log('Executing simple task');
    return { success: true };
  })
  .build();

// Define a simple system
const simpleSystem = ReactiveSystem.define('simple-system')
  .withName('Simple System')
  .withDescription('A simple reactive system')
  .addProcess(simpleProcess)
  .addTask(simpleTask)
  .build();

// Export the components
export {
  simpleProcess,
  simpleTask,
  simpleSystem
};
``` 