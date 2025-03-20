import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

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
}); 