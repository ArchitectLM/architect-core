/**
 * System template
 */

// Import the ReactiveSystem class from the DSL
import { ReactiveSystem } from '..';

/**
 * E-commerce system template
 * 
 * This is an example of a system definition using the DSL.
 */

// Define the e-commerce system
const ecommerceSystem = ReactiveSystem.define('ecommerce-system')
  .addProcess(ReactiveSystem.getProcess('order-process'))
  .addProcess(ReactiveSystem.getProcess('payment-process'))
  .addTask(ReactiveSystem.getTask('process-order'))
  .addTask(ReactiveSystem.getTask('process-payment'))
  .build();

export default ecommerceSystem;
