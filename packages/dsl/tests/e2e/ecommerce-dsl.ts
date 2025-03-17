import { ComponentType, BaseComponent } from '../../src/types.js';

/**
 * Creates the e-commerce DSL components
 */
export function createEcommerceDSL() {
  // Define schemas
  const productSchema: BaseComponent = {
    type: ComponentType.SCHEMA,
    name: 'Product',
    description: 'Product schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product ID' },
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        price: { type: 'number', description: 'Product price' },
        inventory: { type: 'number', description: 'Available inventory' },
        category: { type: 'string', description: 'Product category' }
      },
      required: ['id', 'name', 'price']
    }
  };
  
  const customerSchema: BaseComponent = {
    type: ComponentType.SCHEMA,
    name: 'Customer',
    description: 'Customer schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Customer ID' },
        name: { type: 'string', description: 'Customer name' },
        email: { type: 'string', description: 'Customer email' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postalCode: { type: 'string' },
            country: { type: 'string' }
          }
        }
      },
      required: ['id', 'name', 'email']
    }
  };
  
  const orderItemSchema: BaseComponent = {
    type: ComponentType.SCHEMA,
    name: 'OrderItem',
    description: 'Order item schema',
    definition: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID' },
        name: { type: 'string', description: 'Product name' },
        price: { type: 'number', description: 'Product price' },
        quantity: { type: 'number', description: 'Quantity ordered' }
      },
      required: ['productId', 'name', 'price', 'quantity']
    }
  };
  
  const orderSchema: BaseComponent = {
    type: ComponentType.SCHEMA,
    name: 'Order',
    description: 'Order schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Order ID' },
        customer: { $ref: 'Customer', description: 'Customer information' },
        items: {
          type: 'array',
          items: { $ref: 'OrderItem' },
          description: 'Order items'
        },
        total: { type: 'number', description: 'Order total' },
        status: { 
          type: 'string', 
          enum: ['created', 'validated', 'paid', 'fulfilled', 'shipped', 'delivered', 'cancelled'],
          description: 'Order status'
        },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
      },
      required: ['customer', 'items', 'total']
    }
  };
  
  const paymentSchema: BaseComponent = {
    type: ComponentType.SCHEMA,
    name: 'Payment',
    description: 'Payment schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Payment ID' },
        orderId: { type: 'string', description: 'Order ID' },
        amount: { type: 'number', description: 'Payment amount' },
        method: { 
          type: 'string', 
          enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer'],
          description: 'Payment method'
        },
        status: { 
          type: 'string', 
          enum: ['pending', 'completed', 'failed', 'refunded'],
          description: 'Payment status'
        },
        transactionId: { type: 'string', description: 'Payment transaction ID' },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' }
      },
      required: ['orderId', 'amount', 'method']
    }
  };
  
  // Define commands
  const createOrderCommand: BaseComponent = {
    type: ComponentType.COMMAND,
    name: 'CreateOrder',
    description: 'Create a new order',
    input: { ref: 'Order' },
    output: { ref: 'Order' }
  };
  
  const validateOrderCommand: BaseComponent = {
    type: ComponentType.COMMAND,
    name: 'ValidateOrder',
    description: 'Validate an order',
    input: { ref: 'Order' },
    output: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  };
  
  const processPaymentCommand: BaseComponent = {
    type: ComponentType.COMMAND,
    name: 'ProcessPayment',
    description: 'Process payment for an order',
    input: { ref: 'Order' },
    output: { ref: 'Payment' }
  };
  
  const fulfillOrderCommand: BaseComponent = {
    type: ComponentType.COMMAND,
    name: 'FulfillOrder',
    description: 'Fulfill an order',
    input: { ref: 'Order' },
    output: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        fulfillmentId: { type: 'string' },
        items: {
          type: 'array',
          items: { $ref: 'OrderItem' }
        }
      }
    }
  };
  
  const shipOrderCommand: BaseComponent = {
    type: ComponentType.COMMAND,
    name: 'ShipOrder',
    description: 'Ship an order',
    input: { ref: 'Order' },
    output: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        trackingNumber: { type: 'string' },
        carrier: { type: 'string' },
        estimatedDelivery: { type: 'string', format: 'date-time' }
      }
    }
  };
  
  // Define events
  const orderCreatedEvent: BaseComponent = {
    type: ComponentType.EVENT,
    name: 'OrderCreated',
    description: 'Event emitted when an order is created',
    payload: { ref: 'Order' }
  };
  
  const orderValidatedEvent: BaseComponent = {
    type: ComponentType.EVENT,
    name: 'OrderValidated',
    description: 'Event emitted when an order is validated',
    payload: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        valid: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  };
  
  const paymentProcessedEvent: BaseComponent = {
    type: ComponentType.EVENT,
    name: 'PaymentProcessed',
    description: 'Event emitted when a payment is processed',
    payload: { ref: 'Payment' }
  };
  
  const orderFulfilledEvent: BaseComponent = {
    type: ComponentType.EVENT,
    name: 'OrderFulfilled',
    description: 'Event emitted when an order is fulfilled',
    payload: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        fulfillmentId: { type: 'string' }
      }
    }
  };
  
  const orderShippedEvent: BaseComponent = {
    type: ComponentType.EVENT,
    name: 'OrderShipped',
    description: 'Event emitted when an order is shipped',
    payload: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        trackingNumber: { type: 'string' },
        carrier: { type: 'string' },
        estimatedDelivery: { type: 'string', format: 'date-time' }
      }
    }
  };
  
  // Return all components
  return {
    components: [
      // Schemas
      productSchema,
      customerSchema,
      orderItemSchema,
      orderSchema,
      paymentSchema,
      
      // Commands
      createOrderCommand,
      validateOrderCommand,
      processPaymentCommand,
      fulfillOrderCommand,
      shipOrderCommand,
      
      // Events
      orderCreatedEvent,
      orderValidatedEvent,
      paymentProcessedEvent,
      orderFulfilledEvent,
      orderShippedEvent
    ]
  };
} 