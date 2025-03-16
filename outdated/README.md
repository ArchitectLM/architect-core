# ArchitectLM
## SchemaTron UI

A reactive system framework for building modern applications with robust schema validation, LLM integration, and extensibility.

## Overview

ArchitectLM is a comprehensive framework designed to simplify the development of reactive systems by providing a structured approach to system architecture and implementation. It combines schema validation, process orchestration, and AI/LLM integration to create robust, maintainable, and extensible applications.

The framework is built around a core schema that defines the structure of reactive systems, with extension points for domain-specific functionality. It includes tools for validation, testing, and visualization, as well as advanced features for working with Large Language Models (LLMs).

## Reactive System Architecture

The reactive system architecture is a core component of ArchitectLM, providing a flexible and powerful way to build event-driven applications. The architecture consists of several key components that work together to create a responsive and maintainable system:

### Core Components

#### Event Bus

The event bus is the central communication mechanism in the reactive system. It allows components to emit events and subscribe to events emitted by other components. The event bus implementation provides:

- Event emission with typed payloads
- Subscription management with automatic cleanup
- Error handling for event handlers
- Support for wildcard subscriptions

```typescript
// Example of using the event bus
const eventBus = new ReactiveEventBus();

// Subscribe to an event
const subscription = eventBus.subscribe('TODO_CREATED', (event) => {
  console.log('Todo created:', event.payload);
});

// Emit an event
eventBus.emit({
  type: 'TODO_CREATED',
  payload: { id: '123', title: 'New Todo' }
});

// Unsubscribe when done
subscription.unsubscribe();
```

#### Process Engine

The process engine manages stateful processes and their transitions. It provides:

- Process instance creation and management
- State transitions based on events
- Context management for process instances
- Lifecycle hooks for state changes

```typescript
// Example of using the process engine
const processEngine = new ReactiveProcessEngine(eventBus);

// Register a process
processEngine.registerProcess(TodoProcess, todoProcessHandlers);

// Create a process instance
processEngine.createInstance('todo', 'todo-123', 'active', { todo: { id: '123', title: 'New Todo' } });

// Transition a process
processEngine.transition('todo-123', 'complete', { completedAt: new Date() });
```

#### Flow Engine

The flow engine executes flows, which are sequences of steps that perform operations. It provides:

- Flow registration and execution
- Task implementation registration
- Support for different step types (task, condition, parallel, wait)
- Input/output mapping between steps
- Execution tracing and error handling

```typescript
// Example of using the flow engine
const flowEngine = new ReactiveFlowEngine(eventBus);

// Register a flow
flowEngine.registerFlow(markImportantFlow);

// Register task implementations
flowEngine.registerTaskImplementation(markImportantTask);

// Execute a flow
const result = await flowEngine.executeFlow('mark-important-flow', { todoId: '123', priority: 'high' });
```

### Extension Components

#### Repositories

Repositories provide data access and storage capabilities for the reactive system. They emit events when data changes, allowing other components to react to these changes.

```typescript
// Example of using a repository
const todoRepository = new InMemoryTodoRepository(eventBus);

// Create a todo
const todo = await todoRepository.save({
  title: 'Important Task',
  description: 'This is an important task',
  completed: false
});

// Update a todo
await todoRepository.update(todo.id, { priority: 'high' });
```

#### Process Handlers

Process handlers define the behavior of processes, including state transitions and context updates.

```typescript
// Example of process handlers
const todoProcessHandlers = new TodoProcessHandlers(eventBus);

// Register the handlers with the process engine
processEngine.registerProcess(TodoProcess, todoProcessHandlers);
```

#### Task Implementations

Task implementations provide the actual functionality for tasks defined in flows.

```typescript
// Example of a task implementation
const markImportantTask = new MarkImportantTaskImpl(todoRepository, eventBus);

// Register the task implementation with the flow engine
flowEngine.registerTaskImplementation(markImportantTask);
```

#### Event Handlers

Event handlers respond to events emitted by other components and perform actions based on those events.

```typescript
// Example of event handlers
const todoEventHandlers = new TodoEventHandlers(eventBus, processEngine, todoRepository);
```

