# architectlm

An architecture for building LLM-powered applications.

This is the main package that re-exports all functionality from the individual packages:

- [@architectlm/core](../core/README.md): Core components of the framework
- [@architectlm/extensions](../extensions/README.md): Extensions for the framework
- [@architectlm/dsl](../dsl/README.md): Domain-Specific Language for the framework
- [@architectlm/cli](../cli/README.md): Command-line tools for the framework

## Installation

```bash
npm install architectlm
# or
yarn add architectlm
# or
pnpm add architectlm
```

## Usage

```typescript
import { Process, Task, System, createRuntime } from 'architectlm';

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

// Create a runtime and use it
const runtime = createRuntime({ 'order-process': orderProcess }, { 'process-order': processOrderTask });
const instance = runtime.createProcess('order-process', { orderId: '12345' });
await runtime.executeTask('process-order', { orderId: '12345' });
```

## Documentation

For more detailed documentation, see the README files for each individual package:

- [Core](../core/README.md)
- [Extensions](../extensions/README.md)
- [DSL](../dsl/README.md)
- [CLI](../cli/README.md)
- [Examples](../examples/README.md) 