# Plugin System Documentation

## Overview

The Core2 Plugin System provides a structured way to extend the runtime's functionality. It builds on top of the extension system to provide a more sophisticated mechanism for adding capabilities to the runtime. Plugins can bundle multiple extensions, manage their lifecycle, and declare dependencies on other plugins.

## Key Concepts

### Plugin

A plugin is a self-contained package of functionality that can be added to the Core2 Runtime. Each plugin:

- Has a unique identifier
- Can declare dependencies on other plugins
- Has a lifecycle (initialize, activate, deactivate)
- Can provide multiple extensions to the system

### Plugin Registry

The `PluginRegistry` manages the registration, dependency resolution, and activation order of plugins. It ensures that:

- Plugins are registered only once
- Dependencies are satisfied before a plugin is activated
- Plugins are activated and deactivated in the correct order

### Plugin Lifecycle

Each plugin goes through a defined lifecycle:

1. **Registration**: The plugin is registered with the system
2. **Initialization**: The plugin's `initialize` method is called
3. **Activation**: The plugin's `activate` method is called
4. **Usage**: The plugin's functionality is available to the system
5. **Deactivation**: The plugin's `deactivate` method is called

## Plugin Interface

```typescript
interface Plugin {
  // Metadata
  id: string;               // Unique plugin identifier
  name: string;             // Human-readable name
  version: string;          // Semantic version
  description?: string;     // Optional description
  
  // Dependencies
  dependencies: string[];   // IDs of required plugins
  
  // Lifecycle hooks
  initialize?: () => Promise<Result<void>>; // Setup resources
  activate?: () => Promise<Result<void>>;   // Start functionality
  deactivate?: () => Promise<Result<void>>; // Clean up resources
  
  // Extensions provided by this plugin
  getExtensions: () => Extension[];
}
```

## Using the Plugin System

### Registering a Plugin

```typescript
const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  description: 'Adds custom functionality',
  dependencies: ['core-plugin'],
  
  initialize: async () => {
    // Initialize resources, connect to services, etc.
    return { success: true, value: undefined };
  },
  
  activate: async () => {
    // Start background processes, register event handlers, etc.
    return { success: true, value: undefined };
  },
  
  deactivate: async () => {
    // Clean up resources, remove event handlers, etc.
    return { success: true, value: undefined };
  },
  
  getExtensions: () => [myExtension1, myExtension2]
};

// Register with the plugin registry
const result = runtime.pluginRegistry.registerPlugin(myPlugin);
```

### Creating Extensions for Plugins

```typescript
const myExtension: Extension = {
  id: 'my-extension',
  name: 'My Custom Extension',
  description: 'Extends the system with custom functionality',
  
  // List of dependencies (other extensions)
  dependencies: [],
  
  // Extension hooks
  getHooks: () => [
    {
      point: 'system:startup',
      handler: async (context) => {
        // Do something during system startup
        return { success: true, value: undefined };
      }
    },
    {
      point: 'data:process',
      handler: async (context) => {
        // Process some data
        return { success: true, value: context.data };
      }
    }
  ],
  
  // Metadata methods
  getVersion: () => '1.0.0',
  getCapabilities: () => ['data-processing', 'visualization']
};
```

### Checking Plugin Status

```typescript
// Check if a plugin is registered
const isRegistered = runtime.pluginRegistry.hasPlugin('my-plugin');

// Get a specific plugin
const pluginResult = runtime.pluginRegistry.getPlugin('my-plugin');
if (pluginResult.success) {
  const plugin = pluginResult.value;
  console.log(`Plugin version: ${plugin.version}`);
}

// Get all registered plugins
const plugins = runtime.pluginRegistry.getPlugins();
```

### Activating and Deactivating Plugins

```typescript
// Activate a plugin (and its dependencies)
const activateResult = await runtime.pluginRegistry.activatePlugin('my-plugin');

// Deactivate a plugin
const deactivateResult = await runtime.pluginRegistry.deactivatePlugin('my-plugin');
```

## Plugin Best Practices

### 1. Dependency Management

- Declare all required plugins in the `dependencies` array
- Keep the dependency graph as flat as possible
- Version your plugins using semantic versioning

### 2. Resource Management

- Initialize resources in the `initialize` method
- Start active components in the `activate` method
- Clean up ALL resources in the `deactivate` method

```typescript
// Good plugin cleanup example
deactivate: async () => {
  try {
    // Remove all event listeners
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Close connections
    await this.closeConnections();
    
    // Release any held resources
    this.releaseResources();
    
    return { success: true, value: undefined };
  } catch (error) {
    return { success: false, error: new Error(`Failed to deactivate: ${error.message}`) };
  }
}
```

### 3. Error Handling

- Always return `Result<T>` objects from lifecycle methods
- Handle errors gracefully and provide descriptive messages
- Don't throw exceptions from lifecycle methods

### 4. Extension Creation

- Group related extensions together in a single plugin
- Give extensions and hooks clear, descriptive names
- Document the extension points your plugin supports