### System Runtime

The `ReactiveSystemRuntime` class brings all these components together, providing a unified interface for working with the reactive system:

```typescript
// Example of using the system runtime
const runtime = new ReactiveSystemRuntime({ debug: true });

// Register components
runtime.registerProcess(TodoProcess, todoProcessHandlers);
runtime.registerTaskImplementation(markImportantTask);
runtime.registerFlow(markImportantFlow);

// Execute a flow
const result = await runtime.executeFlow('mark-important-flow', { todoId: '123', priority: 'high' });
```

## How It Works

ArchitectLM is built on several key architectural components that work together to provide a comprehensive framework for reactive system development:

### Core Schema and Validation System

The foundation of ArchitectLM is a robust schema validation system built with Zod. The core schema defines the structure of reactive systems:

- **Bounded Contexts**: Logical boundaries within your system that group related processes and tasks
- **Processes**: Workflows that can be stateful or stateless, with defined transitions between states
- **Tasks**: Individual operations that perform specific functions within processes
- **Triggers**: Events that initiate processes, such as API calls, scheduled events, or message queue events

The validation system ensures that all components adhere to the defined schema and that relationships between components are valid. For example, it verifies that process transitions reference valid states and that tasks referenced by processes actually exist.

### Extension System

The extension system allows you to extend the core schema with domain-specific functionality:

1. **Schema Extensions**: Domain-specific extensions can add new properties and validation rules to the core schema
2. **Extension Registry**: A central registry manages all extensions and their compatibility
3. **Refinements**: Extensions can define refinements that modify the base schema
4. **Custom Validators**: Extensions can provide custom validation logic for domain-specific rules

For example, the e-commerce extension adds product, order, customer, and inventory transaction schemas to the core system, along with validators that ensure referential integrity between these entities.

```typescript
// Example of how the e-commerce extension is registered
extensionRegistry.registerExtension({
  id: 'e-commerce',
  name: 'E-Commerce Extension',
  description: 'Extends the reactive system schema with e-commerce concepts',
  version: '1.0.0',
  schemas: { Product: ProductSchema, Order: OrderSchema, ... },
  refinements: [ ... ],
  validators: [ ... ]
});

// Creating an extended schema with the e-commerce extension
const extendedSchema = extensionRegistry.createExtendedSchema('e-commerce');

// Validating a system with the e-commerce extension
const validationResult = extensionRegistry.validateWithExtensions(system, 'e-commerce');
```

### Parameterized Pattern Library

The pattern library provides reusable architectural patterns that can be applied to your system:

1. **Parameterized Patterns**: Patterns with customizable parameters that can be adapted to different contexts
2. **Pattern Composition**: Multiple patterns can be composed together to create more complex patterns
3. **Pattern Application**: Patterns can be applied to existing systems to enhance them with new capabilities

```typescript
// Example of applying a checkout pattern with parameters
const enhancedSystem = patternLibrary.applyPattern('e-commerce/checkout', {
  paymentProviders: ['stripe', 'paypal'],
  requiresAuthentication: true,
  checkoutSteps: ['cart', 'shipping', 'payment', 'confirmation']
});

// Composing multiple patterns
const composedPattern = patternLibrary.composePatterns([
  { id: 'e-commerce/checkout', parameters: { ... } },
  { id: 'security/authentication', parameters: { ... } }
]);
```

### LLM Integration Layer

The LLM integration layer provides sophisticated tools for working with Large Language Models:

#### Prompt Management

- **Template System**: Version-controlled prompt templates with parameter substitution
- **Composition**: Build complex prompts from reusable fragments
- **A/B Testing**: Test different prompt variations for effectiveness

#### LLM Test Generation

The test generation system uses LLMs to create comprehensive test suites for your reactive systems:

1. **Context-Aware Generation**: Tests are generated based on the system schema and examples
2. **Coverage Analysis**: The system ensures that generated tests achieve desired coverage
3. **Edge Cases**: Tests include edge cases, performance scenarios, and security considerations

