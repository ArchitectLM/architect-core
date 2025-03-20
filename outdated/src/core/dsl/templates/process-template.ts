/**
 * Process Template
 * 
 * This file provides a template for defining processes using the DSL.
 * Follow this structure to create consistent and LLM-friendly process definitions.
 */

// =====================================================================
// PROCESS DEFINITION
// =====================================================================
// Define your process below. Use clear names and add comments to explain the purpose.

/**
 * Order Process
 * 
 * This process manages the lifecycle of an order from creation to completion.
 * It includes states for initial creation, processing, approval, and completion.
 */
const orderProcess = Process.create('order-process')
  // Add a description to explain the purpose of this process
  .withDescription('Manages the lifecycle of customer orders')
  
  // Set the initial state of the process
  .withInitialState('created')
  
  // -------------------------
  // STATES
  // -------------------------
  // Define all states of the process
  
  // Created state - Order has been created but not yet processed
  .addState('created')
  
  // Processing state - Order is being processed
  .addState('processing')
  
  // Approving state - Order is waiting for approval
  .addState('approving')
  
  // Completed state - Order has been completed
  .addState('completed')
  
  // Cancelled state - Order has been cancelled
  .addState('cancelled')
  
  // -------------------------
  // TRANSITIONS
  // -------------------------
  // Define all transitions between states
  
  // Start processing the order
  .addTransition({ 
    from: 'created', 
    to: 'processing', 
    on: 'START_PROCESSING' 
  })
  
  // Submit the order for approval
  .addTransition({ 
    from: 'processing', 
    to: 'approving', 
    on: 'SUBMIT_FOR_APPROVAL' 
  })
  
  // Approve the order
  .addTransition({ 
    from: 'approving', 
    to: 'completed', 
    on: 'APPROVE' 
  })
  
  // Reject the order
  .addTransition({ 
    from: 'approving', 
    to: 'processing', 
    on: 'REJECT' 
  })
  
  // Complete the order directly from processing
  .addTransition({ 
    from: 'processing', 
    to: 'completed', 
    on: 'COMPLETE' 
  })
  
  // Cancel the order from any state
  .addTransition({ 
    from: ['created', 'processing', 'approving'], 
    to: 'cancelled', 
    on: 'CANCEL' 
  })
  
  // -------------------------
  // METADATA
  // -------------------------
  // Add metadata to provide additional information
  .withMetadata({
    version: '1.0.0',
    owner: 'order-team',
    tags: ['order', 'e-commerce', 'core']
  })
  
  // Build the process
  .build();

// =====================================================================
// EXPORTS
// =====================================================================
// Export the process so it can be used in other files

// Export as default
export default orderProcess;

// Or export with a specific name
// export { orderProcess }; 