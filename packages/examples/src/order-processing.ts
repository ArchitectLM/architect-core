/**
 * Example: Order Processing System
 * 
 * This example demonstrates how to use ArchitectLM to build a simple order processing system.
 */
import { 
  defineProcess, 
  defineTask, 
  defineSystem, 
  createRuntime,
  ProcessDefinition,
  TaskDefinition
} from '../src/core';

// Define the order process
const orderProcess: ProcessDefinition = {
  id: 'order-process',
  states: ['created', 'processing', 'completed', 'cancelled'],
  initialState: 'created',
  transitions: [
    { from: 'created', to: 'processing', on: 'START_PROCESSING' },
    { from: 'processing', to: 'completed', on: 'COMPLETE' },
    { from: 'processing', to: 'cancelled', on: 'CANCEL' },
    { from: 'created', to: 'cancelled', on: 'CANCEL' }
  ],
  description: 'Order processing workflow'
};

// Define the shipment process
const shipmentProcess: ProcessDefinition = {
  id: 'shipment-process',
  states: ['pending', 'shipped', 'delivered'],
  initialState: 'pending',
  transitions: [
    { from: 'pending', to: 'shipped', on: 'SHIP' },
    { from: 'shipped', to: 'delivered', on: 'DELIVER' }
  ],
  description: 'Shipment workflow'
};

// Define the process order task
const processOrderTask: TaskDefinition = {
  id: 'process-order',
  implementation: async (input, context) => {
    console.log(`Processing order ${input.orderId}...`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Emit an event to trigger the process transition
    context.emitEvent('COMPLETE', { 
      orderId: input.orderId,
      processedAt: new Date().toISOString()
    });
    
    return { 
      processed: true, 
      orderId: input.orderId,
      processedAt: new Date().toISOString()
    };
  }
};

// Define the ship order task
const shipOrderTask: TaskDefinition = {
  id: 'ship-order',
  implementation: async (input, context) => {
    console.log(`Shipping order ${input.orderId}...`);
    
    // Simulate shipping time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Emit an event to trigger the shipment process transition
    context.emitEvent('SHIP', { 
      orderId: input.orderId,
      shippedAt: new Date().toISOString(),
      trackingNumber: `TRK-${Math.floor(Math.random() * 1000000)}`
    });
    
    return { 
      shipped: true, 
      orderId: input.orderId,
      shippedAt: new Date().toISOString(),
      trackingNumber: `TRK-${Math.floor(Math.random() * 1000000)}`
    };
  }
};

// Define the deliver order task
const deliverOrderTask: TaskDefinition = {
  id: 'deliver-order',
  implementation: async (input, context) => {
    console.log(`Delivering order ${input.orderId}...`);
    
    // Simulate delivery time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Emit an event to trigger the shipment process transition
    context.emitEvent('DELIVER', { 
      orderId: input.orderId,
      deliveredAt: new Date().toISOString()
    });
    
    return { 
      delivered: true, 
      orderId: input.orderId,
      deliveredAt: new Date().toISOString()
    };
  }
};

// Create the system
const system = defineSystem({
  id: 'order-system',
  description: 'Order processing system',
  processes: {
    'order-process': orderProcess,
    'shipment-process': shipmentProcess
  },
  tasks: {
    'process-order': processOrderTask,
    'ship-order': shipOrderTask,
    'deliver-order': deliverOrderTask
  }
});

// Create the runtime
const runtime = createRuntime(
  { 
    'order-process': orderProcess,
    'shipment-process': shipmentProcess
  },
  {
    'process-order': processOrderTask,
    'ship-order': shipOrderTask,
    'deliver-order': deliverOrderTask
  }
);

// Subscribe to events
runtime.subscribeToEvent('*', (event) => {
  console.log(`Event: ${event.type}`, event.payload);
});

// Main function to run the example
async function runExample() {
  console.log('Starting order processing example...');
  
  // Create an order process instance
  const orderInstance = runtime.createProcess('order-process', { 
    orderId: '12345',
    customer: 'John Doe',
    items: [
      { id: 'item-1', name: 'Product A', quantity: 2, price: 25.99 },
      { id: 'item-2', name: 'Product B', quantity: 1, price: 49.99 }
    ],
    total: 101.97
  });
  
  console.log(`Created order process instance: ${orderInstance.id}`);
  
  // Create a shipment process instance
  const shipmentInstance = runtime.createProcess('shipment-process', {
    orderId: '12345',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345'
    }
  });
  
  console.log(`Created shipment process instance: ${shipmentInstance.id}`);
  
  // Start processing the order
  console.log('Starting order processing...');
  runtime.transitionProcess(orderInstance.id, 'START_PROCESSING');
  
  // Execute the process order task
  console.log('Executing process-order task...');
  const processResult = await runtime.executeTask('process-order', { 
    orderId: '12345'
  });
  
  console.log('Process order result:', processResult);
  
  // Execute the ship order task
  console.log('Executing ship-order task...');
  const shipResult = await runtime.executeTask('ship-order', { 
    orderId: '12345'
  });
  
  console.log('Ship order result:', shipResult);
  
  // Execute the deliver order task
  console.log('Executing deliver-order task...');
  const deliverResult = await runtime.executeTask('deliver-order', { 
    orderId: '12345',
    trackingNumber: shipResult.trackingNumber
  });
  
  console.log('Deliver order result:', deliverResult);
  
  // Get the final state of the processes
  const finalOrderInstance = runtime.getProcess(orderInstance.id);
  const finalShipmentInstance = runtime.getProcess(shipmentInstance.id);
  
  console.log('Final order process state:', finalOrderInstance?.state);
  console.log('Final shipment process state:', finalShipmentInstance?.state);
  
  console.log('Order processing example completed!');
}

// Run the example
runExample().catch(error => {
  console.error('Error running example:', error);
}); 