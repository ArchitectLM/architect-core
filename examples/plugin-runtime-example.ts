/**
 * Plugin-Enabled Runtime Example
 * 
 * This example demonstrates how to use the plugin-enabled runtime to extend
 * the system with custom functionality.
 */

import { System } from '../src/core/builders';
import { definePlugin } from '../src/core/dsl/plugin';
import { createPluginRuntime } from '../src/core/plugin-runtime';

// Define a logging plugin
const loggingPlugin = definePlugin({
  id: 'logging-plugin',
  name: 'Logging Plugin',
  description: 'Provides logging capabilities for the system',
  
  // Extension points
  hooks: {
    beforeTaskExecution: (task, input) => {
      console.log(`[LOG] Executing task: ${task.id} with input:`, input);
    },
    afterTaskExecution: (task, input, output) => {
      console.log(`[LOG] Task ${task.id} completed with output:`, output);
    },
    beforeProcessTransition: (process, event) => {
      console.log(`[LOG] Process ${process.id} transitioning on event: ${event.type}`);
    },
    afterProcessTransition: (process, event) => {
      const stateStr = typeof process.state === 'object' ? 
        JSON.stringify(process.state) : process.state;
      console.log(`[LOG] Process ${process.id} transitioned to state: ${stateStr}`);
    },
    onSystemStartup: () => {
      console.log('[LOG] System starting up');
    },
    onSystemShutdown: () => {
      console.log('[LOG] System shutting down');
    }
  }
});

// Define a metrics plugin
const metricsPlugin = definePlugin({
  id: 'metrics-plugin',
  name: 'Metrics Plugin',
  description: 'Collects metrics about system performance',
  
  // Custom services provided by this plugin
  services: {
    metricsService: {
      operations: {
        recordTaskExecution: (taskId: string, duration: number) => {
          console.log(`[METRICS] Task ${taskId} executed in ${duration}ms`);
        },
        recordProcessTransition: (processId: string, fromState: string, toState: string) => {
          console.log(`[METRICS] Process ${processId} transitioned from ${fromState} to ${toState}`);
        }
      }
    }
  },
  
  // Plugin initialization
  initialize: (runtime) => {
    console.log('[METRICS] Initializing metrics plugin');
    
    // Register additional hooks that use our service
    runtime.registerHook('afterTaskExecution', (task, input, output, context) => {
      const metricsService = runtime.getService('metricsService');
      if (metricsService && context.duration) {
        metricsService.operations.recordTaskExecution(task.id, context.duration);
      }
    });
  }
});

// Define a system
const orderSystem = System.create('order-system')
  .withDescription('Order processing system')
  .build();

// Create tasks
const validateOrderTask = {
  id: 'validate-order',
  name: 'Validate Order',
  implementation: async (input: any) => {
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { valid: true };
  }
};

const processPaymentTask = {
  id: 'process-payment',
  name: 'Process Payment',
  implementation: async (input: any) => {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 200));
    return { success: true, transactionId: 'tx-123' };
  }
};

// Define process
const orderProcess = {
  id: 'order-process',
  name: 'Order Process',
  states: [
    { name: 'created', type: 'normal' as const },
    { name: 'validated', type: 'normal' as const },
    { name: 'payment-processed', type: 'normal' as const },
    { name: 'completed', type: 'final' as const }
  ],
  transitions: [
    { from: 'created', to: 'validated', on: 'ORDER_VALIDATED' },
    { from: 'validated', to: 'payment-processed', on: 'PAYMENT_PROCESSED' },
    { from: 'payment-processed', to: 'completed', on: 'ORDER_COMPLETED' }
  ]
};

// Create a plugin-enabled runtime with the system, tasks, and plugins
const runtime = createPluginRuntime(
  { 'order-process': orderProcess },
  { 'validate-order': validateOrderTask, 'process-payment': processPaymentTask },
  [loggingPlugin, metricsPlugin]
);

// Simulate system execution
async function runExample() {
  console.log('Starting example...');
  
  // Create a process instance
  const process = runtime.createProcess('order-process', { orderId: '12345' });
  console.log(`Created process instance: ${process.id}`);
  
  // Simulate task execution
  await runtime.triggerHook('beforeTaskExecution', 
    { id: 'validate-order' }, 
    { orderId: '12345' }
  );
  
  const validationResult = await runtime.executeTask('validate-order', { orderId: '12345' });
  console.log('Validation result:', validationResult);
  
  await runtime.triggerHook('afterTaskExecution',
    { id: 'validate-order' },
    { orderId: '12345' },
    validationResult,
    { duration: 120 }
  );
  
  // Simulate process transition
  await runtime.triggerHook('beforeProcessTransition',
    { id: process.id, state: 'created' },
    { type: 'ORDER_VALIDATED' }
  );
  
  const updatedProcess = runtime.transitionProcess(process.id, 'ORDER_VALIDATED');
  const stateStr = typeof updatedProcess.state === 'object' ? 
    JSON.stringify(updatedProcess.state) : updatedProcess.state;
  console.log(`Process transitioned to: ${stateStr}`);
  
  await runtime.triggerHook('afterProcessTransition',
    { id: process.id, state: updatedProcess.state },
    { type: 'ORDER_VALIDATED' }
  );
  
  // Shutdown the system
  await runtime.shutdown();
  
  console.log('Example completed');
}

// Run the example
runExample().catch(console.error); 