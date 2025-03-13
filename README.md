# ArchitectLM

ArchitectLM is a TypeScript framework for building reactive systems with state machines, tasks, and event-driven architecture.

## Features

- **State Machine Processes**: Define processes with states, transitions, and guards
- **Asynchronous Tasks**: Define tasks with implementation, validation, and error handling
- **Event-Driven Architecture**: Built-in event bus for communication between components
- **Type Safety**: Strong TypeScript typing throughout the framework
- **Validation**: Schema validation using Zod
- **Fluent API**: Builder pattern for defining components
- **Testing Utilities**: Comprehensive testing tools for verifying system behavior

## Installation

```bash
npm install architectlm
# or
yarn add architectlm
# or
pnpm add architectlm
```

## Quick Start

```typescript
import { Process, Task, System, createRuntime } from 'architectlm';
import { z } from 'zod';

// Define a process
const orderProcess = Process.create('order-process')
  .withDescription('Handles order processing')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('cancelled')
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING'
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE'
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .build();

// Define a task
const processOrderTask = Task.create('process-order')
  .withDescription('Processes an order')
  .withImplementation(async (input, context) => {
    // Process the order
    context.emitEvent('COMPLETE', { orderId: input.orderId });
    return { processed: true };
  })
  .build();

// Define a system
const ecommerceSystem = System.create('ecommerce')
  .withDescription('E-commerce system')
  .addProcess(orderProcess)
  .addTask(processOrderTask)
  .build();

// Create a runtime and use it
const runtime = createRuntime(ecommerceSystem);
const instance = runtime.createProcess('order-process', { orderId: '12345' });
await runtime.executeTask('process-order', { orderId: '12345' });
```

## API Reference

### Process API

```typescript
// Create a process
const process = Process.create('process-id')
  .withDescription('Process description')
  .withInitialState('initial-state')
  .addState('state-name', {
    description: 'State description',
    onEnter: async (context) => { /* ... */ },
    onExit: async (context) => { /* ... */ }
  })
  .addTransition({
    from: 'source-state',
    to: 'target-state',
    on: 'EVENT_TYPE',
    guard: (context, event) => boolean,
    action: async (context, event) => { /* ... */ }
  })
  .withContextSchema(z.object({ /* ... */ }))
  .build();
```

### Task API

```typescript
// Create a task
const task = Task.create('task-id')
  .withDescription('Task description')
  .withImplementation(async (input, context) => {
    // Implementation
    return { /* result */ };
  })
  .withInputSchema(z.object({ /* ... */ }))
  .withOutputSchema(z.object({ /* ... */ }))
  .withErrorHandler(async (error, input, context) => {
    // Handle error
  })
  .withSuccessHandler(async (result, input, context) => {
    // Handle success
  })
  .withTimeout(5000) // 5 seconds
  .withRetry({
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000
  })
  .build();
```

### System API

```typescript
// Create a system
const system = System.create('system-id')
  .withName('System Name')
  .withDescription('System description')
  .addProcess(process)
  .addTask(task)
  .withObservability({
    metrics: true,
    tracing: {
      provider: 'opentelemetry',
      exporters: ['jaeger']
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  })
  .build();
```

### Testing API

```typescript
// Create a test
const test = Test.create('test-name')
  .withDescription('Test description')
  .withSystem(system)
  .createProcess('process-id', { /* input */ })
  .executeTask('task-id', { /* input */ })
  .verifyState('expected-state')
  .expectFinalState('final-state')
  .expectEvents(['EVENT_1', 'EVENT_2'])
  .build();
```

## Examples

See the [examples](./examples) directory for more examples of how to use ArchitectLM.

## License

MIT 