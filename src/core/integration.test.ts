import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineSystem } from './system';
import { defineProcess } from './process';
import { defineTask } from './task';
import { createRuntime } from './runtime';
import { SystemConfig, ProcessDefinition, TaskDefinition, TaskContext, Event } from './types';

describe('Integration Tests', () => {
  describe('System with Processes and Tasks', () => {
    it('should create a complete system with processes and tasks', () => {
      // Arrange
      // Define a task
      const processOrderTask: TaskDefinition = {
        id: 'process-order',
        implementation: async (input: any, context: TaskContext) => {
          return { processed: true, orderId: input.orderId };
        }
      };
      
      // Define a process
      const orderProcess: ProcessDefinition = {
        id: 'order-process',
        states: ['created', 'processing', 'completed', 'cancelled'],
        initialState: 'created',
        transitions: [
          { from: 'created', to: 'processing', on: 'START_PROCESSING' },
          { from: 'processing', to: 'completed', on: 'COMPLETE' },
          { from: 'processing', to: 'cancelled', on: 'CANCEL' },
          { from: 'created', to: 'cancelled', on: 'CANCEL' }
        ]
      };
      
      // Define the system config
      const systemConfig: SystemConfig = {
        id: 'order-system',
        description: 'Order processing system',
        processes: {
          'order-process': orderProcess
        },
        tasks: {
          'process-order': processOrderTask
        }
      };
      
      // Act
      const system = defineSystem(systemConfig);
      
      // Assert
      expect(system.id).toBe('order-system');
      expect(system.processes['order-process']).toEqual(orderProcess);
      expect(system.tasks['process-order']).toEqual(processOrderTask);
    });
  });

  describe('Process and Task Integration', () => {
    let runtime: ReturnType<typeof createRuntime>;
    let processOrderTask: TaskDefinition;
    let noEventTask: TaskDefinition;
    let orderProcess: ProcessDefinition;
    
    beforeEach(() => {
      // Define a task with event emission
      processOrderTask = {
        id: 'process-order',
        implementation: async (input: any, context: TaskContext) => {
          // Emit an event that will trigger a process transition
          context.emitEvent('COMPLETE', { orderId: input.orderId, completedBy: 'system' });
          return { processed: true, orderId: input.orderId };
        }
      };
      
      // Define a task without event emission
      noEventTask = {
        id: 'no-event-task',
        implementation: async (input: any, context: TaskContext) => {
          return { processed: true, orderId: input.orderId };
        }
      };
      
      // Define a process
      orderProcess = {
        id: 'order-process',
        states: ['created', 'processing', 'completed', 'cancelled'],
        initialState: 'created',
        transitions: [
          { from: 'created', to: 'processing', on: 'START_PROCESSING' },
          { from: 'processing', to: 'completed', on: 'COMPLETE' },
          { from: 'processing', to: 'cancelled', on: 'CANCEL' },
          { from: 'created', to: 'cancelled', on: 'CANCEL' }
        ]
      };
      
      // Create runtime
      runtime = createRuntime(
        { 'order-process': orderProcess },
        { 
          'process-order': processOrderTask,
          'no-event-task': noEventTask
        }
      );
    });
    
    it('should execute a task when a process transitions state', async () => {
      // Arrange
      const taskSpy = vi.spyOn(noEventTask, 'implementation');
      const eventHandler = vi.fn();
      
      // Subscribe to task events
      runtime.subscribeToEvent('TASK_STARTED', eventHandler);
      
      // Create a process instance
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      // Transition to processing state
      const updatedInstance = runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Execute the task manually (in a real system, this might be triggered automatically)
      await runtime.executeTask('no-event-task', { orderId: '12345' });
      
      // Assert
      expect(updatedInstance.state).toBe('processing');
      expect(taskSpy).toHaveBeenCalledWith(
        { orderId: '12345' },
        expect.anything()
      );
      expect(eventHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_STARTED',
        payload: expect.objectContaining({
          taskId: 'no-event-task'
        })
      }));
    });
    
    it('should update process state based on task execution result', async () => {
      // Arrange
      // Create a process instance
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Transition to processing state
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Act
      // Execute the task which will emit a COMPLETE event
      await runtime.executeTask('process-order', { orderId: '12345' });
      
      // Get the updated instance
      const updatedInstance = runtime.getProcess(instance.id);
      
      // Assert
      expect(updatedInstance?.state).toBe('completed');
    });
  });

  describe('Event Propagation', () => {
    let runtime: ReturnType<typeof createRuntime>;
    
    beforeEach(() => {
      // Define processes and tasks
      const orderProcess: ProcessDefinition = {
        id: 'order-process',
        states: ['created', 'processing', 'completed'],
        transitions: [
          { from: 'created', to: 'processing', on: 'START_PROCESSING' },
          { from: 'processing', to: 'completed', on: 'ORDER_SHIPPED' }
        ]
      };
      
      const shipmentProcess: ProcessDefinition = {
        id: 'shipment-process',
        states: ['pending', 'shipped', 'delivered'],
        transitions: [
          { from: 'pending', to: 'shipped', on: 'SHIP_ORDER' },
          { from: 'shipped', to: 'delivered', on: 'DELIVERY_CONFIRMED' }
        ]
      };
      
      const processOrderTask: TaskDefinition = {
        id: 'process-order',
        implementation: async (input: any, context: TaskContext) => {
          // Emit an event to trigger shipment
          context.emitEvent('SHIP_ORDER', { orderId: input.orderId });
          return { processed: true };
        }
      };
      
      const shipOrderTask: TaskDefinition = {
        id: 'ship-order',
        implementation: async (input: any, context: TaskContext) => {
          // Emit an event to update order status
          context.emitEvent('ORDER_SHIPPED', { orderId: input.orderId });
          return { shipped: true };
        }
      };
      
      // Create runtime
      runtime = createRuntime(
        { 
          'order-process': orderProcess,
          'shipment-process': shipmentProcess
        },
        {
          'process-order': processOrderTask,
          'ship-order': shipOrderTask
        }
      );
    });
    
    it('should trigger process transitions based on events', async () => {
      // Arrange
      // Create process instances
      const orderInstance = runtime.createProcess('order-process', { orderId: '12345' });
      const shipmentInstance = runtime.createProcess('shipment-process', { orderId: '12345' });
      
      // Transition order to processing
      runtime.transitionProcess(orderInstance.id, 'START_PROCESSING');
      
      // Act
      // Execute process-order task which emits SHIP_ORDER
      await runtime.executeTask('process-order', { orderId: '12345' });
      
      // Execute ship-order task which emits ORDER_SHIPPED
      await runtime.executeTask('ship-order', { orderId: '12345' });
      
      // Get updated instances
      const updatedOrderInstance = runtime.getProcess(orderInstance.id);
      const updatedShipmentInstance = runtime.getProcess(shipmentInstance.id);
      
      // Assert
      expect(updatedShipmentInstance?.state).toBe('shipped');
      expect(updatedOrderInstance?.state).toBe('completed');
    });
    
    it('should emit events when process state changes', () => {
      // Arrange
      const stateChangeHandler = vi.fn();
      runtime.subscribeToEvent('STATE_CHANGED', stateChangeHandler);
      
      // Create a process instance
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert
      expect(stateChangeHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'STATE_CHANGED',
        payload: expect.objectContaining({
          instanceId: instance.id,
          previousState: 'created',
          newState: 'processing'
        })
      }));
    });
  });

  describe('Error Handling', () => {
    let runtime: ReturnType<typeof createRuntime>;
    
    beforeEach(() => {
      // Define a process
      const orderProcess: ProcessDefinition = {
        id: 'order-process',
        states: ['created', 'processing', 'completed', 'error'],
        transitions: [
          { from: 'created', to: 'processing', on: 'START_PROCESSING' },
          { from: 'processing', to: 'completed', on: 'COMPLETE' },
          { from: 'processing', to: 'error', on: 'ERROR' },
          { from: '*', to: 'error', on: 'GLOBAL_ERROR' }
        ]
      };
      
      // Define tasks
      const successTask: TaskDefinition = {
        id: 'success-task',
        implementation: async () => ({ success: true })
      };
      
      const failingTask: TaskDefinition = {
        id: 'failing-task',
        implementation: async () => {
          throw new Error('Task execution failed');
        }
      };
      
      const errorHandlingTask: TaskDefinition = {
        id: 'error-handling-task',
        implementation: async (input: any, context: TaskContext) => {
          try {
            await context.executeTask('failing-task', {});
            return { success: true };
          } catch (error) {
            // Emit error event
            context.emitEvent('ERROR', { error: (error as Error).message });
            return { success: false, error: (error as Error).message };
          }
        }
      };
      
      // Create runtime
      runtime = createRuntime(
        { 'order-process': orderProcess },
        {
          'success-task': successTask,
          'failing-task': failingTask,
          'error-handling-task': errorHandlingTask
        }
      );
    });
    
    it('should handle errors in task execution', async () => {
      // Arrange
      const errorHandler = vi.fn();
      runtime.subscribeToEvent('TASK_FAILED', errorHandler);
      
      // Act & Assert
      await expect(runtime.executeTask('failing-task', {})).rejects.toThrow('Task execution failed');
      
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_FAILED',
        payload: expect.objectContaining({
          taskId: 'failing-task',
          error: expect.any(Error)
        })
      }));
    });
    
    it('should handle invalid state transitions', () => {
      // Arrange
      // Create a process instance in created state
      const instance = runtime.createProcess('order-process', {});
      
      // Act & Assert
      // Try to transition directly to completed (invalid)
      expect(() => runtime.transitionProcess(instance.id, 'COMPLETE')).not.toThrow();
      
      // Verify state didn't change
      const updatedInstance = runtime.getProcess(instance.id);
      expect(updatedInstance?.state).toBe('created');
    });
    
    it('should transition to error state when task fails and emits ERROR event', async () => {
      // Arrange
      // Create a process instance
      const instance = runtime.createProcess('order-process', {});
      
      // Transition to processing
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Act
      await runtime.executeTask('error-handling-task', {});
      
      // Assert
      const updatedInstance = runtime.getProcess(instance.id);
      expect(updatedInstance?.state).toBe('error');
    });
  });
});

