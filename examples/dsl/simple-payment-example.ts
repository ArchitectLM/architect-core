/**
 * Simple Payment Example
 * 
 * This file demonstrates a simple payment process using the DSL.
 */

// Define a payment process
const paymentProcess = Process.create('simple-payment')
  .withDescription('Simple payment process')
  .withInitialState('created')
  
  // Define states
  .addState('created')
  .addState('processing')
  .addState('completed')
  .addState('failed')
  
  // Define transitions
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
  .addTransition({ 
    from: 'processing', 
    to: 'failed', 
    on: 'FAIL' 
  })
  .build();

// Define a payment task
const paymentTask = Task.create('simple-payment-task')
  .withDescription('Process a payment')
  .withImplementation((input) => {
    console.log(`Processing payment: ${input.id}`);
    return { success: true };
  })
  .build();

// Define a payment system
const paymentSystem = ReactiveSystem.define('simple-payment-system')
  .withName('Simple Payment System')
  .withDescription('A simple system for processing payments')
  .addProcess(paymentProcess)
  .addTask(paymentTask)
  .build();

// Export the components
export {
  paymentProcess,
  paymentTask,
  paymentSystem
}; 