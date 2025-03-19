import { Component } from '../../../src/models.js';

export const exampleComponents: Component[] = [
  {
    type: 'system' as const,
    name: 'OrderProcessingSystem',
    content: `import { System } from '../../src/system-api.js';

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
});`,
    metadata: {
      path: 'systems/order-processing.system.ts',
      description: 'Order processing system definition',
      tags: ['system', 'order-processing', 'e-commerce'],
      createdAt: Date.now(),
      author: 'system',
      version: '1.0.0'
    }
  },
  {
    type: 'schema' as const,
    name: 'Order',
    content: `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/models.js';

/**
 * Order schema component
 * 
 * Represents a customer order in the e-commerce system
 */
export default System.component('Order', {
  type: ComponentType.SCHEMA,
  description: 'Represents a customer order in the system',
  tags: ['order', 'commerce', 'core'],
  version: '1.0.0',
  authors: ['team-commerce'],
  
  // The actual schema definition
  definition: {
    type: 'object',
    properties: {
      id: { 
        type: 'string', 
        description: 'Unique order identifier' 
      },
      customerId: { 
        type: 'string', 
        description: 'Customer who placed the order' 
      },
      items: { 
        type: 'array', 
        items: { 
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Product identifier' },
            quantity: { type: 'number', description: 'Quantity ordered' },
            price: { type: 'number', description: 'Price per unit' }
          },
          required: ['productId', 'quantity', 'price']
        },
        description: 'Items included in this order' 
      },
      totalAmount: { 
        type: 'number', 
        description: 'Total order amount in the specified currency' 
      },
      currency: { 
        type: 'string', 
        description: 'Three-letter currency code (ISO 4217)' 
      },
      status: { 
        type: 'string', 
        enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
        description: 'Current status of the order' 
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the order was created'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the order was last updated'
      }
    },
    required: ['id', 'customerId', 'items', 'totalAmount', 'currency', 'status', 'createdAt']
  },
  
  // Examples help LLMs understand usage patterns
  examples: [
    {
      id: "order-123",
      customerId: "cust-456",
      items: [
        { productId: "prod-789", quantity: 2, price: 49.99 }
      ],
      totalAmount: 99.98,
      currency: "USD",
      status: "pending",
      createdAt: "2023-06-01T12:00:00Z",
      updatedAt: "2023-06-01T12:00:00Z"
    }
  ],
  
  // Related components with relationship descriptions
  relatedComponents: [
    { 
      ref: 'Customer', 
      relationship: 'references', 
      description: 'An order is placed by a customer' 
    },
    { 
      ref: 'OrderItem', 
      relationship: 'contains', 
      description: 'An order contains order items' 
    },
    { 
      ref: 'Product', 
      relationship: 'references', 
      description: 'Order items reference products' 
    }
  ]
});`,
    metadata: {
      path: 'schemas/order.schema.ts',
      description: 'Order data schema definition',
      tags: ['schema', 'order', 'commerce'],
      createdAt: Date.now(),
      author: 'system',
      version: '1.0.0'
    }
  },
  {
    type: 'command' as const,
    name: 'CreateOrder',
    content: `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/models.js';

/**
 * CreateOrder command component
 * 
 * Creates a new order in the e-commerce system
 */
export default System.component('CreateOrder', {
  type: ComponentType.COMMAND,
  description: 'Creates a new order in the system',
  tags: ['order', 'commerce', 'write'],
  version: '1.0.0',
  
  // Input and output schemas with descriptions
  input: {
    ref: 'CreateOrderRequest',
    description: 'Request to create a new order'
  },
  output: {
    ref: 'Order',
    description: 'The created order'
  },
  
  // Explicit plugin dependencies with reasons
  plugins: {
    storage: {
      ref: 'PostgresPlugin',
      description: 'For persisting order data',
      operations: ['insert', 'update']
    },
    payment: {
      ref: 'StripePlugin',
      description: 'For processing payments',
      operations: ['createCharge']
    },
    messaging: {
      ref: 'KafkaPlugin',
      description: 'For publishing order events',
      operations: ['publish']
    }
  },
  
  // Extension points with clear descriptions
  extensionPoints: {
    beforeCreate: {
      description: 'Called before creating the order',
      parameters: ['order', 'context'],
      examples: ['validateInventory', 'applyDiscounts']
    },
    afterCreate: {
      description: 'Called after creating the order',
      parameters: ['order', 'context'],
      examples: ['sendConfirmation', 'updateAnalytics']
    }
  },
  
  // Events produced by this command
  produces: [
    {
      event: 'OrderCreated',
      description: 'Published when an order is successfully created'
    }
  ],
  
  // Related components for navigation
  relatedComponents: [
    { ref: 'Order', relationship: 'creates' },
    { ref: 'GetOrder', relationship: 'complementary' },
    { ref: 'ProcessPayment', relationship: 'next-step' }
  ]
});`,
    metadata: {
      path: 'commands/create-order.command.ts',
      description: 'Command for order creation',
      tags: ['command', 'order', 'commerce'],
      createdAt: Date.now(),
      author: 'system',
      version: '1.0.0'
    }
  }
]; 