/**
 * Task Template
 * 
 * This file provides a template for defining tasks using the DSL.
 * Follow this structure to create consistent and LLM-friendly task definitions.
 */

// =====================================================================
// TASK DEFINITION
// =====================================================================
// Define your task below. Use clear names and add comments to explain the purpose.

/**
 * Process Order Task
 * 
 * This task processes an order by validating the items, checking inventory,
 * and preparing it for shipment.
 */
const processOrderTask = Task.create<OrderInput, OrderOutput>('process-order')
  // Add a description to explain the purpose of this task
  .withDescription('Processes an order for shipment')
  
  // -------------------------
  // IMPLEMENTATION
  // -------------------------
  // Define the implementation of the task
  .withImplementation(async (input, context) => {
    // Log the start of processing
    console.log(`Processing order ${input.orderId} for customer ${input.customerId}`);
    
    // Validate the input
    if (!input.orderId || !input.customerId) {
      return {
        success: false,
        message: 'Order ID and customer ID are required'
      };
    }
    
    // Check payment status
    if (input.paymentStatus !== 'paid') {
      return {
        success: false,
        message: 'Order must be paid before processing'
      };
    }
    
    // Process each item in the order
    const processedItems = input.items.map((item: OrderItem) => ({
      ...item,
      status: 'processed',
      processedAt: new Date().toISOString()
    }));
    
    // Return the result
    return {
      success: true,
      processedAt: new Date().toISOString(),
      estimatedShippingDate: new Date(Date.now() + 86400000).toISOString(), // 24 hours later
      items: processedItems
    };
  })
  
  // -------------------------
  // ERROR HANDLING
  // -------------------------
  // Define how errors should be handled
  .withErrorHandler(async (error, input, context) => {
    console.error(`Error processing order ${input.orderId}:`, error);
    // Additional error handling logic here
  })
  
  // -------------------------
  // RETRY POLICY
  // -------------------------
  // Define the retry policy for this task
  .withRetry({
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000
  })
  
  // -------------------------
  // METADATA
  // -------------------------
  // Add metadata to provide additional information
  .withMetadata({
    version: '1.0.0',
    owner: 'order-team',
    tags: ['order', 'processing', 'shipment']
  })
  
  // Build the task
  .build();

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================
// Define the types used in this task

/**
 * Order Item
 */
interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  status?: string;
  processedAt?: string;
}

/**
 * Order Input
 */
interface OrderInput {
  orderId: string;
  customerId: string;
  paymentStatus: string;
  items: OrderItem[];
}

/**
 * Order Output
 */
interface OrderOutput {
  success: boolean;
  message?: string;
  processedAt?: string;
  estimatedShippingDate?: string;
  items?: OrderItem[];
}

// =====================================================================
// EXPORTS
// =====================================================================
// Export the task so it can be used in other files

// Export as default
export default processOrderTask;

// Or export with a specific name
// export { processOrderTask }; 