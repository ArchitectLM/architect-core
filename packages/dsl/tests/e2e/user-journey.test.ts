import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ReactiveEventBus, createRuntime, ReactiveRuntime } from '@architectlm/core';
import { 
  createDSLPluginSystem, 
  DSLExtensionSystem, 
  EventDrivenDSLCompiler,
  ComponentType
} from '../../src/index.js';
import { createExtensionSystem, DefaultExtensionSystem } from '@architectlm/extensions';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Define types for task inputs and context
interface TaskInput {
  order?: any;
  user?: any;
  [key: string]: any;
}

// Match the TaskContext from the core package
interface TaskContext {
  logger: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
  emitEvent: (type: string, payload: any) => void;
  getProcess: (id: string) => any;
  getTaskResult: (taskId: string) => any;
  [key: string]: any;
}

describe('E-Commerce User Journey', () => {
  let app: express.Express;
  let runtime: ReactiveRuntime;
  let eventBus: ReactiveEventBus;
  let userDb: Map<string, any>;
  let discountDb: Map<string, number>;

  beforeAll(async () => {
    // Create event bus
    eventBus = new ReactiveEventBus();
    
    // Create extension system
    const extensionSystem = createExtensionSystem();
    const dslExtensionSystem = new DSLExtensionSystem(extensionSystem);
    
    // Create plugin system
    const { createPluginManager } = await import('@architectlm/extensions');
    const pluginManager = createPluginManager(extensionSystem as DefaultExtensionSystem);
    const pluginSystem = createDSLPluginSystem(pluginManager);
    
    // Initialize in-memory databases
    userDb = new Map();
    discountDb = new Map();
    
    // Create process definitions
    const processDefinitions = {
      orderProcess: {
        id: 'orderProcess',
        name: 'Order Process',
        description: 'Process for handling orders',
        initialState: 'created',
        states: [
          { id: 'created', name: 'Created', description: 'Order has been created' },
          { id: 'validated', name: 'Validated', description: 'Order has been validated' },
          { id: 'paid', name: 'Paid', description: 'Payment has been received' },
          { id: 'fulfilled', name: 'Fulfilled', description: 'Order has been fulfilled' },
          { id: 'shipped', name: 'Shipped', description: 'Order has been shipped' },
          { id: 'delivered', name: 'Delivered', description: 'Order has been delivered' },
          { id: 'cancelled', name: 'Cancelled', description: 'Order has been cancelled' }
        ],
        transitions: [
          { from: 'created', on: 'VALIDATE', to: 'validated' },
          { from: 'validated', on: 'PAYMENT_RECEIVED', to: 'paid' },
          { from: 'paid', on: 'FULFILL', to: 'fulfilled' },
          { from: 'fulfilled', on: 'SHIP', to: 'shipped' },
          { from: 'shipped', on: 'DELIVER', to: 'delivered' },
          { from: '*', on: 'CANCEL', to: 'cancelled' }
        ]
      }
    };
    
    // Create task definitions
    const taskDefinitions = {
      validateOrder: {
        id: 'validateOrder',
        name: 'Validate Order',
        description: 'Validates an order',
        implementation: async (input: TaskInput, context: TaskContext) => {
          context.logger.info('Validating order', input);
          
          // Get the order from the input
          const order = input.order;
          
          // Simple validation logic
          if (!order.items || order.items.length === 0) {
            throw new Error('Order must have at least one item');
          }
          
          if (!order.customer || !order.customer.email) {
            throw new Error('Order must have a customer with an email');
          }
          
          return { valid: true, message: 'Order is valid' };
        }
      },
      processPayment: {
        id: 'processPayment',
        name: 'Process Payment',
        description: 'Processes payment for an order',
        implementation: async (input: TaskInput, context: TaskContext) => {
          context.logger.info('Processing payment', input);
          
          // Get the order from the input
          const order = input.order;
          
          // Apply discount if available
          let finalAmount = order.total;
          const userId = order.customer.id;
          
          if (discountDb.has(userId)) {
            const discountPercentage = discountDb.get(userId)!;
            const discountAmount = (order.total * discountPercentage) / 100;
            finalAmount = order.total - discountAmount;
            
            // Remove the discount after it's used
            discountDb.delete(userId);
            
            context.logger.info(`Applied ${discountPercentage}% discount for user ${userId}. Original: ${order.total}, Final: ${finalAmount}`);
          }
          
          // Simple payment processing logic
          const paymentResult = {
            success: true,
            transactionId: `txn-${Date.now()}`,
            amount: finalAmount,
            originalAmount: order.total,
            discountApplied: finalAmount !== order.total
          };
          
          return paymentResult;
        }
      },
      fulfillOrder: {
        id: 'fulfillOrder',
        name: 'Fulfill Order',
        description: 'Fulfills an order',
        implementation: async (input: TaskInput, context: TaskContext) => {
          context.logger.info('Fulfilling order', input);
          
          // Get the order from the input
          const order = input.order;
          
          // Simple fulfillment logic
          const fulfillmentResult = {
            success: true,
            fulfillmentId: `ful-${Date.now()}`,
            items: order.items
          };
          
          return fulfillmentResult;
        }
      },
      shipOrder: {
        id: 'shipOrder',
        name: 'Ship Order',
        description: 'Ships an order',
        implementation: async (input: TaskInput, context: TaskContext) => {
          context.logger.info('Shipping order', input);
          
          // Get the order from the input
          const order = input.order;
          
          // Check if this is the user's first order and they're from the US
          const userId = order.customer.id;
          const user = userDb.get(userId);
          
          if (user && user.country === 'US' && user.orderCount === 1) {
            // Add a 5% discount for their next order
            discountDb.set(userId, 5);
            context.logger.info(`Added 5% discount for user ${userId}'s next order`);
          }
          
          // Simple shipping logic
          const shippingResult = {
            success: true,
            trackingNumber: `trk-${Date.now()}`,
            carrier: 'FastShip',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          };
          
          return shippingResult;
        }
      },
      createUser: {
        id: 'createUser',
        name: 'Create User',
        description: 'Creates a new user',
        implementation: async (input: TaskInput, context: TaskContext) => {
          context.logger.info('Creating user', input);
          
          const user = input.user;
          const userId = user.id || uuidv4();
          
          // Store user in the database
          userDb.set(userId, {
            ...user,
            id: userId,
            orderCount: 0,
            createdAt: new Date().toISOString()
          });
          
          return {
            success: true,
            userId
          };
        }
      },
      updateUserOrderCount: {
        id: 'updateUserOrderCount',
        name: 'Update User Order Count',
        description: 'Updates the order count for a user',
        implementation: async (input: TaskInput, context: TaskContext) => {
          context.logger.info('Updating user order count', input);
          
          const userId = input.userId;
          const user = userDb.get(userId);
          
          if (!user) {
            throw new Error(`User ${userId} not found`);
          }
          
          // Increment order count
          user.orderCount += 1;
          userDb.set(userId, user);
          
          return {
            success: true,
            userId,
            orderCount: user.orderCount
          };
        }
      }
    };
    
    // Create runtime using the imported createRuntime function
    runtime = createRuntime(processDefinitions, taskDefinitions) as ReactiveRuntime;
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Define API routes
    app.post('/api/users', async (req, res) => {
      try {
        const userData = req.body;
        
        // Create a new user
        const result = await runtime.executeTask('createUser', {
          user: userData
        });
        
        res.status(201).json({
          userId: result.userId,
          success: result.success
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/orders', async (req, res) => {
      try {
        const orderData = req.body;
        const userId = orderData.customer.id;
        
        // Update user order count
        await runtime.executeTask('updateUserOrderCount', {
          userId
        });
        
        // Create a new order process
        const process = runtime.createProcess('orderProcess', {
          order: orderData,
          customer: orderData.customer,
          createdAt: new Date().toISOString()
        });
        
        res.status(201).json({
          orderId: process.id,
          status: process.currentState,
          data: process.data
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/orders/:orderId/validate', async (req, res) => {
      try {
        const { orderId } = req.params;
        const process = runtime.getProcess(orderId);
        
        if (!process) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        // Execute validation task
        const validationResult = await runtime.executeTask('validateOrder', {
          order: process.data.order
        });
        
        // Transition process state
        runtime.transitionProcess(orderId, 'VALIDATE', { validationResult });
        
        const updatedProcess = runtime.getProcess(orderId);
        
        res.json({
          orderId,
          status: updatedProcess?.currentState,
          validationResult
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/orders/:orderId/payment', async (req, res) => {
      try {
        const { orderId } = req.params;
        const process = runtime.getProcess(orderId);
        
        if (!process) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        // Execute payment task
        const paymentResult = await runtime.executeTask('processPayment', {
          order: process.data.order
        });
        
        // Transition process state
        runtime.transitionProcess(orderId, 'PAYMENT_RECEIVED', { paymentResult });
        
        const updatedProcess = runtime.getProcess(orderId);
        
        res.json({
          orderId,
          status: updatedProcess?.currentState,
          paymentResult
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/orders/:orderId/fulfill', async (req, res) => {
      try {
        const { orderId } = req.params;
        const process = runtime.getProcess(orderId);
        
        if (!process) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        // Execute fulfillment task
        const fulfillmentResult = await runtime.executeTask('fulfillOrder', {
          order: process.data.order
        });
        
        // Transition process state
        runtime.transitionProcess(orderId, 'FULFILL', { fulfillmentResult });
        
        const updatedProcess = runtime.getProcess(orderId);
        
        res.json({
          orderId,
          status: updatedProcess?.currentState,
          fulfillmentResult
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    
    app.post('/api/orders/:orderId/ship', async (req, res) => {
      try {
        const { orderId } = req.params;
        const process = runtime.getProcess(orderId);
        
        if (!process) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        // Execute shipping task
        const shippingResult = await runtime.executeTask('shipOrder', {
          order: process.data.order
        });
        
        // Transition process state
        runtime.transitionProcess(orderId, 'SHIP', { shippingResult });
        
        const updatedProcess = runtime.getProcess(orderId);
        
        res.json({
          orderId,
          status: updatedProcess?.currentState,
          shippingResult
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    
    app.get('/api/users/:userId/discount', async (req, res) => {
      try {
        const { userId } = req.params;
        const discount = discountDb.get(userId) || 0;
        
        res.json({
          userId,
          discountPercentage: discount
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
  });
  
  afterAll(() => {
    // Clean up resources
    userDb.clear();
    discountDb.clear();
  });
  
  describe('US Customer Discount Journey', () => {
    let userId: string;
    let firstOrderId: string;
    let secondOrderId: string;
    
    it('should create a US customer', async () => {
      const userData = {
        name: 'John Smith',
        email: 'john.smith@example.com',
        country: 'US',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US'
        }
      };
      
      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);
      
      expect(response.body).toHaveProperty('userId');
      expect(response.body.success).toBe(true);
      
      userId = response.body.userId;
    });
    
    it('should place a first order', async () => {
      const orderData = {
        items: [
          { productId: 'prod-1', name: 'Product 1', price: 29.99, quantity: 1 },
          { productId: 'prod-2', name: 'Product 2', price: 49.99, quantity: 2 }
        ],
        total: 129.97,
        customer: {
          id: userId,
          name: 'John Smith',
          email: 'john.smith@example.com',
          country: 'US'
        }
      };
      
      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);
      
      expect(response.body).toHaveProperty('orderId');
      expect(response.body.status).toBe('created');
      
      firstOrderId = response.body.orderId;
    });
    
    it('should process the first order through the entire flow', async () => {
      // Validate order
      await request(app)
        .post(`/api/orders/${firstOrderId}/validate`)
        .expect(200);
      
      // Process payment
      await request(app)
        .post(`/api/orders/${firstOrderId}/payment`)
        .expect(200);
      
      // Fulfill order
      await request(app)
        .post(`/api/orders/${firstOrderId}/fulfill`)
        .expect(200);
      
      // Ship order
      const shipResponse = await request(app)
        .post(`/api/orders/${firstOrderId}/ship`)
        .expect(200);
      
      expect(shipResponse.body.status).toBe('shipped');
    });
    
    it('should have a 5% discount available after first order', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/discount`)
        .expect(200);
      
      expect(response.body.userId).toBe(userId);
      expect(response.body.discountPercentage).toBe(5);
    });
    
    it('should place a second order with discount applied', async () => {
      const orderData = {
        items: [
          { productId: 'prod-3', name: 'Product 3', price: 39.99, quantity: 1 },
          { productId: 'prod-4', name: 'Product 4', price: 59.99, quantity: 1 }
        ],
        total: 99.98,
        customer: {
          id: userId,
          name: 'John Smith',
          email: 'john.smith@example.com',
          country: 'US'
        }
      };
      
      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);
      
      expect(response.body).toHaveProperty('orderId');
      expect(response.body.status).toBe('created');
      
      secondOrderId = response.body.orderId;
    });
    
    it('should apply the discount during payment processing', async () => {
      // Validate order
      await request(app)
        .post(`/api/orders/${secondOrderId}/validate`)
        .expect(200);
      
      // Process payment with discount
      const paymentResponse = await request(app)
        .post(`/api/orders/${secondOrderId}/payment`)
        .expect(200);
      
      expect(paymentResponse.body.paymentResult.discountApplied).toBe(true);
      expect(paymentResponse.body.paymentResult.originalAmount).toBe(99.98);
      expect(paymentResponse.body.paymentResult.amount).toBeCloseTo(99.98 * 0.95, 2); // 5% off
    });
    
    it('should not have any discount available after second order', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/discount`)
        .expect(200);
      
      expect(response.body.userId).toBe(userId);
      expect(response.body.discountPercentage).toBe(0);
    });
  });
  
  describe('Non-US Customer Journey', () => {
    let userId: string;
    let orderId: string;
    
    it('should create a non-US customer', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        country: 'UK',
        address: {
          street: '10 Downing Street',
          city: 'London',
          postalCode: 'SW1A 2AA',
          country: 'UK'
        }
      };
      
      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);
      
      expect(response.body).toHaveProperty('userId');
      expect(response.body.success).toBe(true);
      
      userId = response.body.userId;
    });
    
    it('should place an order', async () => {
      const orderData = {
        items: [
          { productId: 'prod-1', name: 'Product 1', price: 29.99, quantity: 1 },
          { productId: 'prod-2', name: 'Product 2', price: 49.99, quantity: 1 }
        ],
        total: 79.98,
        customer: {
          id: userId,
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          country: 'UK'
        }
      };
      
      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);
      
      expect(response.body).toHaveProperty('orderId');
      expect(response.body.status).toBe('created');
      
      orderId = response.body.orderId;
    });
    
    it('should process the order through the entire flow', async () => {
      // Validate order
      await request(app)
        .post(`/api/orders/${orderId}/validate`)
        .expect(200);
      
      // Process payment
      await request(app)
        .post(`/api/orders/${orderId}/payment`)
        .expect(200);
      
      // Fulfill order
      await request(app)
        .post(`/api/orders/${orderId}/fulfill`)
        .expect(200);
      
      // Ship order
      const shipResponse = await request(app)
        .post(`/api/orders/${orderId}/ship`)
        .expect(200);
      
      expect(shipResponse.body.status).toBe('shipped');
    });
    
    it('should not have a discount available after first order', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/discount`)
        .expect(200);
      
      expect(response.body.userId).toBe(userId);
      expect(response.body.discountPercentage).toBe(0);
    });
  });
}); 