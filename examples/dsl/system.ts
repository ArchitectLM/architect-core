/**
 * Example DSL System Definition
 * 
 * This file contains an example system definition that combines the order process and task.
 */

// Using global defined functions
// No imports needed

// Get the process and task from the registry
const orderProcess = ReactiveSystem.getProcess('orderProcess');
const processOrderTask = ReactiveSystem.getTask('process-order');

// Define the e-commerce system
const ecommerceSystem = ReactiveSystem.define('ecommerce-system')
  .withName('E-commerce System')
  .withDescription('A system for managing e-commerce operations')
  .withMetadata({
    version: '1.0.0',
    author: 'ArchitectLM',
    tags: ['e-commerce', 'orders', 'processing']
  })
  // Add the process and task to the system
  .addProcess(orderProcess)
  .addTask(processOrderTask)
  .build();

export default ecommerceSystem; 