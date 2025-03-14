# DSL Examples

This directory contains examples of Domain-Specific Language (DSL) files that can be executed in the DSL sandbox environment.

## Available Examples

- `process.ts` - A simple process definition with states and transitions
- `minimal-example.ts` - A minimal example with a process, task, and system
- `simple-payment-example.ts` - A simple payment process example
- `esm-example.ts` - An example using ESM modules
- `system.ts` - A system definition example
- `task.ts` - A task definition example

## Running Examples

You can run the DSL sandbox test to load and execute these examples:

```bash
npm run sandbox-dsl
```

This will execute the `examples/dsl-sandbox-test.ts` file, which loads and processes the DSL files.

## Creating Your Own DSL Files

To create your own DSL files, follow these best practices:

1. Use the correct syntax for transitions, including colons after property names
2. Use ESM exports instead of CommonJS exports
3. Use global functions and objects provided by the DSL Sandbox
4. Keep your DSL files simple and focused on a single responsibility
5. Use descriptive names for processes, tasks, and systems
6. Include comments to explain the purpose of each component

## Example Structure

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

## Common Issues

When creating DSL files, be aware of these common issues:

1. Missing colons in transition definitions:
   ```typescript
   // Incorrect
   .addTransition({ 
     from'initiated', 'processing'], // Missing colon
     to: 'failed', 
     on: 'PAYMENT_FAILED' 
   })

   // Correct
   .addTransition({ 
     from: ['initiated', 'processing'], 
     to: 'failed', 
     on: 'PAYMENT_FAILED' 
   })
   ```

2. Missing commas in object literals
3. Missing semicolons
4. Missing closing braces in objects

The DSL sandbox includes preprocessing to fix these common issues, but it's best to avoid them in the first place.

For more information, see the [DSL Sandbox documentation](../../docs/dsl-sandbox.md). 