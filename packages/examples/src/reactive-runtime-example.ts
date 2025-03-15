/**
 * Reactive Runtime Example
 * 
 * This example demonstrates how to use the new ReactiveRuntime with the ProcessManager and TaskManager.
 */

import { createRuntime } from '../src/core/implementations/runtime';
import { ProcessDefinition, TaskDefinition, TaskContext } from '../src/core/models';

// Define a process for order processing
const orderProcess: ProcessDefinition = {
  id: 'order-process',
  name: 'Order Processing',
  description: 'Process customer orders',
  states: [
    { name: 'created', description: 'Order has been created' },
    { name: 'processing', description: 'Order is being processed' },
    { name: 'shipped', description: 'Order has been shipped' },
    { name: 'completed', description: 'Order has been completed' },
    { name: 'cancelled', description: 'Order has been cancelled' }
  ],
  initialState: 'created',
  transitions: [
    { 
      from: 'created', 
      to: 'processing', 
      on: 'START_PROCESSING',
      description: 'Start processing the order'
    },
    { 
      from: 'processing', 
      to: 'shipped', 
      on: 'SHIP_ORDER',
      description: 'Ship the order'
    },
    { 
      from: 'shipped', 
      to: 'completed', 
      on: 'COMPLETE_ORDER',
      description: 'Complete the order'
    },
    { 
      from: '*', 
      to: 'cancelled', 
      on: 'CANCEL_ORDER',
      description: 'Cancel the order from any state'
    }
  ]
};

// Define tasks for order processing
const processOrderTask: TaskDefinition = {
  id: 'process-order',
  name: 'Process Order',
  description: 'Process a customer order',
  implementation: async (input: any, context: TaskContext) => {
    console.log(`Processing order ${input.orderId}...`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Emit an event to trigger the next step
    context.emitEvent('SHIP_ORDER', { orderId: input.orderId });
    
    return { 
      processed: true, 
      orderId: input.orderId,
      processingId: `proc-${input.orderId}`
    };
  }
};

const shipOrderTask: TaskDefinition = {
  id: 'ship-order',
  name: 'Ship Order',
  description: 'Ship a processed order',
  implementation: async (input: any, context: TaskContext) => {
    console.log(`Shipping order ${input.orderId}...`);
    
    // Simulate shipping time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Emit an event to trigger the next step
    context.emitEvent('COMPLETE_ORDER', { orderId: input.orderId });
    
    return { 
      shipped: true, 
      orderId: input.orderId,
      trackingId: `track-${input.orderId}`
    };
  }
};

// Main function
async function main() {
  console.log('Starting order processing example with ReactiveRuntime...');
  
  // Create the runtime
  const runtime = createRuntime(
    { 'order-process': orderProcess },
    { 
      'process-order': processOrderTask,
      'ship-order': shipOrderTask
    }
  );
  
  // Subscribe to events
  runtime.subscribe('*', (event) => {
    console.log(`Event received: ${event.type}`, event.payload);
  });
  
  // Create a new order process
  const orderInstance = runtime.createProcess('order-process', { 
    orderId: '12345',
    customer: 'John Doe',
    items: [
      { id: 'item-1', name: 'Product A', quantity: 2 },
      { id: 'item-2', name: 'Product B', quantity: 1 }
    ]
  });
  
  console.log('Order process created:', orderInstance);
  
  // Start processing the order
  console.log('Starting order processing...');
  runtime.transitionProcess(orderInstance.id, 'START_PROCESSING');
  
  // Execute the process order task
  console.log('Executing process order task...');
  const processResult = await runtime.executeTask('process-order', { 
    orderId: orderInstance.id 
  });
  
  console.log('Process result:', processResult);
  
  // Execute the ship order task
  console.log('Executing ship order task...');
  const shipResult = await runtime.executeTask('ship-order', { 
    orderId: orderInstance.id 
  });
  
  console.log('Ship result:', shipResult);
  
  // Get the final process state
  const finalInstance = runtime.getProcess(orderInstance.id);
  console.log('Final process state:', finalInstance);
}

// Run the example
main().catch(console.error);
