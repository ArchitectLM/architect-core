# Optimized System Loading Strategy

This document outlines the hybrid loading strategy implemented in the DSL system loader, which combines the benefits of both lazy loading and eager initialization.

## Overview

The system loader now supports four key strategies:

1. **Critical Path Initialization**: Load and validate core components and frequently used components at startup.
2. **Background Loading**: After the system is operational, pre-load remaining components in the background.
3. **Validation Framework**: Comprehensive validation that runs both at component registration time and during compilation.
4. **Caching Strategy**: Leveraging the cache system to mitigate cold start issues.

## Configuration Options

The `SystemLoader` accepts the following options:

```typescript
interface SystemLoaderOptions {
  // Whether to use lazy loading (default: true)
  useLazyLoading?: boolean;
  
  // Event bus for system events
  eventBus?: ReactiveEventBus;
  
  // Cache options for component loading
  cacheOptions?: CacheOptions;
  
  // Critical path components to always load at startup
  criticalPathComponents?: Partial<Record<ComponentType, string[]>>;
  
  // Whether to validate components on load (default: true)
  validateOnLoad?: boolean;
  
  // Whether to preload all components in background after system initialization (default: false)
  preloadAllInBackground?: boolean;
}
```

## Usage Examples

### Basic Usage with Default Settings (Lazy Loading)

```typescript
import { SystemLoader } from './system-loader.js';
import { ComponentRegistry } from './component-registry.js';

// Create a component registry
const registry = new ComponentRegistry();

// Create a system loader with default settings (lazy loading enabled)
const loader = new SystemLoader(registry);

// Load a system definition
const system = loader.loadSystem({
  name: 'MySystem',
  description: 'My system description',
  components: {
    schemas: [{ ref: 'User', required: true }],
    commands: [{ ref: 'CreateUser', required: true }]
  }
});

// Components will be loaded on-demand when accessed
const userComponent = await loader.getComponent('MySystem', 'User');
```

### Eager Loading (No Lazy Loading)

```typescript
// Create a system loader with eager loading
const loader = new SystemLoader(registry, {
  useLazyLoading: false
});

// Load a system definition - all components will be loaded immediately
const system = loader.loadSystem({
  name: 'MySystem',
  components: {
    schemas: [{ ref: 'User', required: true }],
    commands: [{ ref: 'CreateUser', required: true }]
  }
});

// Components are already loaded
const userComponent = system.loadedComponents.get('User');
```

### Hybrid Approach with Critical Path Components

```typescript
import { ComponentType } from './types.js';

// Create a system loader with critical path components
const loader = new SystemLoader(registry, {
  useLazyLoading: true,
  criticalPathComponents: {
    [ComponentType.SCHEMA]: ['User', 'Product'],
    [ComponentType.COMMAND]: ['CreateUser']
  }
});

// Load a system definition
// - User and Product schemas will be loaded immediately
// - CreateUser command will be loaded immediately
// - Other components will be loaded on-demand
const system = loader.loadSystem({
  name: 'MySystem',
  components: {
    schemas: [
      { ref: 'User', required: true },
      { ref: 'Product', required: false },
      { ref: 'Order', required: false }
    ],
    commands: [
      { ref: 'CreateUser', required: true },
      { ref: 'CreateProduct', required: false }
    ]
  }
});
```

### Background Loading

```typescript
// Create a system loader with background loading
const loader = new SystemLoader(registry, {
  useLazyLoading: true,
  preloadAllInBackground: true,
  criticalPathComponents: {
    [ComponentType.SCHEMA]: ['User']
  }
});

// Load a system definition
// - User schema will be loaded immediately
// - Other components will start loading in the background
// - Components can be accessed immediately (if already loaded) or will be loaded on-demand
const system = loader.loadSystem({
  name: 'MySystem',
  components: {
    schemas: [
      { ref: 'User', required: true },
      { ref: 'Product', required: false }
    ],
    commands: [
      { ref: 'CreateUser', required: true }
    ]
  }
});
```

### With Caching

```typescript
// Create a system loader with custom cache options
const loader = new SystemLoader(registry, {
  useLazyLoading: true,
  cacheOptions: {
    ttl: 3600000, // 1 hour
    maxEntries: 1000,
    slidingExpiration: true
  }
});

// Load a system definition
const system = loader.loadSystem({
  name: 'MySystem',
  components: {
    schemas: [{ ref: 'User', required: true }]
  }
});

// First access will load the component
const userComponent1 = await loader.getComponent('MySystem', 'User');

// Second access will use the cached component
const userComponent2 = await loader.getComponent('MySystem', 'User');
```

## Best Practices

1. **Identify Critical Components**: Analyze your system to identify components that are always needed at startup and add them to `criticalPathComponents`.

2. **Balance Loading Strategy**: For development environments, consider using eager loading (`useLazyLoading: false`) for easier debugging. For production, use lazy loading with critical path components.

3. **Optimize Cache Settings**: Adjust cache TTL and size based on your application's memory constraints and component usage patterns.

4. **Monitor Performance**: Use the event bus to monitor component loading times and adjust your strategy accordingly.

5. **Required vs. Optional Components**: Mark components as `required: true` only if they are truly essential for the system to function.

## Performance Considerations

- **Memory Usage**: Eager loading consumes more memory upfront but provides consistent performance.
- **Startup Time**: Lazy loading with critical path components provides faster startup times while ensuring essential functionality is available immediately.
- **Background Loading**: Use background loading to improve perceived performance without blocking the main thread.
- **Cache Invalidation**: Remember to invalidate the cache when components are updated to ensure consistency.

## Troubleshooting

- If components are not loading as expected, check if they are properly registered in the component registry.
- If background loading is not working, ensure that the event loop is not blocked by long-running operations.
- If validation errors occur, check the component definitions against the validation rules.
- If cache is not working as expected, check the cache options and ensure that components have proper identity (name and type). 