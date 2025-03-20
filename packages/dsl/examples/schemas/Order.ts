import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

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
}); 