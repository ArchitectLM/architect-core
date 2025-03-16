# @architectlm/dsl

Domain-Specific Language for the ArchitectLM reactive system.

## Overview

The DSL package provides a declarative way to define reactive system configurations, including:

- Schemas for data validation
- Pure functions for business logic
- Commands with resilience patterns
- Reactive pipelines for processing flows
- Extension points for cross-cutting concerns

## Installation

```bash
pnpm add @architectlm/dsl
```

## Usage

### Creating a Configuration

You can create a configuration using the builder pattern:

```typescript
import { createDSLConfig } from "@architectlm/dsl";

const config = createDSLConfig()
  .withMeta({
    name: "Payment Processing System",
    version: "1.0.0",
    description: "Handles payment transactions with multiple providers",
  })
  .withSchema("PaymentRequest", {
    type: "object",
    required: ["amount", "currency"],
    properties: {
      amount: { type: "number", minimum: 0.01 },
      currency: { type: "string", minLength: 3, maxLength: 3 },
    },
  })
  .withFunction("validatePayment", {
    meta: {
      purpose: "Validate payment request data",
      domain: "payment",
      tags: ["validation", "payment"],
    },
    implementation: (payment) => {
      // Validation logic
      return true;
    },
  })
  .withCommand("processPayment", {
    meta: {
      purpose: "Process a payment transaction",
      domain: "payment",
      tags: ["payment", "transaction"],
    },
    input: "PaymentRequest",
    output: "PaymentResult",
    implementation: async (payment) => {
      // Payment processing logic
      return { success: true, transactionId: "123" };
    },
    resilience: {
      retry: {
        maxAttempts: 3,
        backoff: "exponential",
      },
    },
  })
  .withPipeline("paymentProcessing", {
    description: "Payment processing pipeline",
    input: "PaymentRequest",
    output: "PaymentResult",
    steps: [
      { name: "validate", function: "validatePayment" },
      { name: "process", function: "processPayment" },
    ],
    errorHandling: {
      retryable: ["process"],
    },
  })
  .withExtensionPoint("beforePaymentProcessing", {
    description: "Called before processing a payment",
    parameters: ["request", "context"],
  })
  .build();
```

### Parsing a Configuration

You can also parse an existing configuration object:

```typescript
import { parseDSLConfig } from "@architectlm/dsl";

const rawConfig = {
  meta: {
    /* ... */
  },
  schemas: {
    /* ... */
  },
  functions: {
    /* ... */
  },
  commands: {
    /* ... */
  },
  pipelines: {
    /* ... */
  },
  extensionPoints: {
    /* ... */
  },
};

const parsedConfig = parseDSLConfig(rawConfig);
```

### Integration with Runtime

The DSL configuration can be used with the ArchitectLM runtime:

```typescript
import { ReactiveRuntime } from "@architectlm/core";
import { parseDSLConfig } from "@architectlm/dsl";

// Create a runtime instance
const runtime = new ReactiveRuntime();

// Parse the configuration
const config = parseDSLConfig(rawConfig);

// Register commands
for (const [name, command] of Object.entries(config.commands)) {
  runtime.registerCommand(name, command.implementation);
}

// Execute a command
const result = await runtime.executeCommand("processPayment", {
  amount: 100,
  currency: "USD",
});
```

## Features

- **Schema Validation**: JSON Schema-based validation for inputs and outputs
- **Pure Functions**: Business logic implemented as pure functions
- **Resilience Patterns**: Built-in support for circuit breakers, retry policies, etc.
- **Reactive Pipelines**: Define processing flows as sequences of steps
- **Extension Points**: Allow cross-cutting concerns to be added without modifying core functionality

## License

MIT
