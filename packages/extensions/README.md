# @architectlm/extensions

Extension system for the ArchitectLM reactive system.

## Overview

The `@architectlm/extensions` package provides a flexible extension system for the ArchitectLM reactive system. It allows you to define extension points in your application, register extensions that hook into these points, and create plugins that can both hook into extension points and intercept events.

## Features

- **Extension Points**: Define places in your application where extensions can hook in
- **Extensions**: Register code that hooks into extension points
- **Event Interception**: Intercept and modify events flowing through the system
- **Plugins**: Combine extensions and event interceptors into reusable packages

### New Extensions

This package now includes several extensions that were previously part of the core package:

- **Caching Strategy Extension**: Provides caching strategies, including time-based and sliding expiration, with support for custom key generation and caching rules.
- **Backoff Strategy Extension**: Provides specialized backoff strategies for retry policies, including adaptive backoff that adjusts based on system load and stepped backoff that increases delay in steps.
- **Contextual Resilience Policy Extension**: Adjusts resilience configurations based on runtime context, such as tenant, service, environment, and system metrics.
- **Error Classification Extension**: Classifies errors for better retry decisions, with built-in classifiers for network, HTTP, and database errors.
- **Distributed Tracing Extension**: Adds distributed tracing to events, with support for extracting and injecting trace context, and adding custom attributes to spans.
- **Event Transformation Extension**: Transforms, enriches, and filters events, with support for chaining multiple transformations.
- **Monitoring Extension**: Collects metrics on resilience patterns, including circuit breaker state changes, retry attempts, bulkhead rejections, rate limiting events, and cache access.

## Installation

```bash
npm install @architectlm/extensions
# or
yarn add @architectlm/extensions
# or
pnpm add @architectlm/extensions
```

## Usage

### Creating an Extension System

```typescript
import { createExtensionSystem } from "@architectlm/extensions";

// Create a new extension system
const extensionSystem = createExtensionSystem();
```

### Defining Extension Points

```typescript
import { ExtensionPoint } from "@architectlm/extensions";

// Define an extension point
const extensionPoint: ExtensionPoint = {
  name: "app.beforeStart",
  description: "Called before the application starts",
};

// Register the extension point
extensionSystem.registerExtensionPoint(extensionPoint);
```

### Creating Extensions

```typescript
import { Extension } from "@architectlm/extensions";

// Define an extension
const extension: Extension = {
  name: "logger.extension",
  description: "Logs when the application starts",
  hooks: {
    "app.beforeStart": (context) => {
      console.log("Application is starting with context:", context);
    },
  },
};

// Register the extension
extensionSystem.registerExtension(extension);
```

### Triggering Extension Points

```typescript
// Trigger the extension point with some context
extensionSystem.triggerExtensionPoint("app.beforeStart", {
  startTime: Date.now(),
});
```

### Event Interception

```typescript
import { EventInterceptor } from "@architectlm/extensions";

// Define an event interceptor
const loggingInterceptor: EventInterceptor = (event) => {
  console.log("Event intercepted:", event);
  return event;
};

// Register the interceptor
extensionSystem.registerEventInterceptor(loggingInterceptor);
```

### Creating Plugins

```typescript
import { Plugin } from "@architectlm/extensions";

// Define a plugin
const plugin: Plugin = {
  name: "analytics.plugin",
  description: "Tracks application events",
  hooks: {
    "app.beforeStart": (context) => {
      console.log("Tracking application start");
    },
  },
  eventInterceptors: [
    (event) => {
      // Track the event
      console.log("Tracking event:", event);
      return event;
    },
  ],
};

// Register the plugin
extensionSystem.registerPlugin(plugin);
```

### Integrating with Event Bus

```typescript
import { ReactiveEventBus } from "@architectlm/core";
import { ExtensionSystem } from "@architectlm/extensions";

class ExtendedEventBus extends ReactiveEventBus {
  private extensionSystem: ExtensionSystem;

  constructor(extensionSystem: ExtensionSystem) {
    super();
    this.extensionSystem = extensionSystem;
  }

  override publish<T>(eventType: string, payload: T): void {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    // Process the event through interceptors
    const processedEvent =
      this.extensionSystem.processEventThroughInterceptors(event);

    // Publish the processed event
    super.publish(processedEvent.type, processedEvent.payload);
  }
}
```

## License

MIT