```typescript
// Example of generating tests for a system
const testGenerator = new LLMTestGenerator({
  model: 'gpt-4',
  temperature: 0.7,
  includeEdgeCases: true,
  includePerformanceTests: true,
  includeSecurityTests: true
});

const testSuite = await testGenerator.generateTestSuiteForSystem(system);
```

#### Schema Editing Agent

The schema editing agent uses LLMs to help modify and extend your system schema:

1. **Intelligent Editing**: Suggests schema changes based on natural language descriptions
2. **Validation**: Ensures that suggested changes maintain schema integrity
3. **Explanation**: Provides explanations for suggested changes

```typescript
// Example of using the schema editing agent
const agent = new SchemaEditingAgent();
const result = await agent.applySchemaChange(system, 
  "Add a new task called 'send-confirmation-email' to the 'create-order' process"
);

if (result.success) {
  console.log('Schema updated successfully');
  console.log('Explanation:', result.explanation);
} else {
  console.error('Validation issues:', result.validationIssues);
}
```

#### Feedback System

The feedback system collects runtime telemetry and uses it to suggest improvements:

1. **Telemetry Collection**: Gathers performance metrics, error rates, and usage patterns
2. **Anomaly Detection**: Identifies potential issues in system behavior
3. **Improvement Suggestions**: Generates suggestions for improving system performance and reliability

### Runtime Environment

The runtime environment executes the reactive system:

1. **Process Engine**: Manages process state and transitions
2. **Task Execution**: Executes tasks within processes
3. **Event Bus**: Facilitates communication between components
4. **Monitoring**: Tracks system performance and health

## Key Features

### Core Schema and Validation

- **Structured Schema Definition**: Define your system using a comprehensive schema that includes processes, tasks, flows, and bounded contexts.
- **Custom Validation Rules**: Create and apply domain-specific validation rules to ensure system integrity.
- **Cross-Entity Validation**: Validate relationships between different entities in your system.
- **Process Flow Validation**: Ensure that stateful processes have valid transitions and no unreachable states.

### Extension System

- **Domain-Specific Extensions**: Extend the core schema with domain-specific entities, validators, and transformers.
- **Extension Registry**: Manage and apply extensions to your system.
- **Compatibility Checking**: Ensure that extensions are compatible with your core schema.

### LLM Integration

- **Prompt Management**: Version-controlled prompt templates with variable substitution.
- **Prompt Composition**: Compose prompts from reusable fragments with optimization capabilities.
- **Post-Processing**: Normalize and validate LLM outputs with schema-based validation.
- **Fallback Mechanisms**: Handle LLM failures gracefully with configurable retry and fallback strategies.

### Testing and Visualization

- **Test Generation**: Generate tests from templates and examples.
- **Property-Based Testing**: Define properties that your system should maintain.
- **Visualization Tools**: Visualize your system architecture and process flows.

## Installation

```bash
npm install architectlm
```

## Usage

### Defining a Reactive System

```typescript
import { ReactiveSystem } from 'meta-framework7';

const system: ReactiveSystem = {
  id: 'order-management',
  name: 'Order Management System',
  version: '1.0.0',
  boundedContexts: {
    'order-processing': {
      id: 'order-processing',
      name: 'Order Processing',
      description: 'Handles order creation and processing',
      processes: ['create-order', 'process-payment']
    }
  },
  processes: {
    'create-order': {
      id: 'create-order',
      name: 'Create Order',
      contextId: 'order-processing',
      type: 'stateful',
      triggers: [
        {
          type: 'api_call',
          name: 'create-order-api',
          method: 'POST',
          url: '/api/orders'
        }
      ],
      tasks: ['validate-order', 'save-order'],
      states: ['draft', 'validated', 'saved'],
      transitions: [
        {
          from: 'draft',
          to: 'validated',
          on: 'validation-success'
        },
        {
          from: 'validated',
          to: 'saved',
          on: 'save-success'
        }
      ]
    }
  },
  tasks: {
    'validate-order': {
      id: 'validate-order',
      type: 'operation',
      description: 'Validates the order data',
      input: ['orderData'],
      output: ['validationResult']
    },
    'save-order': {
      id: 'save-order',
      type: 'operation',
      description: 'Saves the order to the database',
      input: ['validatedOrder'],
      output: ['savedOrder']
    }
  }
};
```