// Flow-based tests that follow the execution flow of the system
describe('Flow-Based Tests', () => {
  it('should follow the complete execution flow', async () => {
    // Define components
    const notifyCustomerTask: TaskDefinition = {
      id: 'notify-customer',
      implementation: async (input: any, context: TaskContext) => {
        // In a real system, this would send an email or notification
        return { notified: true, customer: input.customerId };
      }
    };
    
    const processOrderTask: TaskDefinition = {
      id: 'process-order',
      implementation: async (input: any, context: TaskContext) => {
        // Process the order and then notify the customer
        const result = { processed: true, orderId: input.orderId };
        
        // Emit event to trigger notification
        context.emitEvent('ORDER_PROCESSED', { 
          orderId: input.orderId,
          customerId: input.customerId
        });
        
        return result;
      }
    };
    
    const orderProcess: ProcessDefinition = {
      id: 'order-process',
      states: ['created', 'processing', 'processed', 'completed'],
      transitions: [
        { from: 'created', to: 'processing', on: 'START_PROCESSING' },
        { from: 'processing', to: 'processed', on: 'ORDER_PROCESSED' },
        { from: 'processed', to: 'completed', on: 'CUSTOMER_NOTIFIED' }
      ]
    };
    
    const notificationProcess: ProcessDefinition = {
      id: 'notification-process',
      states: ['pending', 'sent'],
      transitions: [
        { from: 'pending', to: 'sent', on: 'NOTIFICATION_SENT' }
      ]
    };
    
    // Create runtime
    const runtime = createRuntime(
      {
        'order-process': orderProcess,
        'notification-process': notificationProcess
      },
      {
        'process-order': processOrderTask,
        'notify-customer': notifyCustomerTask
      }
    );
    
    // Set up event handlers
    const eventLog: Event[] = [];
    const eventHandler = vi.fn((event: Event) => {
      eventLog.push(event);
    });
    
    runtime.subscribeToEvent('*', eventHandler);
    
    // 1. Create process instances
    const orderInstance = runtime.createProcess('order-process', { 
      orderId: '12345',
      customerId: 'cust-1'
    });
    
    const notificationInstance = runtime.createProcess('notification-process', {
      orderId: '12345',
      customerId: 'cust-1'
    });
    
    // 2. Start order processing
    runtime.transitionProcess(orderInstance.id, 'START_PROCESSING');
    
    // 3. Execute the process-order task
    await runtime.executeTask('process-order', { 
      orderId: '12345',
      customerId: 'cust-1'
    });
    
    // 4. Execute the notify-customer task
    await runtime.executeTask('notify-customer', { 
      orderId: '12345',
      customerId: 'cust-1'
    });
    
    // 5. Complete the notification process
    runtime.emitEvent('NOTIFICATION_SENT', { 
      orderId: '12345',
      customerId: 'cust-1'
    });
    
    // 6. Complete the order process
    runtime.emitEvent('CUSTOMER_NOTIFIED', { 
      orderId: '12345',
      customerId: 'cust-1'
    });
    
    // Get final process states
    const finalOrderInstance = runtime.getProcess(orderInstance.id);
    const finalNotificationInstance = runtime.getProcess(notificationInstance.id);
    
    // Verify the flow
    expect(finalOrderInstance?.state).toBe('completed');
    expect(finalNotificationInstance?.state).toBe('sent');
    
    // Verify events were emitted in the correct order
    const eventTypes = eventLog.map(e => e.type);
    
    // Check key events in the flow
    expect(eventTypes).toContain('PROCESS_CREATED');
    expect(eventTypes).toContain('STATE_CHANGED');
    expect(eventTypes).toContain('TASK_STARTED');
    expect(eventTypes).toContain('TASK_COMPLETED');
    expect(eventTypes).toContain('ORDER_PROCESSED');
    expect(eventTypes).toContain('NOTIFICATION_SENT');
    expect(eventTypes).toContain('CUSTOMER_NOTIFIED');
    
    // Verify the order of key state transitions
    const stateChanges = eventLog
      .filter(e => e.type === 'STATE_CHANGED' && e.payload.processId === 'order-process')
      .map(e => e.payload.newState);
    
    expect(stateChanges).toEqual(['processing', 'processed', 'completed']);
  });
}); 