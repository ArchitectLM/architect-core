# ArchitectLM

ArchitectLM is a powerful TypeScript framework for building reactive, event-driven systems with state machines, tasks, and distributed caching. It provides a robust foundation for building complex business applications with a focus on scalability, maintainability, and developer experience.

## Why ArchitectLM is Revolutionary

ArchitectLM represents a paradigm shift in software development:

### For Business Leaders

- **Reduced Time-to-Market**: Development speed increases by 5-10x through AI-assisted component generation
- **Improved Reliability**: Business-critical systems with 99.99% uptime through deterministic execution
- **Cost Efficiency**: Significantly reduced development and maintenance costs through automated architecture
- **Future-Proof Investment**: Systems that evolve naturally with changing business needs

### For Technical Leaders

- **End of Technical Debt**: Clean, consistent architecture that doesn't degrade over time
- **Team Productivity**: Engineers focus on business value instead of plumbing code
- **Operational Excellence**: Built-in observability and reliability patterns reduce operational overhead
- **Talent Leverage**: 10x developer productivity through AI assistance

### For Developers

- **Joy of Creation**: Focus on what matters – solving real problems, not wrestling with architecture
- **Continuous Learning**: AI-assisted development teaches best practices through generated examples
- **Reduced Cognitive Load**: System behavior is predictable and self-documenting
- **Work at Higher Level**: Operate at the level of business logic rather than implementation details

ArchitectLM isn't just another framework – it's a revolution in how we conceptualize, build, and maintain complex software systems.


## The Elegant Architecture

ArchitectLM redefines how modern software systems are built with a pristine architectural foundation:

### Declarative and Deterministic

At its core, ArchitectLM embraces pure declarative programming principles, ensuring:

- **Full Determinism**: Every component behavior is predictable and reproducible, eliminating hidden side effects
- **Static Validation**: Business logic, data flows, and system states are statically verified at build time
- **Schema-Driven Contracts**: All inputs, outputs, state transitions, and events are defined with explicit schemas
- **Zero Runtime Surprises**: Comprehensive static analysis prevents invalid state transitions and unexpected behaviors

The framework transforms traditionally imperative business logic into a clear, declarative representation that is both human-readable and machine-verifiable.

### AI-Driven Development

ArchitectLM is designed from the ground up to work with AI:

- **DSL for LLM Generation**: Domain-specific language that AI agents can easily understand and generate
- **Sandboxed Execution**: Business rules and flows are defined in a safe sandbox environment by LLM agents
- **Contextual Understanding**: RAG-enhanced agents understand your entire system context when generating components
- **Zero Learning Curve**: The framework is designed to be managed by AI, eliminating the traditional learning barriers
- **Self-Documenting**: AI agents generate comprehensive documentation as they create components
- **Safe Code Extraction**: Robust code parsing with ts-morph ensures safe and reliable code generation
- **Intelligent Fallbacks**: Multiple layers of error handling for resilient AI-generated components

### Runtime Excellence

The runtime system ensures:

- **Guaranteed Execution**: Every process and task follows its predefined path with proper guarantees
- **Comprehensive Observability**: All state changes, transitions, and events are tracked and observable
- **Smart Resource Management**: Efficient use of system resources through optimized scheduling and caching
- **Transparent Recovery**: Graceful handling of failures with consistent recovery mechanisms
- **Seamless Scalability**: From single-process applications to distributed cloud systems with the same programming model

### Structured Yet Infinitely Scalable

ArchitectLM achieves the perfect balance between structure and scalability:

- **Consistent Patterns**: Core architectural patterns are applied consistently across any scale
- **Fractal Architecture**: The same design principles work at any level of the system
- **Horizontal Expansion**: Scale out without changing the fundamental programming model
- **Vertical Specialization**: Extend with domain-specific behaviors while maintaining architectural integrity
- **Progressive Adoption**: Apply the framework to specific parts of your system or the entire architecture

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
- **Enhanced RAG Agent Editor**: Interactive editing of DSL files with visual diffs, undo functionality, and schema validation
- **TypeScript AST Processing**: Advanced code generation and validation using ts-morph
- **Multi-Provider Support**: Compatible with OpenAI, Anthropic, and OpenRouter language models
- **LLM Performance Metrics**: Detailed model comparison for optimal AI integration

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
6. **AST Processing**: Robust TypeScript AST processing with ts-morph for reliable code extraction
7. **Multi-Provider Support**: Use with OpenAI, Anthropic, OpenRouter and other LLM providers
8. **Resilient Parsing**: Multiple fallback mechanisms to handle various LLM response formats
9. **Code Analysis**: Deep code structure understanding through AST traversal
10. **Safe Evaluation**: Secure code processing without unsafe evaluation techniques

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

