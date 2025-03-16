# Hybrid DSL for Architect Framework

This module provides a hybrid Domain-Specific Language (DSL) for defining reactive systems in the Architect Framework. It combines the benefits of both functional programming and the builder pattern to offer flexibility and expressiveness.

## Key Features

- **Immutability**: All operations produce new objects rather than mutating existing ones
- **Fluent Interface**: Builder pattern for intuitive, chainable API
- **Functional Composition**: Pure functions for transformations and composition
- **Type Safety**: Strong TypeScript typing throughout
- **Validation**: Built-in validation with clear error messages
- **Extensibility**: Support for extensions and custom transformations

## Usage Examples

### Builder Pattern Approach

The builder pattern provides a fluent, chainable API for defining systems:

```typescript
import { SystemBuilder } from '../dsl';

// Create an e-commerce system
const ecommerceSystem = SystemBuilder.create('e-commerce')
  .withName('E-Commerce System')
  .withDescription('An e-commerce system with product catalog and order management')
  .withVersion('1.0.0')
  
  // Add bounded contexts
  .withBoundedContext('catalog', 'Product Catalog')
  .withBoundedContext('orders', 'Order Management')
  .withBoundedContext('customers', 'Customer Management')
  
  // Add processes to contexts
  .withStatefulProcess('manage-products', 'catalog', {
    name: 'Manage Products',
    states: ['draft', 'published', 'archived'],
    transitions: [
      { from: 'draft', to: 'published', on: 'publish' },
      { from: 'published', to: 'archived', on: 'archive' },
      { from: 'archived', to: 'published', on: 'restore' }
    ]
  })
  .withProcess('manage-inventory', 'catalog', 'Manage Inventory')
  .withStatefulProcess('process-order', 'orders', {
    name: 'Process Order',
    states: ['created', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
    transitions: [
      { from: 'created', to: 'paid', on: 'payment-received' },
      { from: 'paid', to: 'processing', on: 'start-processing' },
      { from: 'processing', to: 'shipped', on: 'ship-order' },
      { from: 'shipped', to: 'delivered', on: 'delivery-confirmed' },
      { from: 'created', to: 'cancelled', on: 'cancel-order' },
      { from: 'paid', to: 'cancelled', on: 'cancel-order' }
    ]
  })
  
  // Add tasks
  .withTask('validate-product', 'Validate Product')
  .withTask('save-product', 'Save Product')
  .withTask('update-inventory', 'Update Inventory')
  .withTask('process-payment', 'Process Payment')
  
  // Assign tasks to processes
  .withProcessTask('manage-products', 'validate-product')
  .withProcessTask('manage-products', 'save-product')
  .withProcessTask('manage-inventory', 'update-inventory')
  .withProcessTask('process-order', 'process-payment')
  
  // Add an extension
  .withExtension('e-commerce', {
    enabled: true,
    currency: 'USD',
    paymentMethods: ['credit_card', 'paypal', 'bank_transfer'],
    products: {
      // Product definitions
    }
  })
  
  // Build the final system
  .build();

// Validate the system
const validationResult = SystemBuilder.create('e-commerce')
  // ... configuration ...
  .validate();

if (!validationResult.success) {
  console.error('Validation failed:', validationResult.issues);
}
```

### Functional Approach

The functional approach provides a more composable way to define systems:

```typescript
import { 
  createSystem, 
  addBoundedContext, 
  addProcess, 
  addTask, 
  addTaskToProcess, 
  addExtension,
  pipe 
} from '../dsl';

// Create an e-commerce system using functional composition
const ecommerceSystem = pipe(
  // Create the base system
  createSystem('e-commerce', 'E-Commerce System', '1.0.0'),
  
  // Add bounded contexts
  sys => addBoundedContext(sys, 'catalog', 'Product Catalog'),
  sys => addBoundedContext(sys, 'orders', 'Order Management'),
  
  // Add processes
  sys => addProcess(sys, 'manage-products', 'Manage Products', 'catalog', 'stateful'),
  sys => addProcess(sys, 'manage-inventory', 'Manage Inventory', 'catalog'),
  
  // Add tasks
  sys => addTask(sys, 'validate-product', 'operation', 'Validate Product'),
  sys => addTask(sys, 'save-product', 'operation', 'Save Product'),
  
  // Assign tasks to processes
  sys => addTaskToProcess(sys, 'manage-products', 'validate-product'),
  sys => addTaskToProcess(sys, 'manage-products', 'save-product'),
  
  // Add an extension
  sys => addExtension(sys, 'e-commerce', {
    enabled: true,
    currency: 'USD',
    paymentMethods: ['credit_card', 'paypal']
  })
);
```

### Process and Task Builders

For more complex process and task definitions, you can use dedicated builders:

```typescript
import { ProcessBuilder, TaskBuilder } from '../dsl';

// Create a process using ProcessBuilder
const orderProcess = new ProcessBuilder('process-order', 'Process Order', 'orders')
  .withType('stateful')
  .withStates(['created', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'])
  .withTransition('created', 'paid', 'payment-received')
  .withTransition('paid', 'processing', 'start-processing')
  .withTransition('processing', 'shipped', 'ship-order')
  .withTask('validate-order')
  .withTask('process-payment')
  .build();

// Create a task using TaskBuilder
const validateProductTask = new TaskBuilder('validate-product')
  .withLabel('Validate Product')
  .withDescription('Validates product data before saving')
  .withInput(['name', 'price', 'description'])
  .withOutput(['isValid', 'errors'])
  .build();
```

### Combining Approaches

You can combine both approaches for maximum flexibility:

```typescript
import { SystemBuilder, createSystem, addBoundedContext, pipe } from '../dsl';

// Start with functional approach
const baseSystem = pipe(
  createSystem('e-commerce', 'E-Commerce System', '1.0.0'),
  sys => addBoundedContext(sys, 'catalog', 'Product Catalog')
);

// Continue with builder approach
const finalSystem = SystemBuilder.create(baseSystem.id)
  .transform(() => baseSystem) // Use the existing system as a base
  .withProcess('manage-products', 'catalog', 'Manage Products')
  .withTask('validate-product', 'Validate Product')
  .withProcessTask('manage-products', 'validate-product')
  .build();
```

## API Reference

### Builder Classes

- **SystemBuilder**: Main builder for creating reactive systems
- **ProcessBuilder**: Builder for creating processes
- **TaskBuilder**: Builder for creating tasks

### Functional API

- **createSystem**: Creates a new system
- **addBoundedContext**: Adds a bounded context to a system
- **addProcess**: Adds a process to a system
- **addTask**: Adds a task to a system
- **addTaskToProcess**: Adds a task to a process
- **addExtension**: Adds an extension to a system
- **pipe**: Composes multiple functions that transform a system

## Benefits

- **Declarative Style**: Focus on "what" rather than "how"
- **Composition Over Inheritance**: System definitions as compositions of smaller, focused functions
- **Immutability and Predictability**: Eliminates entire classes of bugs related to state management
- **Referential Transparency**: Functions with the same inputs always produce the same outputs
- **Better Validation Flow**: Validation integrated into the transformation pipeline 