### Validating a System

```typescript
import { validateSystem } from 'meta-framework7';

const validationResult = validateSystem(system);

if (validationResult.success) {
  console.log('System is valid!');
} else {
  console.error('Validation errors:', validationResult.errors);
}
```

### Using Custom Validation Rules

```typescript
import { ValidationRegistry, ValidationRule } from 'meta-framework7';

// Create a custom validation rule
const taskHasImplementation: ValidationRule = {
  id: 'task.has-implementation',
  name: 'Task Has Implementation',
  description: 'Ensures that a task has an implementation',
  applicableTo: ['task'],
  validate: (task, _context) => {
    if (!task.implementation) {
      return {
        success: false,
        errors: [{
          path: 'implementation',
          message: 'Task must have an implementation'
        }]
      };
    }
    return { success: true, errors: [] };
  }
};

// Create a validation registry and register the rule
const registry = new ValidationRegistry();
registry.registerRule(taskHasImplementation);

// Validate an entity with the rule
const task = {
  id: 'validate-order',
  type: 'operation',
  description: 'Validates the order data'
  // Missing implementation
};

const result = registry.validateEntity(task, 'task', {});
console.log(result); // { success: false, errors: [{ path: 'implementation', message: 'Task must have an implementation' }] }
```

### Working with LLMs

```typescript
import { PromptManager, PromptTemplate } from 'meta-framework7';

// Create a prompt template
const template: PromptTemplate = {
  id: 'order-summary',
  version: '1.0.0',
  name: 'Order Summary',
  description: 'Generates a summary of an order',
  template: 'Please summarize the following order: {{orderDetails}}',
  parameters: {
    orderDetails: {
      type: 'string',
      description: 'JSON string containing order details',
      required: true
    }
  }
};

// Create a prompt manager and register the template
const manager = new PromptManager();
manager.registerTemplate(template);

// Render the prompt
const prompt = manager.renderPrompt('order-summary', {
  variables: {
    orderDetails: JSON.stringify({
      id: '12345',
      customer: 'John Doe',
      items: [
        { name: 'Product A', quantity: 2, price: 10.99 },
        { name: 'Product B', quantity: 1, price: 24.99 }
      ]
    })
  }
});

// Use the prompt with an LLM
// ... LLM integration code ...
```

### Using the Fallback System

```typescript
import { LLMFallbackManager } from 'meta-framework7';

// Create a fallback manager
const fallbackManager = new LLMFallbackManager({
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 10000
});

// Register a fallback template
fallbackManager.registerFallbackTemplate('order-summary', {
  template: 'This is a fallback summary for order {{orderId}}',
  variables: ['orderId']
});

// Execute an operation with fallback
const generateOrderSummary = async (orderId) => {
  try {
    // Simulate an LLM call
    return await callLLM(`Generate a summary for order ${orderId}`);
  } catch (error) {
    // Handle the error
    return `Failed to generate summary for order ${orderId}`;
  }
};

const result = await fallbackManager.executeWithRetry(
  () => generateOrderSummary('12345'),
  'order-summary'
);

console.log(result);
```

## Extension System

### Creating a Domain-Specific Extension

```typescript
import { z } from 'zod';
import { SchemaExtension, extensionRegistry } from 'meta-framework7';

// Define schemas for your domain
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().positive(),
  // ...other properties
});

// Create the extension
const eCommerceExtension: SchemaExtension = {
  id: 'e-commerce',
  name: 'E-Commerce Extension',
  description: 'Extends the system with e-commerce capabilities',
  version: '1.0.0',
  
  schemas: {
    Product: ProductSchema,
    // ...other schemas
  },
  
  refinements: [
    (schema) => {
      // Extend the base schema with e-commerce properties
      return z.object({
        ...schema.shape,
        ecommerce: z.object({
          products: z.record(z.string(), ProductSchema),
          // ...other collections
        }).optional()
      });
    }
  ],
  
  validators: [
    (system) => {
      const results = [];
      // Add domain-specific validation logic
      // ...
      return results;
    }
  ]
};

// Register the extension
extensionRegistry.registerExtension(eCommerceExtension);

// Use the extension
const extendedSchema = extensionRegistry.createExtendedSchema('e-commerce');
const validationResult = extensionRegistry.validateWithExtensions(mySystem, 'e-commerce');
```

