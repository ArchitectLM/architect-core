# Runtime Core

The Runtime Core is a powerful framework for executing reactive systems defined using a Domain-Specific Language (DSL). It provides a robust foundation for building event-driven applications with complex workflows.

## Features

- **Reactive System Execution**: Execute systems defined using the DSL with full state management.
- **Flow Execution**: Define and execute complex flows with conditional logic, parallel execution, and error handling.
- **Task Management**: Register and execute tasks with retry, timeout, and error handling.
- **Event Handling**: Send and receive events to trigger state transitions and actions.
- **DSL Integration**: Seamlessly integrate with the DSL to load, validate, and save systems.
- **Code Generation**: Generate code for tasks and flows using LLMs.

## Architecture

The Runtime Core consists of the following components:

- **ReactiveSystemRuntime**: The main runtime engine that executes systems, processes, tasks, and flows.
- **DSL Integration**: Modules for loading, validating, and saving systems using the DSL.
- **Code Generation**: Modules for generating code for tasks and flows using LLMs.

## Usage

### Creating a Runtime

```typescript
import { ReactiveSystemRuntime } from '../runtime-core';
import { loadSystemFromDsl } from '../runtime-core';

// Load a system from a DSL file
const system = await loadSystemFromDsl('path/to/system.dsl.ts');

// Create a runtime
const runtime = new ReactiveSystemRuntime(system);
```

### Registering Task Implementations

```typescript
// Register a task implementation
runtime.registerTaskImplementation('taskId', async (input) => {
  // Task implementation
  return { result: 'success' };
});

// Register multiple task implementations
runtime.registerTaskImplementations({
  'task1': async (input) => ({ result: 'task1' }),
  'task2': async (input) => ({ result: 'task2' })
});
```

### Executing Tasks

```typescript
// Execute a task
const result = await runtime.executeTask('taskId', { data: 'input' });

console.log(result.success); // true
console.log(result.output); // { result: 'success' }
```

### Defining and Executing Flows

```typescript
import { FlowStepType } from '../runtime-core';

// Define a flow
const flow = {
  id: 'myFlow',
  name: 'My Flow',
  description: 'A sample flow',
  steps: [
    {
      id: 'step1',
      name: 'Step 1',
      type: FlowStepType.TASK,
      taskId: 'task1'
    },
    {
      id: 'step2',
      name: 'Step 2',
      type: FlowStepType.CONDITION,
      condition: (input, previousOutputs) => previousOutputs.step1.result === 'success',
      thenSteps: [
        {
          id: 'step3',
          name: 'Step 3',
          type: FlowStepType.TASK,
          taskId: 'task2'
        }
      ],
      elseSteps: [
        {
          id: 'step4',
          name: 'Step 4',
          type: FlowStepType.TASK,
          taskId: 'task3'
        }
      ]
    }
  ]
};

// Register the flow
runtime.registerFlow(flow);

// Execute the flow
const result = await runtime.executeFlow('myFlow', { data: 'input' });

console.log(result.success); // true
console.log(result.output); // Output of the last step
```

### Handling Events

```typescript
// Register an event handler
runtime.registerEventHandler('myEvent', (payload) => {
  console.log('Event received:', payload);
});

// Send an event
runtime.sendEvent('myEvent', { data: 'event data' });
```

### Generating Code

```typescript
import { CodeGenerator } from '../runtime-core';

// Create a code generator
const codeGenerator = new CodeGenerator();

// Generate code for a task
const taskCode = await codeGenerator.generateTaskCode(
  system.tasks['taskId'],
  system,
  {
    language: 'typescript',
    includeComments: true,
    includeTests: true,
    includeErrorHandling: true
  }
);

console.log(taskCode.code); // Generated code
console.log(taskCode.tests); // Generated tests
```

## Integration with DSL

The Runtime Core seamlessly integrates with the DSL to load, validate, and save systems:

```typescript
import {
  loadSystemFromDsl,
  migrateSystem,
  saveSystemToDsl,
  convertFlowToDsl,
  convertDslToFlow
} from '../runtime-core';

// Load a system from a DSL file
const system = await loadSystemFromDsl('path/to/system.dsl.ts');

// Migrate a system to a new version
const migratedSystem = migrateSystem(system, '2.0.0');

// Save a system to a DSL file
await saveSystemToDsl(system, 'path/to/output.dsl.ts');

// Convert a flow to DSL format
const dslFlow = convertFlowToDsl(flow);

// Convert a DSL flow to runtime format
const runtimeFlow = convertDslToFlow(dslFlow);
```

## Error Handling

The Runtime Core provides robust error handling capabilities:

- **Task Retries**: Tasks can be configured to retry on failure with backoff.
- **Timeouts**: Tasks can be configured with timeouts to prevent hanging.
- **Flow Error Handling**: Flows can be configured to continue execution on error.
- **Event-Based Error Handling**: Errors can be handled using events.

## Testing

The Runtime Core is designed to be easily testable:

```typescript
import { ReactiveSystemRuntime } from '../runtime-core';
import { vi } from 'vitest';

// Create a mock system
const mockSystem = {
  id: 'test-system',
  name: 'Test System',
  version: '1.0.0',
  // ...
};

// Create a runtime
const runtime = new ReactiveSystemRuntime(mockSystem);

// Register mock task implementations
const taskImpl = vi.fn().mockResolvedValue({ result: 'success' });
runtime.registerTaskImplementation('taskId', taskImpl);

// Execute a task
const result = await runtime.executeTask('taskId', { data: 'test' });

// Verify the result
expect(result.success).toBe(true);
expect(taskImpl).toHaveBeenCalledWith({ data: 'test' });
```

## Future Improvements

- **Enhanced Flow Visualization**: Visualize flows using a graphical interface.
- **Improved Code Generation**: Use more advanced LLMs for code generation.
- **Performance Optimizations**: Optimize the runtime for high-throughput scenarios.
- **Distributed Execution**: Support for distributed execution of tasks and flows.
- **Monitoring and Observability**: Enhanced monitoring and observability features. 