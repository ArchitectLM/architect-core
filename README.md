# ArchitectLM

An architecture for building LLM-powered applications with a focus on event-driven workflows, processes, and tasks.

## Overview

ArchitectLM provides a flexible, event-driven architecture for building applications that leverage Large Language Models (LLMs). It is designed to be simple, extensible, and focused on developer experience.

The core components of ArchitectLM include:

- **Event Bus**: A reactive event bus for asynchronous communication between components
- **Process Engine**: Define processes with states and transitions
- **Task Executor**: Define tasks with implementations that can be executed
- **System**: Combine processes and tasks into a complete system
- **Runtime**: Integrate all components and provide execution capabilities

## Installation

```bash
# Using pnpm (recommended)
pnpm install

# Using npm
npm install

# Using yarn
yarn install
```

## Usage

### Defining a Process

```typescript
import { defineProcess } from 'architectlm';

const orderProcess = defineProcess({
  id: 'order-process',
  states: ['created', 'processing', 'completed', 'cancelled'],
  initialState: 'created',
  transitions: [
    { from: 'created', to: 'processing', on: 'START_PROCESSING' },
    { from: 'processing', to: 'completed', on: 'COMPLETE' },
    { from: 'processing', to: 'cancelled', on: 'CANCEL' },
    { from: 'created', to: 'cancelled', on: 'CANCEL' }
  ],
  description: 'Order processing workflow'
});
```

### Defining a Task

```typescript
import { defineTask } from 'architectlm';

const processOrderTask = defineTask({
  id: 'process-order',
  implementation: async (input, context) => {
    // Process the order
    const result = { processed: true, orderId: input.orderId };
    
    // Emit an event to trigger a process transition
    context.emitEvent('COMPLETE', { orderId: input.orderId });
    
    return result;
  }
});
```

### Creating a System

```typescript
import { defineSystem } from 'architectlm';

const system = defineSystem({
  id: 'order-system',
  description: 'Order processing system',
  processes: {
    'order-process': orderProcess
  },
  tasks: {
    'process-order': processOrderTask
  }
});
```

### Using the Runtime

```typescript
import { createRuntime } from 'architectlm';

// Create a runtime with processes and tasks
const runtime = createRuntime(
  { 'order-process': orderProcess },
  { 'process-order': processOrderTask }
);

// Create a process instance
const instance = runtime.createProcess('order-process', { orderId: '12345' });

// Transition the process
runtime.transitionProcess(instance.id, 'START_PROCESSING');

// Execute a task
const result = await runtime.executeTask('process-order', { orderId: '12345' });

// Subscribe to events
runtime.subscribeToEvent('COMPLETE', (event) => {
  console.log('Order completed:', event.payload.orderId);
});
```

## Development

### Running Tests

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui
```

### Building

```bash
# Build the project
pnpm build
```

## License

MIT 