### Using the Parameterized Pattern Library

```typescript
import { PatternLibrary } from 'meta-framework7';

// Create a pattern library
const patternLibrary = new PatternLibrary();

// Apply a pattern with parameters
const enhancedSystem = patternLibrary.applyPattern('e-commerce/checkout', {
  paymentProviders: ['stripe', 'paypal'],
  requiresAuthentication: true,
  checkoutSteps: ['cart', 'shipping', 'payment', 'confirmation']
});

// Compose multiple patterns
const composedPattern = patternLibrary.composePatterns([
  {
    id: 'e-commerce/checkout',
    parameters: { paymentProviders: ['stripe'] }
  },
  {
    id: 'security/authentication',
    parameters: { methods: ['oauth2'], requiresMFA: true }
  }
]);

// Register and apply the composed pattern
patternLibrary.registerPattern(composedPattern);
const result = patternLibrary.applyPattern(composedPattern.id, {});
```

## Advanced Features

### LLM Test Generation

```typescript
import { LLMTestGenerator } from 'meta-framework7';

// Create a test generator
const testGenerator = new LLMTestGenerator({
  model: 'gpt-4',
  temperature: 0.7,
  includeEdgeCases: true,
  includePerformanceTests: true,
  includeSecurityTests: true,
  maxTestsPerEntity: 10
});

// Generate tests for a system
const systemTestSuite = await testGenerator.generateTestSuiteForSystem(system);

// Generate tests for a specific process
const processTestSuite = await testGenerator.generateTestSuiteForProcess(
  system, 
  system.processes['create-order']
);

// Generate test code
const testCode = await testGenerator.generateTestCode(systemTestSuite, 'typescript');
```

### Schema Editing Agent

```typescript
import { SchemaEditingAgent } from 'meta-framework7';

// Create a schema editing agent
const agent = new SchemaEditingAgent();

// Apply a schema change based on natural language description
const result = await agent.applySchemaChange(
  system,
  "Add a new task called 'send-confirmation-email' that sends an email to the customer after an order is created"
);

if (result.success) {
  // Use the updated system
  const updatedSystem = result.system;
  console.log('Change explanation:', result.explanation);
} else {
  console.error('Validation issues:', result.validationIssues);
}

// Get an explanation of the current schema
const explanation = await agent.explainSchema(system, 'create-order');
console.log(explanation);
```

## Contributing

We welcome contributions to ArchitectLM! Please see our [contributing guidelines](CONTRIBUTING.md) for more information.

## License

ArchitectLM is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

## CLI Tools

ArchitectLM includes a powerful CLI for working with schemas:

### Schema Validation

Validate your schema files against the core schema and any extensions:

```bash
# Validate a single schema file
node ./bin/architect-cli.js validate -f path/to/schema.json

# Validate all schema files in a directory
node ./bin/architect-cli.js validate -d path/to/schemas
```

### Schema Editing

Edit your schema files using natural language prompts:

```bash
# Edit a schema file
node ./bin/architect-cli.js edit -f path/to/schema.json -p "Add a new task called 'send-notification' to the 'create-order' process"

# Edit all schema files in a directory
node ./bin/architect-cli.js edit -d path/to/schemas -p "Add error handling to all processes"
```

### Test Generation

Generate tests for your schema:

```bash
# Generate tests for a schema file
node ./bin/architect-cli.js generate-tests -f path/to/schema.json -o path/to/tests

# Generate tests for all schema files in a directory
node ./bin/architect-cli.js generate-tests -d path/to/schemas -o path/to/tests
```

## Examples

The `examples` directory contains example schema files that demonstrate different aspects of the framework:

- **Todo System**: A simple todo management system without extensions
- **E-Commerce System**: A more complex e-commerce system that uses the e-commerce extension

You can use these examples as a starting point for your own schemas.