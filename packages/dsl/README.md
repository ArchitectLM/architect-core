# @architectlm/dsl

Domain-Specific Language for the ArchitectLM framework.

## Features

- Reactive System DSL for defining processes and tasks
- Plugin system for extending functionality
- DSL Registry for managing DSL components
- DSL Sandbox for safe execution of DSL code
- Global DSL for defining global components
- Runtime for executing DSL code

## Usage

### Reactive System DSL

```typescript
import { ReactiveSystem } from '@architectlm/dsl';

// Define a process using the DSL
const orderProcess = ReactiveSystem.Process.create('order-process')
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
```

### Plugin System

```typescript
import { Plugin } from '@architectlm/dsl';

// Create a plugin
const loggingPlugin = Plugin.create('logging-plugin')
  .withName('Logging Plugin')
  .withDescription('Provides logging functionality')
  .withInitializer((runtime) => {
    return {
      logger: {
        log: (message) => console.log(`[LOG] ${message}`),
        error: (message) => console.error(`[ERROR] ${message}`)
      }
    };
  })
  .build();

// Use the plugin
const runtime = createRuntime(
  { /* processes */ },
  { /* tasks */ },
  { /* options */ },
  [loggingPlugin]
);

// Get the logger service
const logger = runtime.getService('logging-plugin', 'logger');
logger.log('Hello, world!');
``` 