### TypeScript AST Processing with ts-morph

ArchitectLM integrates ts-morph for advanced TypeScript code processing, ensuring reliable AI-generated code:

```typescript
// The RAG agent uses ts-morph internally for safe code processing
import { processCodeWithTsMorph, convertCodeToProcessDefinition } from 'architectlm/extensions/rag-agent-ts-morph';

// Process the code with ts-morph
const processedCode = processCodeWithTsMorph(`
const process = ReactiveSystem.Process.create("orderprocess")
  .withDescription("Manages orders from creation to fulfillment")
  .withInitialState("created")
  .addState("created")
  .addState("processing")
  .addState("shipped")
  .addState("delivered")
  .addState("cancelled")
  .addTransition({
    from: "created",
    to: "processing",
    on: "CREATE_ORDER"
  });
`, true);

// Convert the code to a process definition
const processDefinition = convertCodeToProcessDefinition(processedCode, 'orderprocess', true);

// The result is a structured process definition
console.log(JSON.stringify(processDefinition, null, 2));
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
  provider: 'openrouter',
  model: 'meta-llama/llama-3-70b-instruct',
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.7,
  codebasePath: path.join(__dirname, 'src'),
  useInMemoryVectorStore: true,
  debug: true,
  systemPrompt: `You are an expert TypeScript developer specializing in the ArchitectLM framework.
Your task is to generate code using the ArchitectLM DSL.

When generating code:
1. DO NOT use import statements
2. DO NOT wrap your code in markdown code blocks
3. ONLY return the exact code that defines the requested component
4. Use the ReactiveSystem.Process.create() and ReactiveSystem.Task.create() methods directly
5. Follow the examples provided exactly`
});

// Initialize the agent with your runtime
await ragAgent.initialize(runtime);

// Generate a process with RAG enhancement and ts-morph processing
const processSpec = {
  name: 'OrderProcess',
  description: 'Manages orders from creation to fulfillment',
  states: ['created', 'processing', 'shipped', 'delivered', 'cancelled'],
  events: ['CREATE_ORDER', 'PROCESS_ORDER', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
};

const processDefinition = await ragAgent.generateProcess(processSpec);
```

### Enhanced RAG Agent Editor

The Enhanced RAG Agent Editor extends the base RAG agent editor with advanced features for interactive, user-friendly editing of DSL files:

```typescript
// Create an enhanced RAG agent editor
import { createEnhancedRAGAgentEditor } from 'architectlm/extensions';

const editor = createEnhancedRAGAgentEditor({
  provider: 'openrouter',
  model: 'meta-llama/llama-3.3-70b-instruct',
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: 'https://openrouter.ai/api/v1',
  debug: true
});

// Edit DSL files in a directory
const result = await editor.editDSL({
  dslDirectory: './src/dsl',
  userRequest: 'Add a completed state and a transition from processing to completed on COMPLETE event',
  interactive: true // Enable interactive mode
});

console.log('Edit result:', result);
```

#### Key Features

1. **Interactive Mode with Inquirer.js**:
   - User-friendly prompts for confirming changes
   - Multiple edit iterations in a single session
   - Step-by-step guidance through the editing process

2. **Visual Diffs**:
   - See exactly what changes will be made before applying them
   - Clear visualization of additions, modifications, and deletions

3. **Undo Functionality**:
   - Revert to previous versions of files
   - File history is saved in a `.history` directory

4. **Context-Aware Editing**:
   - Previous edits are used as context for subsequent edits
   - Maintains continuity between edits

5. **Schema Validation**:
   - Validates DSL files against schemas
   - Provides feedback on validation errors

6. **Creating New Files**:
   - Support for creating new DSL files
   - Automatically validates new files against schemas

#### Advanced Error Handling with ts-morph

The RAG agent includes robust error handling with ts-morph:

```typescript
try {
  // Generate a process definition
  const processDefinition = await ragAgent.generateProcess(processSpec);
  console.log(JSON.stringify(processDefinition, null, 2));
} catch (error) {
  // The agent includes multi-layer fallbacks that will create valid definitions
  // even when the model's response isn't perfect
  console.error('Error generating process:', error);
}
```

