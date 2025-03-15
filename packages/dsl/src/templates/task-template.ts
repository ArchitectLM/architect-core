/**
 * Task template
 */

// Import the Task class from the DSL
import { Task } from '..';

/**
 * Order input
 */
interface OrderInput {
  orderId: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
}

/**
 * Order output
 */
interface OrderOutput {
  processed: boolean;
  orderId: string;
}

/**
 * Process order task template
 * 
 * This is an example of a task definition using the DSL.
 */

// Define the process order task
const processOrderTask = Task.create<OrderInput, OrderOutput>('process-order')
  .withDescription('Processes an order')
  .withImplementation(async (input: OrderInput, context: any) => {
    // Process the order
    console.log('Processing order:', input.orderId);
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if all items are available
    const allItemsAvailable = input.items.every(item => {
      // In a real implementation, this would check inventory
      return true;
    });
    
    if (!allItemsAvailable) {
      throw new Error('Some items are not available');
    }
    
    // Emit an event to indicate the order has been processed
    context.emitEvent('ORDER_PROCESSED', { orderId: input.orderId });
    
    // Return the result
    return {
      processed: true,
      orderId: input.orderId
    };
  })
  .withErrorHandler(async (error: any, input: OrderInput, context: any) => {
    // Handle the error
    console.error('Error processing order:', error);
    
    // Emit an event to indicate the order processing failed
    context.emitEvent('ORDER_PROCESSING_FAILED', { 
      orderId: input.orderId,
      error: error.message
    });
    
    // Return a failure result
    return {
      processed: false,
      orderId: input.orderId
    };
  })
  .build();

export default processOrderTask;
