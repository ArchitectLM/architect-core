# ArchitectLM

ArchitectLM is a powerful TypeScript framework for building reactive, event-driven systems with state machines, tasks, and distributed caching. It provides a robust foundation for building complex business applications with a focus on scalability, maintainability, and developer experience.

## Core Features

- **State Machine Processes**: Define processes with states, transitions, and guards
- **Asynchronous Tasks**: Define tasks with implementation, validation, and error handling
- **Event-Driven Architecture**: Built-in event bus for communication between components
- **Distributed Caching**: Support for local and distributed caching with configurable TTL
- **Reactive Runtime**: Efficient execution of processes and tasks with event propagation
- **Type Safety**: Strong TypeScript typing throughout the framework
- **Validation**: Schema validation using Zod
- **Fluent API**: Builder pattern for defining components
- **Plugin System**: Extensible architecture with plugin support
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

## Technical Architecture

ArchitectLM is built on a modular architecture with several key components:

### Core Components

1. **ReactiveRuntime**: The central execution engine that manages processes and tasks
2. **ProcessManager**: Handles process creation, state transitions, and context management
3. **TaskManager**: Manages task execution, retries, timeouts, and middleware
4. **EventBus**: Provides event-driven communication between components
5. **Cache**: Optimizes performance with local and distributed caching

### Caching System

The framework includes a sophisticated caching system with:

- **Local Caching**: LRU cache for process instances and task results
- **Distributed Caching**: Support for sharing cache data across multiple runtime instances
- **TTL Support**: Time-to-live configuration for cached items
- **Cache Statistics**: Metrics for cache hits, misses, and hit ratios
- **Fallback Mechanism**: Graceful degradation to local cache when distributed cache fails

### Error Handling

Robust error handling is built into the framework:

- **Task Retries**: Configurable retry policies with backoff strategies
- **Error Middleware**: Pre and post-execution middleware for error handling
- **Timeout Management**: Configurable timeouts for long-running tasks
- **Circuit Breaker**: Protection against cascading failures in distributed systems
- **Graceful Degradation**: Fallback mechanisms for distributed components

### Extensibility

The framework is designed to be extensible:

- **Plugin System**: Register plugins to extend functionality
- **Service Integration**: Connect to external services with built-in circuit breaker
- **Custom Middleware**: Add custom middleware for tasks and processes
- **Event Hooks**: Subscribe to system events for custom handling

## Technical Strengths

### For Technical Teams

1. **Type Safety**: Strong TypeScript typing reduces runtime errors and improves developer experience
2. **Testability**: Comprehensive testing utilities for unit and integration testing
3. **Performance**: Optimized execution with caching and efficient event propagation
4. **Scalability**: Distributed caching and stateless design enable horizontal scaling
5. **Observability**: Built-in metrics, logging, and tracing for monitoring and debugging
6. **Extensibility**: Plugin system and middleware support for custom extensions

### For Non-Technical Users

1. **Domain-Driven Design**: Model business processes directly as state machines
2. **Visual Representation**: State machines can be visualized as diagrams
3. **Business Logic Isolation**: Separate business logic from technical implementation
4. **Audit Trail**: Event-driven architecture provides a natural audit trail
5. **Versioning**: Support for versioning processes and tasks

### For LLM Agents and DSL Generation

1. **Declarative API**: Easy to generate code with clear patterns
2. **Consistent Structure**: Predictable code structure for LLM generation
3. **Type Definitions**: Clear type definitions for code completion and validation
4. **RAG Enhancement**: Retrieval-augmented generation for context-aware assistance
5. **Example-Based Learning**: Rich examples for LLM to learn from

### Scaling Capabilities

1. **Horizontal Scaling**: Stateless design allows for multiple runtime instances
2. **Distributed Caching**: Share cache data across multiple instances
3. **Event-Driven Architecture**: Loose coupling enables independent scaling of components
4. **Asynchronous Processing**: Non-blocking execution for efficient resource utilization
5. **Configurable Resource Limits**: Control memory and CPU usage with cache size limits

## Use Cases

ArchitectLM is well-suited for a variety of applications:

- **Business Process Automation**: Order processing, approval workflows, document management
- **E-commerce Systems**: Order management, inventory control, payment processing
- **Financial Applications**: Transaction processing, fraud detection, compliance workflows
- **Healthcare Systems**: Patient workflows, insurance claims processing
- **IoT Applications**: Device state management, event processing, data aggregation
- **Customer Service**: Ticket management, escalation workflows, SLA tracking

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

### Runtime API

