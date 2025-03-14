/**
 * ESM Example
 * 
 * This file demonstrates a simple example using ESM modules.
 */

// Define a simple process
const orderProcess = Process.create('order-process')
  .withDescription('Manages the lifecycle of customer orders')
  .withInitialState('created')
  .addState('created')
  .addState('processing')
  .addState('completed')
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
  .build();

// Define a simple task
const processOrderTask = Task.create('process-order')
  .withDescription('Processes an order for shipment')
  .withImplementation((input, context) => {
    console.log(`Processing order ${input.orderId}`);
    return {
      success: true,
      processedAt: new Date().toISOString()
    };
  })
  .build();

// Define a simple system
const orderSystem = ReactiveSystem.define('order-system')
  .withName('Order System')
  .withDescription('A system for managing orders')
  .addProcess(orderProcess)
  .addTask(processOrderTask)
  .build();

// Export the components
export {
  orderProcess,
  processOrderTask,
  orderSystem
}; 