### 5. Plugin Design

- Keep plugins focused on a single responsibility
- Use composition of smaller plugins when possible
- Design for testability (avoid global state)

## Common Plugin Patterns

### State Management Plugin

```typescript
const stateManagerPlugin: Plugin = {
  id: 'state-manager',
  name: 'State Management',
  version: '1.0.0',
  dependencies: [],
  
  // State is initialized when the plugin is initialized
  initialize: async () => {
    this.state = new StateManager();
    return { success: true, value: undefined };
  },
  
  // State is exposed via extensions
  getExtensions: () => [{
    id: 'state-manager-extension',
    name: 'State Manager Extension',
    getHooks: () => [
      {
        point: 'state:get',
        handler: async (context) => {
          return { success: true, value: this.state.get(context.key) };
        }
      },
      {
        point: 'state:set',
        handler: async (context) => {
          this.state.set(context.key, context.value);
          return { success: true, value: undefined };
        }
      }
    ],
    getVersion: () => '1.0.0',
    getCapabilities: () => ['state-management'],
    dependencies: []
  }]
};
```

### Event Handling Plugin

```typescript
const eventHandlerPlugin: Plugin = {
  id: 'custom-event-handler',
  name: 'Custom Event Handler',
  version: '1.0.0',
  dependencies: ['event-system'],
  
  // Store subscriptions for cleanup
  subscriptions: [],
  
  // Set up handlers when activated
  activate: async () => {
    // Get the event bus from the runtime
    const eventBus = runtime.eventBus;
    
    // Subscribe to events
    this.subscriptions.push(
      eventBus.subscribe('entity.created', this.handleEntityCreated),
      eventBus.subscribe('entity.updated', this.handleEntityUpdated),
      eventBus.subscribe('entity.deleted', this.handleEntityDeleted)
    );
    
    return { success: true, value: undefined };
  },
  
  // Clean up when deactivated
  deactivate: async () => {
    // Unsubscribe from all events
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    return { success: true, value: undefined };
  },
  
  // Event handlers
  handleEntityCreated: async (event) => {
    console.log('Entity created:', event.payload);
    return Promise.resolve();
  },
  
  handleEntityUpdated: async (event) => {
    console.log('Entity updated:', event.payload);
    return Promise.resolve();
  },
  
  handleEntityDeleted: async (event) => {
    console.log('Entity deleted:', event.payload);
    return Promise.resolve();
  },
  
  getExtensions: () => []  // This plugin doesn't provide extensions
};
```

## Testing Plugins

### Unit Testing

```typescript
describe('My Plugin', () => {
  let plugin: Plugin;
  let mockRuntime: Runtime;
  
  beforeEach(() => {
    // Set up mock runtime
    mockRuntime = {
      eventBus: {
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        publish: vi.fn()
      },
      // ... other mock components
    } as unknown as Runtime;
    
    // Create plugin instance
    plugin = createMyPlugin(mockRuntime);
  });
  
  it('should initialize successfully', async () => {
    const result = await plugin.initialize!();
    expect(result.success).toBe(true);
  });
  
  it('should activate and set up event subscriptions', async () => {
    await plugin.initialize!();
    const result = await plugin.activate!();
    
    expect(result.success).toBe(true);
    expect(mockRuntime.eventBus.subscribe).toHaveBeenCalledTimes(3);
  });
  
  it('should clean up subscriptions on deactivate', async () => {
    const unsubscribeMock = vi.fn();
    mockRuntime.eventBus.subscribe.mockReturnValue({ unsubscribe: unsubscribeMock });
    
    await plugin.initialize!();
    await plugin.activate!();
    await plugin.deactivate!();
    
    expect(unsubscribeMock).toHaveBeenCalledTimes(3);
  });
});
```

### Integration Testing

```typescript
describe('My Plugin Integration', () => {
  let runtime: Runtime;
  
  beforeEach(async () => {
    // Create a real runtime
    runtime = createModernRuntime();
    await runtime.initialize();
    await runtime.start();
    
    // Register and activate the plugin
    const plugin = createMyPlugin(runtime);
    runtime.pluginRegistry.registerPlugin(plugin);
    await runtime.pluginRegistry.activatePlugin(plugin.id);
  });
  
  afterEach(async () => {
    // Clean up
    await runtime.stop();
  });
  
  it('should handle events correctly', async () => {
    // Set up event tracking
    const receivedEvents: string[] = [];
    const originalHandleEvent = plugin.handleEntityCreated;
    plugin.handleEntityCreated = async (event) => {
      receivedEvents.push(event.id);
      return originalHandleEvent(event);
    };
    
    // Publish an event
    const eventId = uuidv4();
    await runtime.eventBus.publish({
      id: eventId,
      type: 'entity.created',
      timestamp: Date.now(),
      payload: { id: 'entity-1' },
      metadata: {}
    });
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the event was handled
    expect(receivedEvents).toContain(eventId);
  });
}); 