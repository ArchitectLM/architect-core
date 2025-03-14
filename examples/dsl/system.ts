/**
 * Example DSL System Definition
 * 
 * This file contains an example system definition that combines the order process and task.
 */

// Import the ReactiveSystem namespace
import { ReactiveSystem } from '../../src/core/dsl/reactive-system';
import orderProcess from './process';
import processOrderTask from './task';

// Define the e-commerce system
const ecommerceSystem = ReactiveSystem.define('ecommerce-system')
  .withName('E-commerce System')
  .withDescription('A system for managing e-commerce operations')
  .withMetadata({
    version: '1.0.0',
    author: 'ArchitectLM',
    tags: ['e-commerce', 'orders', 'processing']
  })
  .withProcess(orderProcess)
  .withTask(processOrderTask)
  .build();

export default ecommerceSystem; 