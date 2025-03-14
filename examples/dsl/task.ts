/**
 * Example DSL Task Definition
 * 
 * This file contains an example task definition for processing orders.
 */

// Using global defined functions
// No imports needed

const processOrderTask = ReactiveSystem.define('process-order-system')
  .withTask('process-order')
  .withName('Process Order')
  .withDescription('Processes an order for shipment')
  .implementation(async (input, context) => {
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
  .build();

export default processOrderTask; 