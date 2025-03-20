/**
 * Hybrid DSL Examples
 * 
 * This file contains examples of how to use the Hybrid DSL to define reactive systems
 * using both the builder pattern and functional approaches.
 */

import {
  SystemBuilder,
  ProcessBuilder,
  TaskBuilder,
  createSystem,
  addBoundedContext,
  addProcess,
  addTask,
  addTaskToProcess,
  pipe
} from './index';

/**
 * Example 1: E-Commerce System using Builder Pattern
 * 
 * This example demonstrates how to create an e-commerce system using the builder pattern.
 */
export function createECommerceSystemWithBuilder() {
  const system = SystemBuilder.create('ecommerce-system')
    .withName('E-Commerce System')
    .withDescription('A reactive e-commerce system')
    .withVersion('1.0.0')
    // Add bounded contexts
    .withBoundedContext('catalog', 'Product Catalog')
    .withBoundedContext('orders', 'Order Management')
    .withBoundedContext('customers', 'Customer Management')
    // Add processes
    .withProcess('product-listing', 'catalog', 'Product Listing Process')
    .withStatefulProcess('order-processing', 'orders', {
      name: 'Order Processing',
      states: ['created', 'payment-pending', 'paid', 'shipped', 'delivered', 'cancelled'],
      transitions: [
        { from: 'created', to: 'payment-pending', on: 'checkout' },
        { from: 'payment-pending', to: 'paid', on: 'payment-received' },
        { from: 'paid', to: 'shipped', on: 'ship-order' },
        { from: 'shipped', to: 'delivered', on: 'delivery-confirmed' },
        { from: 'payment-pending', to: 'cancelled', on: 'cancel-order' },
        { from: 'paid', to: 'cancelled', on: 'cancel-order' }
      ]
    })
    .withProcess('customer-registration', 'customers', 'Customer Registration')
    // Add tasks
    .withTask('add-product', 'Add Product')
    .withTask('update-product', 'Update Product')
    .withTask('process-payment', 'Process Payment')
    .withTask('create-shipment', 'Create Shipment')
    .withTask('send-confirmation-email', 'Send Confirmation Email')
    .withTask('register-customer', 'Register Customer')
    // Assign tasks to processes
    .withProcessTask('product-listing', 'add-product')
    .withProcessTask('product-listing', 'update-product')
    .withProcessTask('order-processing', 'process-payment')
    .withProcessTask('order-processing', 'create-shipment')
    .withProcessTask('order-processing', 'send-confirmation-email')
    .withProcessTask('customer-registration', 'register-customer')
    .build();

  return system;
}

/**
 * Example 2: E-Commerce System using Functional Approach
 * 
 * This example demonstrates how to create the same e-commerce system using the functional approach.
 */
export function createECommerceSystemWithFunctional() {
  const system = pipe(
    // Create the base system
    createSystem('ecommerce-system', 'E-Commerce System', '1.0.0'),
    // Add description
    sys => ({ ...sys, description: 'A reactive e-commerce system' }),
    // Add bounded contexts
    sys => addBoundedContext(sys, 'catalog', 'Product Catalog'),
    sys => addBoundedContext(sys, 'orders', 'Order Management'),
    sys => addBoundedContext(sys, 'customers', 'Customer Management'),
    // Add processes
    sys => addProcess(sys, 'product-listing', 'Product Listing Process', 'catalog'),
    sys => {
      // Add stateful order process with custom logic
      const orderProcess = new ProcessBuilder('order-processing', 'Order Processing', 'orders', 'stateful')
        .withStates(['created', 'payment-pending', 'paid', 'shipped', 'delivered', 'cancelled'])
        .withTransition('created', 'payment-pending', 'checkout')
        .withTransition('payment-pending', 'paid', 'payment-received')
        .withTransition('paid', 'shipped', 'ship-order')
        .withTransition('shipped', 'delivered', 'delivery-confirmed')
        .withTransition('payment-pending', 'cancelled', 'cancel-order')
        .withTransition('paid', 'cancelled', 'cancel-order')
        .build();
      
      return {
        ...sys,
        processes: {
          ...sys.processes,
          'order-processing': orderProcess
        },
        boundedContexts: {
          ...sys.boundedContexts,
          orders: {
            ...sys.boundedContexts?.['orders'] as any,
            processes: [...(sys.boundedContexts?.['orders']?.processes || []), 'order-processing']
          }
        }
      };
    },
    sys => addProcess(sys, 'customer-registration', 'Customer Registration', 'customers'),
    // Add tasks
    sys => addTask(sys, 'add-product', 'operation', 'Add Product'),
    sys => addTask(sys, 'update-product', 'operation', 'Update Product'),
    sys => addTask(sys, 'process-payment', 'operation', 'Process Payment'),
    sys => addTask(sys, 'create-shipment', 'operation', 'Create Shipment'),
    sys => addTask(sys, 'send-confirmation-email', 'notification', 'Send Confirmation Email'),
    sys => addTask(sys, 'register-customer', 'operation', 'Register Customer'),
    // Assign tasks to processes
    sys => addTaskToProcess(sys, 'product-listing', 'add-product'),
    sys => addTaskToProcess(sys, 'product-listing', 'update-product'),
    sys => addTaskToProcess(sys, 'order-processing', 'process-payment'),
    sys => addTaskToProcess(sys, 'order-processing', 'create-shipment'),
    sys => addTaskToProcess(sys, 'order-processing', 'send-confirmation-email'),
    sys => addTaskToProcess(sys, 'customer-registration', 'register-customer')
  );

  return system;
}

