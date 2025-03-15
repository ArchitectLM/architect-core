# @architectlm/core

Core components of the ArchitectLM framework.

## Features

- Process management with state machines
- Task execution with validation and error handling
- Event-driven architecture with event bus
- Reactive runtime for process and task execution
- Caching system for improved performance
- Type-safe API with Zod validation

## Usage

```typescript
import { Process, Task, System, createRuntime } from '@architectlm/core';

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