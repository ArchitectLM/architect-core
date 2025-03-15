/**
 * Service Integration Extension Example
 * 
 * This example demonstrates how to use the Service Integration extension to integrate
 * with external services like payment processors, shipping providers, and more.
 * 
 * The example shows:
 * 1. How to register services using both direct configuration and the fluent API
 * 2. How to execute operations on services with retry policies
 * 3. How to handle webhooks from external services
 * 4. How to integrate services with the reactive system DSL
 * 
 * Key concepts demonstrated:
 * - Service registration and configuration
 * - Service operations with retry policies
 * - Webhook handling
 * - Integration with the reactive system DSL
 * - Process state transitions based on task completion
 * - Event-driven architecture
 * 
 * Note: In this example, we manually emit the 'task.completed' event in each task
 * implementation to trigger state transitions. This is necessary because the runtime
 * automatically emits the event, but it doesn't automatically trigger the transition.
 */

import { createServiceIntegration, ServiceType } from '../src/core/extensions';
import { Service } from '../src/core/builders';
import { ReactiveSystem } from '../src/core/dsl/reactive-system';
import { createAssembler } from '../src/core/dsl/assembler';
import { createRuntime } from '../src/core/dsl/runtime';

async function main() {
  console.log('Starting Service Integration Example...');
  
  // Create a service integration extension
  const serviceIntegration = createServiceIntegration({
    defaultRetryPolicy: {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelayMs: 100,
      maxDelayMs: 2000,
      factor: 2
    }
  });
  
  // -----------------------------------------------
  // Example 1: Register a payment service directly
  // -----------------------------------------------
  console.log('\n1. Registering a payment service directly...');
  
  const stripeService = serviceIntegration.registerService('stripe', {
    type: ServiceType.PAYMENT_PROCESSOR,
    provider: 'stripe',
    config: {
      apiKey: 'sk_test_example',
      webhookSecret: 'whsec_example'
    },
    operations: {
      createPayment: async (input) => {
        console.log(`Creating payment with Stripe: ${JSON.stringify(input)}`);
        // In a real implementation, this would call the Stripe API
        return {
          id: 'pi_' + Math.random().toString(36).substring(2, 15),
          amount: input.amount,
          currency: input.currency,
          status: 'succeeded'
        };
      },
      refundPayment: async (input) => {
        console.log(`Refunding payment with Stripe: ${JSON.stringify(input)}`);
        // In a real implementation, this would call the Stripe API
        return {
          id: 're_' + Math.random().toString(36).substring(2, 15),
          payment_intent: input.paymentId,
          amount: input.amount,
          status: 'succeeded'
        };
      }
    },
    retryPolicy: {
      maxAttempts: 5,
      backoff: 'exponential',
      initialDelayMs: 200,
      maxDelayMs: 5000,
      factor: 2
    },
    webhookHandler: {
      path: '/webhooks/stripe',
      secret: 'whsec_example',
      handlers: {
        'payment_intent.succeeded': (event) => {
          console.log(`Received payment_intent.succeeded webhook: ${JSON.stringify(event.data)}`);
        },
        'payment_intent.failed': (event) => {
          console.log(`Received payment_intent.failed webhook: ${JSON.stringify(event.data)}`);
        }
      }
    }
  });
  
  console.log(`Registered Stripe service: ${stripeService.id}`);
  
  // -----------------------------------------------
  // Example 2: Register a shipping service using the fluent API
  // -----------------------------------------------
  console.log('\n2. Registering a shipping service using the fluent API...');
  
  const fedexServiceConfig = Service.create('fedex')
    .withType(ServiceType.SHIPPING_PROVIDER)
    .withProvider('fedex')
    .withConfig({
      accountNumber: 'fedex_account_example',
      apiKey: 'fedex_api_key_example'
    })
    .withOperation('createShipment', async (input) => {
      console.log(`Creating shipment with FedEx: ${JSON.stringify(input)}`);
      // In a real implementation, this would call the FedEx API
      return {
        id: 'ship_' + Math.random().toString(36).substring(2, 15),
        trackingNumber: Math.random().toString().substring(2, 12),
        label: 'https://example.com/shipping-label.pdf'
      };
    })
    .withOperation('trackShipment', async (input) => {
      console.log(`Tracking shipment with FedEx: ${JSON.stringify(input)}`);
      // In a real implementation, this would call the FedEx API
      return {
        trackingNumber: input.trackingNumber,
        status: 'in_transit',
        estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString() // 2 days from now
      };
    })
    .withRetryPolicy({
      maxAttempts: 3,
      backoff: 'linear',
      initialDelayMs: 300,
      maxDelayMs: 3000,
      factor: 1.5
    })
    .build();
  
  const fedexService = serviceIntegration.registerService('fedex', fedexServiceConfig);
  console.log(`Registered FedEx service: ${fedexService.id}`);
  
  // -----------------------------------------------
  // Example 3: Execute operations on services
  // -----------------------------------------------
  console.log('\n3. Executing operations on services...');
  
  // Execute a payment operation
  try {
    const paymentResult = await serviceIntegration.executeOperation('stripe', 'createPayment', {
      amount: 2999,
      currency: 'usd',
      paymentMethod: 'pm_card_visa'
    });
    
    console.log(`Payment created successfully: ${JSON.stringify(paymentResult)}`);
    
    // Execute a shipping operation
    const shipmentResult = await serviceIntegration.executeOperation('fedex', 'createShipment', {
      recipient: {
        name: 'John Doe',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        }
      },
      package: {
        weight: 2.5,
        dimensions: {
          length: 12,
          width: 8,
          height: 6
        }
      }
    });
    
    console.log(`Shipment created successfully: ${JSON.stringify(shipmentResult)}`);
    
    // Track the shipment
    const trackingResult = await serviceIntegration.executeOperation('fedex', 'trackShipment', {
      trackingNumber: shipmentResult.trackingNumber
    });
    
    console.log(`Tracking information: ${JSON.stringify(trackingResult)}`);
  } catch (error) {
    console.error('Error executing service operations:', error);
  }
  
  // -----------------------------------------------
  // Example 4: Process webhook events
  // -----------------------------------------------
  console.log('\n4. Processing webhook events...');
  
  // Simulate receiving a webhook from Stripe
  try {
    await serviceIntegration.processWebhookEvent('stripe', {
      type: 'payment_intent.succeeded',
      data: {
        id: 'pi_example',
        amount: 2999,
        currency: 'usd',
        status: 'succeeded'
      }
    });
    
    // Simulate a failed payment webhook
    await serviceIntegration.processWebhookEvent('stripe', {
      type: 'payment_intent.failed',
      data: {
        id: 'pi_failed_example',
        amount: 5999,
        currency: 'usd',
        status: 'failed',
        error: {
          code: 'card_declined',
          message: 'Your card was declined.'
        }
      }
    });
  } catch (error) {
    console.error('Error processing webhook events:', error);
  }
  
  // -----------------------------------------------
  // Example 5: Integrate with Reactive System DSL
  // -----------------------------------------------
  console.log('\n5. Integrating with Reactive System DSL...');
  
  // Define an order processing system that uses the service integration
  const orderSystem = ReactiveSystem.define('order-processing')
    .withName('Order Processing System')
    .withDescription('Processes orders with payment and shipping')
    .withMetadata({
      version: '1.0.0',
      author: 'ArchitectLM'
    });
  
  // Define tasks that use the service integration
  orderSystem
    .withTask('process-payment')
    .withName('Process Payment')
    .withDescription('Process payment for an order')
    .implementation(async (input, context) => {
      const { services } = context;
      const serviceIntegration = services['service-integration'];
      
      console.log(`Processing payment for order: ${input.orderId}`);
      
      const paymentResult = await serviceIntegration.executeOperation('stripe', 'createPayment', {
        amount: input.amount,
        currency: input.currency,
        paymentMethod: input.paymentMethod
      });
      
      // Emit the task.completed event to trigger the state transition
      context.emitEvent('task.completed', {
        taskId: 'process-payment',
        result: paymentResult
      });
      
      return {
        paymentId: paymentResult.id,
        status: paymentResult.status
      };
    })
    .withRetryPolicy({
      maxAttempts: 3,
      delay: 1000
    })
    .build();
  
  orderSystem
    .withTask('create-shipment')
    .withName('Create Shipment')
    .withDescription('Create shipment for an order')
    .implementation(async (input, context) => {
      const { services } = context;
      const serviceIntegration = services['service-integration'];
      
      console.log(`Creating shipment for order: ${input.orderId}`);
      
      const shipmentResult = await serviceIntegration.executeOperation('fedex', 'createShipment', {
        recipient: input.shippingAddress,
        package: input.packageDetails
      });
      
      // Emit the task.completed event to trigger the state transition
      context.emitEvent('task.completed', {
        taskId: 'create-shipment',
        result: shipmentResult
      });
      
      return {
        shipmentId: shipmentResult.id,
        trackingNumber: shipmentResult.trackingNumber,
        labelUrl: shipmentResult.label
      };
    })
    .withRetryPolicy({
      maxAttempts: 3,
      delay: 1000
    })
    .build();
  
  orderSystem
    .withTask('refund-payment')
    .withName('Refund Payment')
    .withDescription('Refund payment for a cancelled order')
    .implementation(async (input, context) => {
      const { services } = context;
      const serviceIntegration = services['service-integration'];
      
      console.log(`Refunding payment for order: ${input.orderId}`);
      
      const refundResult = await serviceIntegration.executeOperation('stripe', 'refundPayment', {
        paymentId: input.paymentId,
        amount: input.amount
      });
      
      // Emit the task.completed event to trigger the state transition
      context.emitEvent('task.completed', {
        taskId: 'refund-payment',
        result: refundResult
      });
      
      return {
        refundId: refundResult.id,
        status: refundResult.status
      };
    })
    .withRetryPolicy({
      maxAttempts: 3,
      delay: 1000
    })
    .build();
  
  // Define a process that uses these tasks
  const orderFulfillmentProcess = orderSystem
    .withProcess('order-fulfillment')
    .withName('Order Fulfillment')
    .withDescription('Process an order from payment to shipment')
    .initialState('new');
  
  // Define the states for the process
  orderFulfillmentProcess
    .state('new')
    .on('order.created').transitionTo('processing_payment');
  
  orderFulfillmentProcess
    .state('processing_payment')
    .withTask('process-payment')
    .on('task.completed').transitionTo('creating_shipment')
    .on('task.failed').transitionTo('payment_failed');
  
  orderFulfillmentProcess
    .state('payment_failed')
    .on('retry.payment').transitionTo('processing_payment')
    .on('cancel.order').transitionTo('cancelled');
  
  orderFulfillmentProcess
    .state('creating_shipment')
    .withTask('create-shipment')
    .on('task.completed').transitionTo('completed')
    .on('task.failed').transitionTo('shipment_failed');
  
  orderFulfillmentProcess
    .state('shipment_failed')
    .on('retry.shipment').transitionTo('creating_shipment')
    .on('cancel.order').transitionTo('refunding');
  
  orderFulfillmentProcess
    .state('refunding')
    .withTask('refund-payment')
    .on('task.completed').transitionTo('cancelled')
    .on('task.failed').transitionTo('refund_failed');
  
  orderFulfillmentProcess
    .state('refund_failed')
    .isFinal();
  
  orderFulfillmentProcess
    .state('cancelled')
    .isFinal();
  
  orderFulfillmentProcess
    .state('completed')
    .isFinal();
  
  // Build the process and return to the system builder
  orderFulfillmentProcess.build();
  
  // Build the system
  const builtSystem = orderSystem.build();
  
  // Assemble and run the system
  const assembler = createAssembler();
  const assembledSystem = assembler.assemble(builtSystem);
  const runtime = createRuntime(assembledSystem);
  
  // Register the service integration with the runtime
  runtime.registerService('service-integration', serviceIntegration);
  
  // Subscribe to all events
  runtime.on('*', (event) => {
    console.log(`Event: ${event.type}`, event.payload);
  });
  
  // Create a process instance
  console.log('\nStarting order fulfillment process...');
  const processInstance = runtime.createProcessInstance('order-fulfillment', {
    context: {
      orderId: 'order_' + Math.random().toString(36).substring(2, 10),
      amount: 4999,
      currency: 'usd',
      paymentMethod: 'pm_card_visa',
      shippingAddress: {
        name: 'Jane Smith',
        address: {
          street: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        }
      },
      packageDetails: {
        weight: 1.5,
        dimensions: {
          length: 10,
          width: 6,
          height: 4
        }
      }
    }
  });
  
  console.log(`Created process instance: ${processInstance.id}`);
  
  // Send the order.created event to start the process
  console.log('Sending order.created event...');
  await runtime.sendEvent(processInstance.id, 'order.created', {
    orderId: processInstance.context.orderId
  });
  console.log('Sent order.created event');
  
  // Wait for the process to complete
  await new Promise<void>((resolve) => {
    const checkStatus = async () => {
      const instance = runtime.getProcessInstance(processInstance.id);
      if (instance && instance.state === 'completed') {
        console.log(`Order fulfillment process completed successfully!`);
        console.log(`Final state: ${instance.state}`);
        resolve();
      } else if (instance && (instance.state === 'cancelled' || instance.state === 'refund_failed')) {
        console.log(`Order fulfillment process ended in state: ${instance.state}`);
        console.log(`Final state: ${instance.state}`);
        resolve();
      } else {
        console.log(`Current state: ${instance?.state}`);
        setTimeout(checkStatus, 1000);
      }
    };
    
    checkStatus();
  });
  
  console.log('\nService Integration Example completed!');
}

// Run the example
main().catch(error => {
  console.error('Error running Service Integration Example:', error);
}); 