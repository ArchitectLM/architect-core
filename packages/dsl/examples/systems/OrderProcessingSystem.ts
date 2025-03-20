import { System } from '../../src/system-api.js';

/**
 * Order Processing System
 * 
 * Handles the end-to-end order processing workflow
 */
export default System.define('OrderProcessingSystem', {
  description: 'Handles the end-to-end order processing workflow',
  version: '1.0.0',
  tags: ['e-commerce', 'order-processing'],
  
  // Components are referenced, not defined inline
  components: {
    schemas: [
      { ref: 'Order', required: true },
      { ref: 'OrderItem', required: true },
      { ref: 'Customer', required: true },
      { ref: 'Product', required: true },
      { ref: 'Payment', required: true },
      { ref: 'Shipment', required: true }
    ],
    
    commands: [
      { ref: 'CreateOrder', required: true },
      { ref: 'ProcessPayment', required: true },
      { ref: 'ShipOrder', required: true },
      { ref: 'CancelOrder', required: false }
    ],
    
    queries: [
      { ref: 'GetOrder', required: true },
      { ref: 'ListOrders', required: true },
      { ref: 'GetOrderHistory', required: false }
    ],
    
    events: [
      { ref: 'OrderCreated', required: true },
      { ref: 'PaymentProcessed', required: true },
      { ref: 'OrderShipped', required: true },
      { ref: 'OrderCancelled', required: false }
    ]
  },
  
  // Extensions applied to this system
  extensions: [
    { 
      ref: 'MonitoringExtension', 
      config: { metricsEndpoint: 'https://metrics.example.com' } 
    },
    { 
      ref: 'ValidationExtension', 
      config: { strictMode: true } 
    }
  ],
  
  // Plugins used by this system
  plugins: {
    storage: { 
      ref: 'PostgresPlugin',
      config: {
        connectionString: 'postgresql://user:password@localhost:5432/orders',
        poolSize: 10
      }
    },
    messaging: { 
      ref: 'KafkaPlugin',
      config: {
        brokers: ['kafka-1:9092', 'kafka-2:9092'],
        clientId: 'order-processing-system'
      }
    },
    payment: { 
      ref: 'StripePlugin',
      config: {
        apiKey: 'sk_test_...',
        webhookSecret: 'whsec_...'
      }
    },
    shipping: { 
      ref: 'FedExPlugin',
      config: {
        apiKey: 'fedex_api_key',
        accountNumber: '123456789'
      }
    }
  },
  
  // Workflows define the business processes
  workflows: [
    {
      name: 'StandardOrderProcess',
      description: 'Standard flow for processing an order',
      steps: [
        { command: 'CreateOrder', next: 'ProcessPayment' },
        { command: 'ProcessPayment', next: 'ShipOrder', onFailure: 'CancelOrder' },
        { command: 'ShipOrder', end: true }
      ]
    },
    {
      name: 'ExpressOrderProcess',
      description: 'Express flow for processing an order with expedited shipping',
      steps: [
        { command: 'CreateOrder', next: 'ProcessPayment' },
        { command: 'ProcessPayment', next: 'ShipExpressOrder', onFailure: 'CancelOrder' },
        { command: 'ShipExpressOrder', end: true }
      ]
    }
  ]
}); 