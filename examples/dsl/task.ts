/**
 * Example DSL Task Definition
 * 
 * This file contains an example task definition for processing orders.
 */

// Import the ReactiveSystem namespace
import { ReactiveSystem } from '../../src/core/dsl/reactive-system';

// Define the process order task
const processOrderTask = ReactiveSystem.define('process-order-system')
  .withTask('process-order')
  .withName('Process Order')
  .withDescription('Processes an order for shipment')
  .implementation(async (input: { 
    orderId: string;
    customerId: string;
    items: any[];
    paymentStatus: string;
  }, context: any) => {
    // Process the order
    console.log(`Processing order ${input.orderId} for customer ${input.customerId}`);
    
    // Check payment status
    if (input.paymentStatus !== 'paid') {
      return {
        success: false,
        message: 'Order must be paid before processing'
      };
    }
    
    // Process each item
    const processedItems = input.items.map(item => ({
      ...item,
      status: 'processed'
    }));
    
    // Return the result
    return {
      success: true,
      processedAt: new Date().toISOString(),
      estimatedShippingDate: new Date(Date.now() + 86400000).toISOString(), // 24 hours later
      items: processedItems
    };
  })
  .test('unit', (task) => [
    {
      name: 'Successfully process a paid order',
      setup: () => ({
        input: {
          orderId: 'order-123',
          customerId: 'customer-456',
          items: [
            { id: 'item-1', name: 'Product 1', quantity: 2 },
            { id: 'item-2', name: 'Product 2', quantity: 1 }
          ],
          paymentStatus: 'paid'
        },
        context: {}
      }),
      execute: async (setup) => task(setup.input, setup.context),
      verify: (result) => {
        if (!result.success) {
          throw new Error(`Expected success to be true, got ${result.success}`);
        }
        
        if (!result.processedAt) {
          throw new Error('Expected processedAt to be defined');
        }
        
        if (!result.estimatedShippingDate) {
          throw new Error('Expected estimatedShippingDate to be defined');
        }
        
        if (result.items.length !== 2) {
          throw new Error(`Expected 2 items, got ${result.items.length}`);
        }
        
        if (result.items[0].status !== 'processed') {
          throw new Error(`Expected item status to be 'processed', got ${result.items[0].status}`);
        }
      }
    },
    {
      name: 'Fail to process an unpaid order',
      setup: () => ({
        input: {
          orderId: 'order-123',
          customerId: 'customer-456',
          items: [
            { id: 'item-1', name: 'Product 1', quantity: 2 },
            { id: 'item-2', name: 'Product 2', quantity: 1 }
          ],
          paymentStatus: 'pending'
        },
        context: {}
      }),
      execute: async (setup) => task(setup.input, setup.context),
      verify: (result) => {
        if (result.success) {
          throw new Error(`Expected success to be false, got ${result.success}`);
        }
        
        if (result.message !== 'Order must be paid before processing') {
          throw new Error(`Expected specific error message, got ${result.message}`);
        }
      }
    }
  ])
  .build();

export default processOrderTask;