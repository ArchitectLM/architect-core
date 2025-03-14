import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntime, ProcessManager, TaskManager } from '../';
import { 
  ProcessDefinition, 
  TaskDefinition, 
  TaskContext, 
  Event, 
  ProcessInstance
} from '../../../models';

/**
 * Integration tests for the ReactiveRuntime, ProcessManager, and TaskManager
 * 
 * These tests verify that the components work together correctly in various scenarios.
 */
describe('Runtime Integration', () => {
  // Define a more complex order processing workflow for testing
  const orderProcessDefinition: ProcessDefinition = {
    id: 'order-process',
    states: [
      { name: 'created', description: 'Order has been created' },
      { name: 'validated', description: 'Order has been validated' },
      { name: 'processing', description: 'Order is being processed' },
      { name: 'shipping', description: 'Order is being shipped' },
      { name: 'delivered', description: 'Order has been delivered' },
      { name: 'completed', description: 'Order has been completed' },
      { name: 'cancelled', description: 'Order has been cancelled' },
      { name: 'refunded', description: 'Order has been refunded' }
    ],
    initialState: 'created',
    transitions: [
      { from: 'created', to: 'validated', on: 'VALIDATE_ORDER' },
      { from: 'validated', to: 'processing', on: 'PROCESS_ORDER' },
      { from: 'processing', to: 'shipping', on: 'SHIP_ORDER' },
      { from: 'shipping', to: 'delivered', on: 'DELIVER_ORDER' },
      { from: 'delivered', to: 'completed', on: 'COMPLETE_ORDER' },
      { from: '*', to: 'cancelled', on: 'CANCEL_ORDER' },
      { from: 'cancelled', to: 'refunded', on: 'REFUND_ORDER' },
      { 
        from: 'created', 
        to: 'cancelled', 
        on: 'VALIDATE_ORDER',
        guard: (context) => context.total <= 0
      }
    ]
  };
  
  // Task definitions
  const validateOrderTask: TaskDefinition = {
    id: 'validate-order',
    implementation: async (input: any, context: TaskContext) => {
      // Validate the order
      const isValid = input.total > 0;
      
      if (isValid) {
        context.emitEvent('VALIDATE_ORDER', { 
          orderId: input.orderId,
          validatedAt: new Date().toISOString()
        });
      } else {
        context.emitEvent('CANCEL_ORDER', { 
          orderId: input.orderId,
          reason: 'Invalid order total'
        });
      }
      
      return { 
        valid: isValid, 
        orderId: input.orderId
      };
    }
  };
  
  const processOrderTask: TaskDefinition = {
    id: 'process-order',
    implementation: async (input: any, context: TaskContext) => {
      // Process the order
      context.emitEvent('PROCESS_ORDER', { 
        orderId: input.orderId,
        processedAt: new Date().toISOString()
      });
      
      return { 
        processed: true, 
        orderId: input.orderId,
        processingId: `proc-${input.orderId}`
      };
    }
  };
  
  const shipOrderTask: TaskDefinition = {
    id: 'ship-order',
    implementation: async (input: any, context: TaskContext) => {
      // Ship the order
      context.emitEvent('SHIP_ORDER', { 
        orderId: input.orderId,
        shippedAt: new Date().toISOString()
      });
      
      return { 
        shipped: true, 
        orderId: input.orderId,
        trackingId: `track-${input.orderId}`
      };
    }
  };
  
  const deliverOrderTask: TaskDefinition = {
    id: 'deliver-order',
    implementation: async (input: any, context: TaskContext) => {
      // Deliver the order
      context.emitEvent('DELIVER_ORDER', { 
        orderId: input.orderId,
        deliveredAt: new Date().toISOString()
      });
      
      return { 
        delivered: true, 
        orderId: input.orderId
      };
    }
  };
  
  const completeOrderTask: TaskDefinition = {
    id: 'complete-order',
    implementation: async (input: any, context: TaskContext) => {
      // Complete the order
      context.emitEvent('COMPLETE_ORDER', { 
        orderId: input.orderId,
        completedAt: new Date().toISOString()
      });
      
      return { 
        completed: true, 
        orderId: input.orderId
      };
    }
  };
  
  const refundOrderTask: TaskDefinition = {
    id: 'refund-order',
    implementation: async (input: any, context: TaskContext) => {
      // Refund the order
      context.emitEvent('REFUND_ORDER', { 
        orderId: input.orderId,
        refundedAt: new Date().toISOString()
      });
      
      return { 
        refunded: true, 
        orderId: input.orderId,
        refundId: `refund-${input.orderId}`
      };
    }
  };
  
  // Test for a complete order flow
  describe('End-to-End Order Processing Flow', () => {
    let runtime: ReturnType<typeof createRuntime>;
    let orderInstance: ProcessInstance;
    let eventLog: Event[] = [];
    
    beforeEach(() => {
      // Reset event log
      eventLog = [];
      
      // Create runtime with order process and tasks
      runtime = createRuntime(
        { 'order-process': orderProcessDefinition },
        { 
          'validate-order': validateOrderTask,
          'process-order': processOrderTask,
          'ship-order': shipOrderTask,
          'deliver-order': deliverOrderTask,
          'complete-order': completeOrderTask,
          'refund-order': refundOrderTask
        }
      );
      
      // Subscribe to all events and log them
      runtime.subscribe('*', (event) => {
        eventLog.push(event);
      });
      
      // Create an order instance
      orderInstance = runtime.createProcess('order-process', { 
        orderId: '12345',
        customer: 'John Doe',
        items: [
          { id: 'item-1', name: 'Product A', quantity: 2, price: 25.99 },
          { id: 'item-2', name: 'Product B', quantity: 1, price: 49.99 }
        ],
        total: 101.97
      });
    });
    
    it('should process an order through the complete flow', async () => {
      // Step 1: Validate the order
      const validateResult = await runtime.executeTask('validate-order', { 
        orderId: orderInstance.id,
        total: orderInstance.context.total
      });
      
      expect(validateResult.valid).toBe(true);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to validated state
      let currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('validated');
      
      // Step 2: Process the order
      const processResult = await runtime.executeTask('process-order', { 
        orderId: orderInstance.id 
      });
      
      expect(processResult.processed).toBe(true);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to processing state
      currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('processing');
      
      // Step 3: Ship the order
      const shipResult = await runtime.executeTask('ship-order', { 
        orderId: orderInstance.id 
      });
      
      expect(shipResult.shipped).toBe(true);
      expect(shipResult.trackingId).toBe(`track-${orderInstance.id}`);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to shipping state
      currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('shipping');
      
      // Step 4: Deliver the order
      const deliverResult = await runtime.executeTask('deliver-order', { 
        orderId: orderInstance.id 
      });
      
      expect(deliverResult.delivered).toBe(true);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to delivered state
      currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('delivered');
      
      // Step 5: Complete the order
      const completeResult = await runtime.executeTask('complete-order', { 
        orderId: orderInstance.id 
      });
      
      expect(completeResult.completed).toBe(true);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to completed state
      currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('completed');
      
      // Verify the event log contains all the expected events
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).toContain('VALIDATE_ORDER');
      expect(eventTypes).toContain('PROCESS_ORDER');
      expect(eventTypes).toContain('SHIP_ORDER');
      expect(eventTypes).toContain('DELIVER_ORDER');
      expect(eventTypes).toContain('COMPLETE_ORDER');
      
      // Verify the process history
      expect(currentInstance?.history).toHaveLength(5);
      expect(currentInstance?.history[0].from).toBe('created');
      expect(currentInstance?.history[0].to).toBe('validated');
      expect(currentInstance?.history[1].from).toBe('validated');
      expect(currentInstance?.history[1].to).toBe('processing');
      expect(currentInstance?.history[2].from).toBe('processing');
      expect(currentInstance?.history[2].to).toBe('shipping');
      expect(currentInstance?.history[3].from).toBe('shipping');
      expect(currentInstance?.history[3].to).toBe('delivered');
      expect(currentInstance?.history[4].from).toBe('delivered');
      expect(currentInstance?.history[4].to).toBe('completed');
    });
    
    it('should handle order cancellation and refund', async () => {
      // Step 1: Cancel the order
      runtime.transitionProcess(orderInstance.id, 'CANCEL_ORDER', {
        reason: 'Customer requested cancellation'
      });
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to cancelled state
      let currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('cancelled');
      expect(currentInstance?.context.reason).toBe('Customer requested cancellation');
      
      // Step 2: Refund the order
      const refundResult = await runtime.executeTask('refund-order', { 
        orderId: orderInstance.id 
      });
      
      expect(refundResult.refunded).toBe(true);
      expect(refundResult.refundId).toBe(`refund-${orderInstance.id}`);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to refunded state
      currentInstance = runtime.getProcess(orderInstance.id);
      expect(currentInstance?.state).toBe('refunded');
      
      // Verify the event log contains the expected events
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).toContain('CANCEL_ORDER');
      expect(eventTypes).toContain('REFUND_ORDER');
      
      // Verify the process history
      expect(currentInstance?.history).toHaveLength(2);
      expect(currentInstance?.history[0].from).toBe('created');
      expect(currentInstance?.history[0].to).toBe('cancelled');
      expect(currentInstance?.history[1].from).toBe('cancelled');
      expect(currentInstance?.history[1].to).toBe('refunded');
    });
    
    it('should automatically cancel invalid orders', async () => {
      // Create an invalid order with zero total
      const invalidOrderInstance = runtime.createProcess('order-process', { 
        orderId: 'invalid-1',
        customer: 'Jane Doe',
        items: [],
        total: 0
      });
      
      // Validate the order (should trigger cancellation due to guard condition)
      const validateResult = await runtime.executeTask('validate-order', { 
        orderId: invalidOrderInstance.id,
        total: invalidOrderInstance.context.total
      });
      
      expect(validateResult.valid).toBe(false);
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the process transitioned to cancelled state
      const currentInstance = runtime.getProcess(invalidOrderInstance.id);
      expect(currentInstance?.state).toBe('cancelled');
      
      // Verify the event log contains the cancellation event
      const cancelEvents = eventLog.filter(e => e.type === 'CANCEL_ORDER');
      expect(cancelEvents.length).toBeGreaterThan(0);
      
      // Find the specific cancellation event for this order
      const orderCancelEvent = cancelEvents.find(e => 
        e.payload?.orderId === invalidOrderInstance.id
      );
      
      expect(orderCancelEvent).toBeDefined();
      expect(orderCancelEvent?.payload?.reason).toBe('Invalid order total');
    });
  });
  
  describe('Concurrent Process Execution', () => {
    let runtime: ReturnType<typeof createRuntime>;
    
    beforeEach(() => {
      // Create runtime with order process and tasks
      runtime = createRuntime(
        { 'order-process': orderProcessDefinition },
        { 
          'validate-order': validateOrderTask,
          'process-order': processOrderTask,
          'ship-order': shipOrderTask
        }
      );
    });
    
    it('should handle multiple concurrent processes', async () => {
      // Create multiple order instances
      const order1 = runtime.createProcess('order-process', { 
        orderId: 'order-1',
        total: 100
      });
      
      const order2 = runtime.createProcess('order-process', { 
        orderId: 'order-2',
        total: 200
      });
      
      const order3 = runtime.createProcess('order-process', { 
        orderId: 'order-3',
        total: 300
      });
      
      // Process all orders concurrently
      await Promise.all([
        // Process order 1
        (async () => {
          await runtime.executeTask('validate-order', { 
            orderId: order1.id,
            total: order1.context.total
          });
          
          // Wait for events to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
          
          await runtime.executeTask('process-order', { 
            orderId: order1.id 
          });
          
          // Wait for events to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
          
          await runtime.executeTask('ship-order', { 
            orderId: order1.id 
          });
          
          // Wait for events to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
        })(),
        
        // Process order 2
        (async () => {
          await runtime.executeTask('validate-order', { 
            orderId: order2.id,
            total: order2.context.total
          });
          
          // Wait for events to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
          
          await runtime.executeTask('process-order', { 
            orderId: order2.id 
          });
          
          // Wait for events to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
        })(),
        
        // Process order 3 (just validate)
        (async () => {
          await runtime.executeTask('validate-order', { 
            orderId: order3.id,
            total: order3.context.total
          });
          
          // Wait for events to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
        })()
      ]);
      
      // Wait a bit more to ensure all events are processed
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Check the final states of each order
      const finalOrder1 = runtime.getProcess(order1.id);
      const finalOrder2 = runtime.getProcess(order2.id);
      const finalOrder3 = runtime.getProcess(order3.id);
      
      expect(finalOrder1?.state).toBe('shipping');
      expect(finalOrder2?.state).toBe('processing');
      expect(finalOrder3?.state).toBe('validated');
      
      // Verify all processes are still accessible
      const allProcesses = runtime.getAllProcesses();
      expect(allProcesses.length).toBe(3);
      
      // Each process should have the correct number of history entries
      expect(finalOrder1?.history.length).toBe(3); // created -> validated -> processing -> shipping
      expect(finalOrder2?.history.length).toBe(2); // created -> validated -> processing
      expect(finalOrder3?.history.length).toBe(1); // created -> validated
    });
  });
}); 