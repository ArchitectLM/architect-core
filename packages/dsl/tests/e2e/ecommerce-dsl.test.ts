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
import { createEcommerceDSL } from './ecommerce-dsl.js';
import { createEcommercePlugin } from './ecommerce-plugin.js';
import { createEcommerceExtension } from './ecommerce-extension.js';

// Define types for task inputs and context
interface TaskInput {
  order?: any;
  items?: any[];
  customer?: any;
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

describe('E-Commerce DSL E2E Test', () => {
  let runtime: ReactiveRuntime;
  let eventBus: ReactiveEventBus;
  let app: express.Application;
  let server: any;
  let dslCompiler: EventDrivenDSLCompiler;
  
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
    
    // Create DSL compiler
    dslCompiler = new EventDrivenDSLCompiler({
      eventBus,
      dslExtensionSystem,
      dslPluginSystem: pluginSystem
    });
    
    // Register e-commerce extension
    const ecommerceExtension = createEcommerceExtension();
    extensionSystem.registerExtension(ecommerceExtension);
    
    // Register e-commerce plugin
    const ecommercePlugin = createEcommercePlugin();
    pluginSystem.registerPlugin(ecommercePlugin);
    
    // Create e-commerce DSL
    const ecommerceDSL = createEcommerceDSL();
    
    // Register DSL components
    for (const component of ecommerceDSL.components) {
      await dslCompiler.registerComponent(component);
    }
    
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
          
          // Simple payment processing logic
          const paymentResult = {
            success: true,
            transactionId: `txn-${Date.now()}`,
            amount: order.total
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
          
          // Simple shipping logic
          const shippingResult = {
            success: true,
            trackingNumber: `trk-${Date.now()}`,
            carrier: 'FastShip',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          };
          
          return shippingResult;
        }
      }
    };
    
    // Create runtime using the imported createRuntime function
    runtime = createRuntime(processDefinitions, taskDefinitions) as ReactiveRuntime;
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Define API routes
    app.post('/api/orders', async (req, res) => {
      try {
        const orderData = req.body;
        
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
    
    app.get('/api/orders/:orderId', (req, res) => {
      const { orderId } = req.params;
      const process = runtime.getProcess(orderId);
      
      if (!process) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({
        orderId,
        status: process.currentState,
        data: process.data,
        history: process.history
      });
    });
    
    // Start server
    server = app.listen(3000);
  });
  
  afterAll(() => {
    // Close server
    if (server) {
      server.close();
    }
  });
  
  describe('Order Process Flow', () => {
    let orderId: string;
    
    it('should create a new order', async () => {
      const orderData = {
        items: [
          { productId: 'prod-1', name: 'Product 1', price: 10.99, quantity: 2 },
          { productId: 'prod-2', name: 'Product 2', price: 24.99, quantity: 1 }
        ],
        total: 46.97,
        customer: {
          id: 'cust-1',
          name: 'John Doe',
          email: 'john@example.com'
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
    
    it('should validate the order', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/validate`)
        .expect(200);
      
      expect(response.body.status).toBe('validated');
      expect(response.body.validationResult.valid).toBe(true);
    });
    
    it('should process payment for the order', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/payment`)
        .expect(200);
      
      expect(response.body.status).toBe('paid');
      expect(response.body.paymentResult.success).toBe(true);
      expect(response.body.paymentResult).toHaveProperty('transactionId');
    });
    
    it('should fulfill the order', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/fulfill`)
        .expect(200);
      
      expect(response.body.status).toBe('fulfilled');
      expect(response.body.fulfillmentResult.success).toBe(true);
      expect(response.body.fulfillmentResult).toHaveProperty('fulfillmentId');
    });
    
    it('should ship the order', async () => {
      const response = await request(app)
        .post(`/api/orders/${orderId}/ship`)
        .expect(200);
      
      expect(response.body.status).toBe('shipped');
      expect(response.body.shippingResult.success).toBe(true);
      expect(response.body.shippingResult).toHaveProperty('trackingNumber');
      expect(response.body.shippingResult).toHaveProperty('estimatedDelivery');
    });
    
    it('should get the order details with full history', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);
      
      expect(response.body.status).toBe('shipped');
      expect(response.body.history).toHaveLength(5); // created, validated, paid, fulfilled, shipped
      
      // Verify the state transitions
      const stateTransitions = response.body.history.map((h: any) => h.state);
      expect(stateTransitions).toEqual(['created', 'validated', 'paid', 'fulfilled', 'shipped']);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const invalidOrderData = {
        items: [],
        total: 0,
        customer: {
          id: 'cust-2',
          name: 'Jane Doe'
          // Missing email
        }
      };
      
      // Create order
      const createResponse = await request(app)
        .post('/api/orders')
        .send(invalidOrderData)
        .expect(201);
      
      const orderId = createResponse.body.orderId;
      
      // Try to validate
      const validateResponse = await request(app)
        .post(`/api/orders/${orderId}/validate`)
        .expect(400);
      
      expect(validateResponse.body).toHaveProperty('error');
      expect(validateResponse.body.error).toContain('Order must have at least one item');
    });
    
    it('should handle non-existent orders', async () => {
      const nonExistentOrderId = 'non-existent-id';
      
      const response = await request(app)
        .get(`/api/orders/${nonExistentOrderId}`)
        .expect(404);
      
      expect(response.body.error).toBe('Order not found');
    });
  });
}); 