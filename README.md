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
- **AI-Assisted Development**: Agent mode for generating components using LLMs
- **RAG-Enhanced Generation**: Retrieval-augmented generation for context-aware AI assistance

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

### Agent API

```typescript
// Create an agent
import { createAgent } from 'architectlm/extensions';

const agent = createAgent({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7
});

// Generate a process
const processSpec = {
  name: 'OrderProcess',
  description: 'Manages the lifecycle of customer orders',
  states: ['created', 'paid', 'shipped', 'delivered', 'cancelled'],
  events: ['CREATE_ORDER', 'PAYMENT_RECEIVED', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
};

const processDefinition = await agent.generateProcess(processSpec);

// Generate a task
const taskSpec = {
  name: 'ProcessPayment',
  description: 'Processes a payment for an order',
  input: {
    orderId: 'string',
    amount: 'number',
    paymentMethod: 'string'
  },
  output: {
    success: 'boolean',
    transactionId: 'string'
  }
};

const taskDefinition = await agent.generateTask(taskSpec);

// Generate documentation
const docs = await agent.generateDocs(processDefinition);
```

### RAG-Enhanced Agent API

```typescript
// Create a RAG-enhanced agent
import { createRAGAgent } from 'architectlm/extensions';
import * as path from 'path';

const ragAgent = createRAGAgent({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  codebasePath: path.join(__dirname, 'src'), // Path to your codebase
  useInMemoryVectorStore: true // Use in-memory vector store for development
});

// Initialize the agent with your runtime
await ragAgent.initialize(runtime);

// Generate a process with RAG enhancement
const processSpec = {
  name: 'OrderProcess',
  description: 'Manages the lifecycle of customer orders',
  states: ['created', 'paid', 'shipped', 'delivered', 'cancelled'],
  events: ['CREATE_ORDER', 'PAYMENT_RECEIVED', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
};

// The agent will retrieve relevant examples from your codebase
// to enhance the generation process
const processDefinition = await ragAgent.generateProcess(processSpec);

// Generate a task with RAG enhancement
const taskSpec = {
  name: 'ProcessPayment',
  description: 'Processes a payment for an order',
  input: {
    orderId: 'string',
    amount: 'number',
    paymentMethod: 'string'
  },
  output: {
    success: 'boolean',
    transactionId: 'string'
  }
};

const taskDefinition = await ragAgent.generateTask(taskSpec);

// Generate tests with RAG enhancement
const tests = await ragAgent.generateTests(processDefinition);

// Generate documentation with RAG enhancement
const docs = await ragAgent.generateDocs(processDefinition);
```

## Using Different Models with the RAG-Enhanced Agent

The RAG-enhanced agent supports various LLM providers and models. Here's a comparison of using different models:

### OpenAI GPT-3.5 Turbo

```typescript
const ragAgent = createRAGAgent({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  codebasePath: './src',
  useInMemoryVectorStore: true,
});
```

GPT-3.5 Turbo provides good results for most use cases, with reliable JSON generation and documentation capabilities.

### Meta's Llama 3.2 1B Instruct (via OpenRouter)

```typescript
const ragAgent = createRAGAgent({
  provider: 'custom',
  model: 'meta-llama/llama-3.2-1b-instruct:free',
  apiKey: 'your-openrouter-api-key',
  temperature: 0.7,
  codebasePath: './src',
  useInMemoryVectorStore: true,
});

// Override the LLM with a custom OpenRouter implementation
(ragAgent as any).llm = new OpenRouterChatModel({
  apiKey: 'your-openrouter-api-key',
  model: 'meta-llama/llama-3.2-1b-instruct:free',
  temperature: 0.7,
});
```

Llama 3.2 1B Instruct is a lightweight model that can run on less powerful hardware. It provides decent results for process and test generation, but may require additional handling for JSON parsing and task generation.

### Choosing the Right Model

- **GPT-4/GPT-3.5 Turbo**: Best for production use cases where reliability and quality are important.
- **Llama 3.2 1B Instruct**: Good for development, testing, or when running on resource-constrained environments.
- **Custom Models**: You can implement your own chat model interface to use any LLM provider.

## Examples

See the [examples](./examples) directory for more examples of how to use ArchitectLM.

## License

MIT 