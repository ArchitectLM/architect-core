#!/usr/bin/env node
/**
 * Implementation Composability CLI Runner
 * 
 * This CLI demonstrates the execution of the implementation composability example.
 * It runs both production and test environments to show how implementation
 * selection works with the unified component approach.
 */
import { runExample } from './implementation-composability.js';

// Header
console.log('===================================');
console.log('Unified Component Approach Example');
console.log('===================================');
console.log('This example demonstrates how implementations can be composed');
console.log('or extended using the unified component approach.\n');

// Run the example
(async () => {
  try {
    console.log('Running example...\n');
    await runExample();
    console.log('\nExample completed successfully.');
  } catch (error) {
    console.error('Error running example:', error);
    process.exit(1);
  }
})(); 