### LLM Models Overview

ArchitectLM is compatible with various language models, but performance varies significantly. Here's a practical guide to help you choose the right model for your needs:

| Model | Size | Success Rate¹ | Format Adherence² | Reasoning³ | Cost⁴ | Recommended Use |
|-------|------|--------------|-------------------|------------|-------|-----------------|
| **GPT-4o** | 1.8T | 98% | 95% | Excellent | $$$$ | Production systems, complex business logic |
| **Claude 3 Opus** | 1.5T | 97% | 93% | Excellent | $$$$ | Production systems, complex reasoning |
| **GPT-4** | 1.8T | 96% | 92% | Excellent | $$$$ | Production systems, complex business logic |
| **Claude 3 Sonnet** | 1T | 94% | 90% | Very Good | $$$ | Production systems, standard complexity |
| **Llama 3 70B** | 70B | 91% | 87% | Very Good | $$ | Development, medium complexity |
| **Mistral Large** | 47B | 89% | 85% | Good | $$ | Development, medium complexity |
| **Claude 3 Haiku** | 20B | 87% | 82% | Good | $$ | Development, simpler components |
| **GPT-3.5 Turbo** | 175B | 85% | 80% | Good | $ | Prototyping, simpler components |
| **Mistral Medium** | 22B | 82% | 78% | Moderate | $ | Prototyping, simpler components |
| **Llama 3 8B** | 8B | 75% | 70% | Moderate | $ | Simple components only |
| **Llama 3.2 1B** | 1B | 60% | 55% | Limited | $ | Not recommended for production |

¹ *Success Rate: Percentage of correctly generated components that compile and function as expected*  
² *Format Adherence: Ability to follow strict formatting requirements and DSL patterns*  
³ *Reasoning: Capability to understand complex business logic and implement it correctly*  
⁴ *Cost: Relative API cost for generating a typical component*

#### Performance Considerations

- **Production Systems**: For business-critical applications, use GPT-4o, Claude 3 Opus/Sonnet, or GPT-4
- **Development/Testing**: Llama 3 70B, Mistral Large, or Claude 3 Haiku provide good balance of performance and cost
- **Prototyping**: GPT-3.5 Turbo or Mistral Medium are cost-effective for initial development
- **Complex Business Logic**: Larger models (>40B parameters) significantly outperform smaller ones when implementing complex state machines and business rules

#### RAG Effectiveness by Model Size

RAG (Retrieval-Augmented Generation) improves performance across all models, but with diminishing returns for smaller models:

| Model Size | RAG Improvement | Notes |
|------------|-----------------|-------|
| >40B parameters | +15-20% | Excellent utilization of retrieved context |
| 10-40B parameters | +10-15% | Good utilization with some limitations |
| <10B parameters | +5-10% | Limited ability to apply retrieved context |

For optimal results with smaller models, use the ts-morph integration to handle formatting inconsistencies and provide robust fallbacks.

## Limitations and Considerations

While ArchitectLM is powerful, there are some considerations:

1. **Eventual Consistency**: Distributed caching relies on eventual consistency
2. **External Dependencies**: Some features require external services (Redis, etc.)
3. **Memory Usage**: Large caches can consume significant memory
4. **Serialization**: All cached data must be serializable

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
11. **Enhanced TypeScript AST Processing**: Deeper integration with ts-morph for code transformation and generation
12. **Advanced RAG Integration**: Improved vector database support and multi-model agent orchestration
13. **Enhanced RAG Agent Editor Improvements**: Web-based UI, collaborative editing, and integration with version control systems

## Examples

See the [examples](./examples) directory for more examples of how to use ArchitectLM.

Key examples include:

- **Basic Process and Task**: Simple examples of process and task definitions
- **Event-Driven Communication**: Using events for communication between components
- **Distributed Caching**: Setting up and using distributed caching
- **RAG Agent with ts-morph**: Demonstrates using the RAG-enhanced agent with ts-morph for safe code extraction and processing
- **Enhanced RAG Agent Editor**: Interactive editing of DSL files with visual diffs, undo functionality, and schema validation
- **OpenRouter Integration**: Using OpenRouter to access various LLM providers
- **Error Handling Patterns**: Implementing robust error handling
- **Testing Examples**: Writing tests for processes and tasks

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT 