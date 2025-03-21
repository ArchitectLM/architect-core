# Plugin System Documentation

## Overview

The plugin system in Core2 is designed to provide a flexible and extensible architecture for adding functionality to the runtime. It follows the extension point pattern, allowing plugins to hook into various lifecycle events and system operations.

## Core Concepts

### Extension Points

Extension points are predefined hooks in the system where plugins can inject custom behavior. Each extension point has a specific context type and can modify or enhance the system's behavior.

Common extension points include:

- `process:beforeCreate` - Before creating a new process
- `process:beforeTransition` - Before transitioning a process state
- `task:beforeExecution` - Before executing a task
- `task:onError` - When a task encounters an error
- `event:beforePublish` - Before publishing an event
- `event:beforeReplay` - Before replaying events

### Plugins

Plugins are modules that implement the `Extension` interface and provide functionality by hooking into extension points. Each plugin can:

1. Define its name and description
2. Implement hooks for specific extension points
3. Maintain its own state and configuration
4. Interact with the runtime through the extension system

## Built-in Plugins

### TaskDependenciesPlugin

Handles task dependencies and sequencing:
- Manages task execution order
- Handles dependency resolution
- Supports task scheduling
- Provides task cancellation

### RetryPlugin

Manages task retry behavior:
- Configurable retry policies
- Multiple backoff strategies
- Error type filtering
- Retry statistics tracking

### ProcessRecoveryPlugin

Handles process versioning and recovery:
- Process checkpointing
- State restoration
- Version management
- Recovery tracking

### EventPersistencePlugin

Manages event persistence and replay:
- Event storage
- Event replay
- Event correlation
- Event routing

## Creating Custom Plugins

To create a custom plugin:

1. Implement the `Extension` interface:
```typescript
import { Extension } from '../models/extension.js';

export class CustomPlugin implements Extension {
  name = 'custom-plugin';
  description = 'Description of the plugin';

  hooks = {
    'extension:point': async (context: any) => {
      // Plugin logic here
      return context;
    }
  };
}
```

2. Register the plugin with the runtime:
```typescript
const runtime = createRuntime(processDefinitions, taskDefinitions, {
  extensionSystem,
  eventBus
});

extensionSystem.registerExtension(new CustomPlugin());
```

## Plugin Lifecycle

1. **Initialization**: Plugins are initialized when registered with the extension system
2. **Hook Registration**: Plugin hooks are registered for specific extension points
3. **Execution**: Hooks are executed when their corresponding extension points are triggered
4. **Cleanup**: Plugins can implement cleanup logic through the `clear()` method

## Best Practices

1. **Single Responsibility**: Each plugin should focus on a specific aspect of functionality
2. **State Management**: Use private fields to maintain plugin state
3. **Error Handling**: Implement proper error handling in hooks
4. **Context Preservation**: Always return the modified context from hooks
5. **Testing**: Write unit tests for plugin functionality

## Extension Point Contexts

Each extension point provides a context object with relevant data:

```typescript
// Process-related contexts
interface ProcessContext {
  process: ProcessInstance;
  data: any;
  definition: ProcessDefinition;
}

// Task-related contexts
interface TaskContext {
  taskType: string;
  input: any;
  execution: TaskExecution;
  error?: Error;
}

// Event-related contexts
interface EventContext {
  event: Event;
  type: string;
  payload: any;
  metadata?: Record<string, any>;
}
```

## Plugin Configuration

Plugins can be configured through options:

```typescript
interface PluginOptions {
  // Plugin-specific options
}

export function createPlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  options: PluginOptions
): Plugin {
  return new Plugin(eventBus, extensionSystem, options);
}
```

## Testing Plugins

When testing plugins:

1. Mock dependencies (EventBus, ExtensionSystem)
2. Test hook behavior
3. Verify state changes
4. Check error handling
5. Validate cleanup

Example test:
```typescript
describe('CustomPlugin', () => {
  let plugin: CustomPlugin;
  let eventBus: EventBus;
  let extensionSystem: ExtensionSystem;

  beforeEach(() => {
    eventBus = mock<EventBus>();
    extensionSystem = mock<ExtensionSystem>();
    plugin = createPlugin(eventBus, extensionSystem, {
      // test options
    });
  });

  it('should handle extension point', async () => {
    const context = { /* test context */ };
    const result = await plugin.hooks['extension:point'](context);
    expect(result).toBeDefined();
    // Add more assertions
  });
});
``` 