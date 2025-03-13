/**
 * Enhanced Plugin System Example
 * 
 * This example demonstrates how to use the enhanced plugin system to extend
 * the reactive system with custom functionality.
 */

import { System } from '../src/core/builders';
import { definePlugin } from '../src/core/dsl/plugin';
import { createRuntime } from '../src/core/runtime/runtime';

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
      console.log(`[LOG] Process ${process.id} transitioned to state: ${process.currentState}`);
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

// Define a system with the plugins
const orderSystem = System.create('order-system')
  .withDescription('Order processing system')
  .withPlugin(loggingPlugin)
  .withPlugin(metricsPlugin)
  // Define tasks, processes, etc.
  .withTask('validate-order')
    .withImplementation(async (input) => {
      // Simulate validation
      await new Promise(resolve => setTimeout(resolve, 100));
      return { valid: true };
    })
    .build()
  .withTask('process-payment')
    .withImplementation(async (input) => {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true, transactionId: 'tx-123' };
    })
    .build()
  .withProcess('order-process')
    .withInitialState('created')
    .addState('created')
    .addState('validated')
    .addState('payment-processed')
    .addState('completed', { isFinal: true })
    .addSimpleTransition('created', 'validated', 'ORDER_VALIDATED')
    .addSimpleTransition('validated', 'payment-processed', 'PAYMENT_PROCESSED')
    .addSimpleTransition('payment-processed', 'completed', 'ORDER_COMPLETED')
    .build()
  .build();

// Create a runtime with the system
const runtime = createRuntime(orderSystem);

// Simulate system execution
async function runExample() {
  console.log('Starting example...');
  
  // Simulate task execution
  await runtime.triggerHook('beforeTaskExecution', 
    { id: 'validate-order' }, 
    { orderId: '12345' }
  );
  
  await runtime.triggerHook('afterTaskExecution',
    { id: 'validate-order' },
    { orderId: '12345' },
    { valid: true },
    { duration: 120 }
  );
  
  // Simulate process transition
  await runtime.triggerHook('beforeProcessTransition',
    { id: 'order-process', currentState: 'created' },
    { type: 'ORDER_VALIDATED' }
  );
  
  await runtime.triggerHook('afterProcessTransition',
    { id: 'order-process', currentState: 'validated' },
    { type: 'ORDER_VALIDATED' }
  );
  
  // Shutdown the system
  await runtime.shutdown();
  
  console.log('Example completed');
}

// Run the example
runExample().catch(console.error); 