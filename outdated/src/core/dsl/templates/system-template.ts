/**
 * System Template
 * 
 * This file provides a template for defining reactive systems using the DSL.
 * Follow this structure to create consistent and LLM-friendly system definitions.
 */

// =====================================================================
// SYSTEM DEFINITION
// =====================================================================
// Define your system below. Use clear names and add comments to explain the purpose.

/**
 * E-commerce System
 * 
 * This system manages the e-commerce operations, including order processing,
 * payment handling, and inventory management.
 */
const ecommerceSystem = ReactiveSystem.define('ecommerce-system')
  // Add a name and description to explain the purpose of this system
  .withName('E-commerce System')
  .withDescription('A system for managing e-commerce operations')
  
  // -------------------------
  // PROCESSES
  // -------------------------
  // Reference processes by ID
  
  // Get the order process from the registry
  .addProcess(ReactiveSystem.getProcess('order-process'))
  
  // Get the payment process from the registry
  .addProcess(ReactiveSystem.getProcess('payment-process'))
  
  // -------------------------
  // TASKS
  // -------------------------
  // Reference tasks by ID
  
  // Get the process order task from the registry
  .addTask(ReactiveSystem.getTask('process-order'))
  
  // Get the payment task from the registry
  .addTask(ReactiveSystem.getTask('process-payment'))
  
  // -------------------------
  // METADATA
  // -------------------------
  // Add metadata to provide additional information
  .withMetadata({
    version: '1.0.0',
    owner: 'e-commerce-team',
    tags: ['e-commerce', 'orders', 'payments']
  })
  
  // Build the system
  .build();

// =====================================================================
// EXPORTS
// =====================================================================
// Export the system so it can be used in other files

// Export as default
export default ecommerceSystem;

// Or export with a specific name
// export { ecommerceSystem }; 