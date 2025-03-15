/**
 * ArchitectLM Fluent API Example
 * 
 * This example demonstrates how to use the new fluent API to define a simple
 * e-commerce system with order processing.
 */
import { z } from 'zod';
import { Process, Task, System, Test, createRuntime } from '../src';

// Define schemas for validation
const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive()
});

const orderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(orderItemSchema),
  totalAmount: z.number().positive(),
  status: z.enum(['pending', 'paid', 'fulfilled', 'cancelled']).optional()
});

// Define the order process
const orderProcess = Process.create('order-process')
  .withDescription('Handles the lifecycle of an order from creation to fulfillment')
  .withInitialState('created')
  .addState('created', { 
    description: 'Order has been created but not yet processed',
    onEnter: async (context) => {
      console.log(`Order ${context.orderId} created`);
    }
  })
  .addState('processing', { 
    description: 'Order is being processed by the system',
    onEnter: async (context) => {
      console.log(`Processing order ${context.orderId}`);
    }
  })
  .addState('completed', { 
    description: 'Order has been successfully completed',
    onEnter: async (context) => {
      console.log(`Order ${context.orderId} completed`);
    }
  })
  .addState('cancelled', { 
    description: 'Order has been cancelled',
    onEnter: async (context) => {
      console.log(`Order ${context.orderId} cancelled`);
    }
  })
  .addTransition({
    from: 'created',
    to: 'processing',
    on: 'START_PROCESSING',
    description: 'Begin processing the order',
    guard: (context) => context.items.length > 0
  })
  .addTransition({
    from: 'processing',
    to: 'completed',
    on: 'COMPLETE',
    description: 'Complete the order'
  })
  .addTransition({
    from: 'processing',
    to: 'cancelled',
    on: 'CANCEL',
    description: 'Cancel the order during processing'
  })
  .addSimpleTransition('created', 'cancelled', 'CANCEL')
  .withContextSchema(orderSchema)
  .withMetadata({
    version: '1.0.0',
    owner: 'order-team',
    tags: ['critical', 'core']
  })
  .withLLMMetadata({
    domainConcepts: ['order', 'fulfillment', 'inventory'],
    businessRules: [
      'Orders must have at least one item',
      'Orders can be cancelled at any point before completion',
      'Order total must be greater than zero'
    ]
  })
  .build();

// Define tasks
const validateOrderTask = Task.create('validate-order')
  .withDescription('Validates an order before processing')
  .withInputSchema(orderSchema)
  .withImplementation(async (order, context) => {
    console.log(`Validating order ${order.orderId}`);
    
    // Validate order items
    if (order.items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    
    // Validate total amount
    const calculatedTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (Math.abs(calculatedTotal - order.totalAmount) > 0.01) {
      throw new Error('Order total amount does not match calculated total');
    }
    
    // Emit event to start processing
    context.emitEvent('START_PROCESSING', { orderId: order.orderId });
    
    return { 
      valid: true, 
      orderId: order.orderId 
    };
  })
  .withErrorHandler(async (error, order, context) => {
    console.error(`Order validation failed: ${error.message}`);
    context.emitEvent('VALIDATION_FAILED', { 
      orderId: order.orderId, 
      error: error.message 
    });
  })
  .build();

const processOrderTask = Task.create('process-order')
  .withDescription('Processes an order for fulfillment')
  .withInputSchema(orderSchema)
  .withImplementation(async (order, context) => {
    console.log(`Processing order ${order.orderId}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update order status
    const updatedOrder = {
      ...order,
      status: 'fulfilled'
    };
    
    // Emit event to complete the order
    context.emitEvent('COMPLETE', { orderId: order.orderId });
    
    return { 
      processed: true, 
      order: updatedOrder 
    };
  })
  .withTimeout(5000)
  .withRetry({
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000
  })
  .build();

// Define the system
const ecommerceSystem = System.create('ecommerce')
  .withName('E-Commerce System')
  .withDescription('E-commerce system for order processing')
  .addProcess(orderProcess)
  .addTask(validateOrderTask)
  .addTask(processOrderTask)
  .withObservability({
    metrics: true,
    logging: {
      level: 'info',
      format: 'json'
    }
  })
  .withMetadata({
    version: '1.0.0',
    owner: 'platform-team',
    tags: ['core', 'critical']
  })
  .build();

// Define a test
const orderFlowTest = Test.create('complete-order-flow')
  .withDescription('Tests the complete order processing flow')
  .withSystem(ecommerceSystem)
  .createProcess('order-process', { 
    orderId: '12345',
    customerId: 'cust-1',
    items: [
      { productId: 'prod-1', quantity: 2, price: 10.99 },
      { productId: 'prod-2', quantity: 1, price: 24.99 }
    ],
    totalAmount: 46.97
  })
  .executeTask('validate-order', { 
    orderId: '12345',
    customerId: 'cust-1',
    items: [
      { productId: 'prod-1', quantity: 2, price: 10.99 },
      { productId: 'prod-2', quantity: 1, price: 24.99 }
    ],
    totalAmount: 46.97
  })
  .verifyState('processing')
  .executeTask('process-order', { 
    orderId: '12345',
    customerId: 'cust-1',
    items: [
      { productId: 'prod-1', quantity: 2, price: 10.99 },
      { productId: 'prod-2', quantity: 1, price: 24.99 }
    ],
    totalAmount: 46.97
  })
  .verifyState('completed')
  .expectFinalState('completed')
  .expectEvents(['START_PROCESSING', 'COMPLETE'])
  .build();

// Example usage with runtime (would be implemented in a real application)
async function runExample() {
  console.log('Creating runtime...');
  // Note: This is a mock implementation for the example
  // In a real application, you would use the actual createRuntime function
  // with the appropriate parameters based on your runtime implementation
  const runtime = createRuntime(ecommerceSystem);
  
  console.log('Creating order process instance...');
  const order = {
    orderId: '12345',
    customerId: 'cust-1',
    items: [
      { productId: 'prod-1', quantity: 2, price: 10.99 },
      { productId: 'prod-2', quantity: 1, price: 24.99 }
    ],
    totalAmount: 46.97
  };
  
  const instance = runtime.createProcess('order-process', order);
  console.log(`Created process instance: ${instance.id} in state: ${instance.state}`);
  
  console.log('Executing validate-order task...');
  try {
    const validationResult = await runtime.executeTask('validate-order', order);
    console.log('Validation result:', validationResult);
    
    // Get updated instance after validation
    const updatedInstance = runtime.getProcess(instance.id);
    console.log(`Process state after validation: ${updatedInstance?.state}`);
    
    if (updatedInstance?.state === 'processing') {
      console.log('Executing process-order task...');
      const processResult = await runtime.executeTask('process-order', order);
      console.log('Processing result:', processResult);
      
      // Get final instance state
      const finalInstance = runtime.getProcess(instance.id);
      console.log(`Final process state: ${finalInstance?.state}`);
    }
  } catch (error) {
    console.error('Error during execution:', error);
  }
}

// Uncomment to run the example
// runExample().catch(console.error);

// Export the components for use in other examples
export {
  orderProcess,
  validateOrderTask,
  processOrderTask,
  ecommerceSystem,
  orderFlowTest
}; 