/**
 * Example 3: Creating a Process with ProcessBuilder
 * 
 * This example demonstrates how to create a process using the ProcessBuilder.
 */
export function createOrderProcessWithProcessBuilder() {
  const process = new ProcessBuilder('order-processing', 'Order Processing', 'orders', 'stateful')
    .withStates(['created', 'payment-pending', 'paid', 'shipped', 'delivered', 'cancelled'])
    .withTransition('created', 'payment-pending', 'checkout')
    .withTransition('payment-pending', 'paid', 'payment-received')
    .withTransition('paid', 'shipped', 'ship-order')
    .withTransition('shipped', 'delivered', 'delivery-confirmed')
    .withTransition('payment-pending', 'cancelled', 'cancel-order')
    .withTransition('paid', 'cancelled', 'cancel-order')
    .withTask('process-payment')
    .withTask('create-shipment')
    .withTask('send-confirmation-email')
    .build();

  return process;
}

/**
 * Example 4: Creating a Task with TaskBuilder
 * 
 * This example demonstrates how to create a task using the TaskBuilder.
 */
export function createPaymentTaskWithTaskBuilder() {
  const task = new TaskBuilder('process-payment')
    .withLabel('Process Payment')
    .withDescription('Process a payment for an order')
    .withType('operation')
    .withInput(['orderId', 'paymentMethod', 'amount'])
    .withOutput(['paymentId', 'status'])
    .build();

  return task;
}

/**
 * Example 5: Combining Builder and Functional Approaches
 * 
 * This example demonstrates how to combine both approaches for maximum flexibility.
 */
export function createHybridSystem() {
  // Start with functional approach to create the base system
  const baseSystem = pipe(
    createSystem('hybrid-system', 'Hybrid System', '1.0.0'),
    sys => addBoundedContext(sys, 'core', 'Core Domain')
  );
  
  // Continue with builder approach
  const finalSystem = SystemBuilder.create(baseSystem.id)
    .transform(() => baseSystem) // Use the existing system as a base
    .withProcess('main-process', 'core', 'Main Process')
    .withTask('main-task', 'Main Task')
    .withProcessTask('main-process', 'main-task')
    .build();
  
  return finalSystem;
}

/**
 * Run all examples and log the results
 */
export function runAllExamples() {
  console.log('Example 1: E-Commerce System using Builder Pattern');
  const builderSystem = createECommerceSystemWithBuilder();
  console.log(JSON.stringify(builderSystem, null, 2));
  
  console.log('\nExample 2: E-Commerce System using Functional Approach');
  const functionalSystem = createECommerceSystemWithFunctional();
  console.log(JSON.stringify(functionalSystem, null, 2));
  
  console.log('\nExample 3: Creating a Process with ProcessBuilder');
  const process = createOrderProcessWithProcessBuilder();
  console.log(JSON.stringify(process, null, 2));
  
  console.log('\nExample 4: Creating a Task with TaskBuilder');
  const task = createPaymentTaskWithTaskBuilder();
  console.log(JSON.stringify(task, null, 2));
  
  console.log('\nExample 5: Combining Builder and Functional Approaches');
  const hybridSystem = createHybridSystem();
  console.log(JSON.stringify(hybridSystem, null, 2));
}

// Uncomment to run all examples
// runAllExamples(); 