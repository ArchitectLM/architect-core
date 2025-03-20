import { System } from '../../src/system-api.js';

/**
 * Implementation for the CreateOrder command
 */
interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  currency: string;
}

interface Order {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Context {
  plugins: {
    storage: {
      query: (sql: string, params: any[]) => Promise<any[]>;
      insert: (table: string, data: any) => Promise<any>;
    };
    payment: {
      createCharge: (data: any) => Promise<any>;
    };
    messaging: {
      publish: (topic: string, message: any) => Promise<void>;
    };
  };
  extensions: {
    call: (point: string, ...args: any[]) => Promise<any>;
  };
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
}

export default System.implement<CreateOrderRequest, Order>('CreateOrder', 
  async (input: CreateOrderRequest, context: Context): Promise<Order> => {
    const { storage, payment, messaging } = context.plugins;
    const { logger, extensions } = context;
    
    try {
      logger.info('Creating order', { customerId: input.customerId });
      
      // 1. Validate customer exists
      const [customer] = await storage.query(
        'SELECT * FROM customers WHERE id = $1',
        [input.customerId]
      );
      
      if (!customer) {
        throw new Error(`Customer ${input.customerId} not found`);
      }
      
      // 2. Get product details and calculate prices
      const productIds = input.items.map(item => item.productId);
      const products = await storage.query(
        'SELECT * FROM products WHERE id = ANY($1)',
        [productIds]
      );
      
      // Map products by ID for easy lookup
      const productMap = products.reduce((map, product) => {
        map[product.id] = product;
        return map;
      }, {} as Record<string, any>);
      
      // Calculate item prices and total
      const items = input.items.map(item => {
        const product = productMap[item.productId];
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price
        };
      });
      
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // 3. Call beforeCreate extension point
      const orderData = {
        customerId: input.customerId,
        items,
        totalAmount,
        currency: input.currency,
        status: 'pending'
      };
      
      const modifiedOrderData = await extensions.call('beforeCreate', orderData, context);
      
      // 4. Create the order
      const now = new Date().toISOString();
      const order = {
        id: `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...modifiedOrderData,
        createdAt: now,
        updatedAt: now
      };
      
      await storage.insert('orders', order);
      
      // 5. Call afterCreate extension point
      await extensions.call('afterCreate', order, context);
      
      // 6. Publish event
      await messaging.publish('orders', {
        type: 'OrderCreated',
        payload: order
      });
      
      logger.info('Order created successfully', { orderId: order.id });
      
      return order;
    } catch (error) {
      logger.error('Failed to create order', error);
      throw error;
    }
  },
  {
    // Implementation metadata
    complexity: 'medium',
    estimatedLatency: 'medium',
    sideEffects: ['database-write', 'event-publishing'],
    testCases: [
      {
        description: 'Successfully creates an order',
        input: {
          customerId: 'cust-123',
          items: [
            { productId: 'prod-456', quantity: 2 }
          ],
          currency: 'USD'
        },
        expectedOutput: {
          id: 'order-123456789',
          customerId: 'cust-123',
          items: [
            { productId: 'prod-456', quantity: 2, price: 49.99 }
          ],
          totalAmount: 99.98,
          currency: 'USD',
          status: 'pending',
          createdAt: '2023-06-01T12:00:00Z',
          updatedAt: '2023-06-01T12:00:00Z'
        },
        mockResponses: {
          'storage.query[0]': [{ id: 'cust-123', name: 'John Doe' }],
          'storage.query[1]': [{ id: 'prod-456', name: 'Test Product', price: 49.99 }]
        }
      },
      {
        description: 'Throws error when customer does not exist',
        input: {
          customerId: 'cust-999',
          items: [
            { productId: 'prod-456', quantity: 2 }
          ],
          currency: 'USD'
        },
        expectedOutput: new Error('Customer cust-999 not found'),
        mockResponses: {
          'storage.query[0]': []
        }
      }
    ]
  }
); 