```typescript
// Create a runtime
const runtime = createRuntime(
  { 'process-id': processDefinition },
  { 'task-id': taskDefinition },
  {
    caching: {
      enabled: true,
      processCache: {
        maxSize: 100
      },
      taskResultCache: {
        maxSize: 50,
        ttl: 60000 // 1 minute
      },
      distributed: {
        enabled: true,
        provider: new RedisDistributedCacheProvider({
          host: 'localhost',
          port: 6379
        }),
        instanceId: 'runtime-1'
      }
    },
    logger: customLogger,
    metrics: customMetricsCollector
  }
);

// Create a process instance
const instance = runtime.createProcess('process-id', { /* context */ });

// Transition a process
runtime.transitionProcess(instance.id, 'EVENT_TYPE', { /* payload */ });

// Execute a task
const result = await runtime.executeTask('task-id', { /* input */ }, { /* context */ }, { /* options */ });

// Subscribe to events
const subscription = runtime.subscribe('EVENT_TYPE', (event) => {
  // Handle event
});

// Unsubscribe from events
runtime.unsubscribe(subscription);

// Get cache statistics
const stats = runtime.getCacheStats();
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

### Plugin API

```typescript
// Create a plugin
const plugin = Plugin.create('plugin-id')
  .withName('Plugin Name')
  .withDescription('Plugin description')
  .withInitializer((runtime) => {
    // Initialize plugin
    return {
      // Plugin services
      myService: {
        doSomething: () => { /* ... */ }
      }
    };
  })
  .build();

// Create a runtime with plugins
const runtime = createRuntime(
  { /* processes */ },
  { /* tasks */ },
  { /* options */ },
  [plugin]
);

// Get a plugin service
const myService = runtime.getService('plugin-id', 'myService');
```

## Advanced Features

### Distributed Caching

ArchitectLM supports distributed caching to enable horizontal scaling:

```typescript
// Create a Redis distributed cache provider
const redisProvider = new RedisDistributedCacheProvider({
  host: 'localhost',
  port: 6379,
  prefix: 'app:cache'
});

// Create a runtime with distributed caching
const runtime = createRuntime(
  { /* processes */ },
  { /* tasks */ },
  {
    caching: {
      enabled: true,
      processCache: {
        maxSize: 100
      },
      taskResultCache: {
        maxSize: 50,
        ttl: 60000 // 1 minute
      },
      distributed: {
        enabled: true,
        provider: redisProvider,
        instanceId: 'runtime-1'
      }
    }
  }
);
```

### Service Integration

Connect to external services with built-in circuit breaker:

```typescript
// Create a service integration
const paymentService = ServiceIntegration.create('payment-service')
  .withBaseUrl('https://api.payment.com')
  .withCircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000
  })
  .withRetry({
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000
  })
  .withOperation('processPayment', {
    method: 'POST',
    path: '/payments',
    timeout: 5000
  })
  .build();

// Register the service with the runtime
runtime.registerService('payment-service', paymentService);

// Use the service
const paymentResult = await runtime.getService('payment-service').processPayment({
  orderId: '12345',
  amount: 99.99,
  currency: 'USD'
});
```

### AI-Assisted Development

Generate components using LLMs:

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
```

### RAG-Enhanced Generation

Use retrieval-augmented generation for context-aware assistance:

```typescript
// Create a RAG-enhanced agent
import { createRAGAgent } from 'architectlm/extensions';
import * as path from 'path';

const ragAgent = createRAGAgent({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  codebasePath: path.join(__dirname, 'src'),
  useInMemoryVectorStore: true
});

// Initialize the agent with your runtime
await ragAgent.initialize(runtime);

// Generate a process with RAG enhancement
const processDefinition = await ragAgent.generateProcess(processSpec);
```

## Limitations and Considerations

While ArchitectLM is powerful, there are some limitations to consider:

1. **Eventual Consistency**: Distributed caching relies on eventual consistency
2. **Learning Curve**: The framework has a learning curve for complex features
3. **External Dependencies**: Some features require external services (Redis, etc.)
4. **Memory Usage**: Large caches can consume significant memory
5. **Serialization**: All cached data must be serializable

## Future Improvements

We're continuously improving ArchitectLM. Here are some planned enhancements:

1. **Persistent Storage**: Built-in support for persisting processes and events
2. **Workflow Visualization**: Visual editor for processes and workflows
3. **Metrics Dashboard**: Web-based dashboard for monitoring and analytics
4. **Multi-Tenancy**: Support for multi-tenant applications
5. **Schema Evolution**: Versioning and migration of process and task schemas
6. **Distributed Tracing**: Enhanced tracing across multiple runtime instances
7. **Serverless Deployment**: Optimizations for serverless environments
8. **Real-time Collaboration**: Support for collaborative workflows
9. **Advanced Scheduling**: Time-based and cron-like scheduling of tasks
10. **Compliance Features**: Audit logging and compliance reporting

## Examples

See the [examples](./examples) directory for more examples of how to use ArchitectLM.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT 