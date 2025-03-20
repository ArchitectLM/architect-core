import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the process extension module
vi.mock('../../src/extensions/process.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/process.extension.js');
  return {
    ...actual,
    setupProcessExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupProcessExtension, 
  ProcessExtensionOptions
} from '../../src/extensions/process.extension.js';

describe('Process Extension', () => {
  let dsl: DSL;
  let processOptions: ProcessExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    processOptions = {
      enablePersistence: true,
      historySize: 50,
      autoValidateTransitions: true
    };
    
    // Setup extension
    setupProcessExtension(dsl, processOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Process Definition', () => {
    it('should enhance process components with execution methods', () => {
      // Define a simple process
      const orderProcess = dsl.component('OrderProcess', {
        type: ComponentType.PROCESS,
        description: 'Order processing process',
        version: '1.0.0',
        initialState: 'created',
        states: {
          created: {
            description: 'Order has been created',
            transitions: [
              { to: 'processing', on: 'START_PROCESSING' }
            ]
          },
          processing: {
            description: 'Order is being processed',
            transitions: [
              { to: 'shipped', on: 'SHIP_ORDER' }
            ],
            task: { ref: 'ProcessOrder' }
          },
          shipped: {
            description: 'Order has been shipped',
            transitions: [
              { to: 'delivered', on: 'DELIVER_ORDER' }
            ]
          },
          delivered: {
            description: 'Order has been delivered',
            final: true
          },
          cancelled: {
            description: 'Order has been cancelled',
            final: true
          }
        }
      });
      
      // Extension should add start method to process
      expect(typeof (orderProcess as any).start).toBe('function');
      
      // Extension should add transition method
      expect(typeof (orderProcess as any).transition).toBe('function');
      
      // Extension should add getAvailableTransitions method
      expect(typeof (orderProcess as any).getAvailableTransitions).toBe('function');
      
      // Extension should add getCurrentState method
      expect(typeof (orderProcess as any).getCurrentState).toBe('function');
      
      // Extension should add getHistory method
      expect(typeof (orderProcess as any).getHistory).toBe('function');
    });
    
    it('should support complex process definitions with nested states', () => {
      // Define a process with nested states
      const complexProcess = dsl.component('ComplexProcess', {
        type: ComponentType.PROCESS,
        description: 'Complex process with nested states',
        version: '1.0.0',
        initialState: 'idle',
        states: {
          idle: {
            description: 'Process is waiting to start',
            onEnter: { task: { ref: 'LogEntry' } },
            onExit: { task: { ref: 'LogExit' } },
            transitions: [
              { to: 'processing', on: 'START_PROCESSING' }
            ]
          },
          processing: {
            description: 'Process is processing',
            nested: {
              initialState: 'validate',
              states: {
                validate: { 
                  description: 'Validating input',
                  task: { ref: 'ValidateOrder' },
                  transitions: [
                    { to: 'compute', on: 'VALIDATION_COMPLETE' }
                  ]
                },
                compute: { 
                  description: 'Computing results',
                  task: { ref: 'ComputeOrderTotal' },
                  transitions: [
                    { to: 'finalize', on: 'COMPUTATION_COMPLETE' }
                  ]
                },
                finalize: { 
                  description: 'Finalizing process',
                  task: { ref: 'FinalizeOrder' },
                  transitions: [
                    { to: 'processing.complete', on: 'FINALIZATION_COMPLETE' }
                  ]
                },
                complete: {
                  description: 'Processing complete',
                  transitions: [
                    { to: 'completed', on: 'PROCESSING_COMPLETE' }
                  ]
                }
              }
            }
          },
          completed: {
            description: 'Process has completed successfully',
            final: true
          },
          failed: {
            description: 'Process has failed',
            final: true,
            onEnter: { task: { ref: 'LogFailure' } }
          }
        }
      });
      
      // Should have methods for working with complex processes
      expect(typeof (complexProcess as any).start).toBe('function');
      expect(typeof (complexProcess as any).getNestedState).toBe('function');
      expect(typeof (complexProcess as any).transitionNested).toBe('function');
      
      // Should be able to get states and transitions
      const allStates = (complexProcess as any).getAllStates();
      const allTransitions = (complexProcess as any).getAllTransitions();
      
      expect(allStates).toContain('idle');
      expect(allStates).toContain('processing');
      expect(allStates).toContain('processing.validate');
      expect(allStates).toContain('processing.compute');
      
      expect(allTransitions).toContainEqual(
        expect.objectContaining({ from: 'idle', to: 'processing' })
      );
      expect(allTransitions).toContainEqual(
        expect.objectContaining({ from: 'processing.validate', to: 'processing.compute' })
      );
    });
  });

  describe('Process Execution', () => {
    it('should allow starting a process instance and tracking state', () => {
      // Define a process
      const simpleProcess = dsl.component('SimpleProcess', {
        type: ComponentType.PROCESS,
        description: 'Simple test process',
        version: '1.0.0',
        initialState: 'start',
        states: {
          start: {
            description: 'Starting state',
            transitions: [
              { to: 'middle', on: 'GO_TO_MIDDLE' }
            ]
          },
          middle: {
            description: 'Middle state',
            transitions: [
              { to: 'end', on: 'GO_TO_END' }
            ],
            task: { ref: 'DoSomething' }
          },
          end: {
            description: 'End state',
            final: true
          }
        }
      });
      
      // Start a process instance
      const instance = (simpleProcess as any).start({ id: 'instance-1' });
      
      // Verify initial state
      expect(instance.getCurrentState()).toBe('start');
      
      // Verify available transitions
      const availableTransitions = instance.getAvailableTransitions();
      expect(availableTransitions).toHaveLength(1);
      expect(availableTransitions[0].to).toBe('middle');
      expect(availableTransitions[0].on).toBe('GO_TO_MIDDLE');
      
      // Perform a transition
      instance.transition('GO_TO_MIDDLE', { data: 'test' });
      
      // Verify new state
      expect(instance.getCurrentState()).toBe('middle');
      
      // Verify history is tracked
      const history = instance.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].from).toBe('start');
      expect(history[0].to).toBe('middle');
      expect(history[0].event).toBe('GO_TO_MIDDLE');
      expect(history[0].timestamp).toBeDefined();
      
      // Verify history has the data payload
      expect(history[0].data).toEqual({ data: 'test' });
    });
    
    it('should execute tasks associated with states', async () => {
      // Define task implementations
      const validateTaskMock = vi.fn().mockResolvedValue({ valid: true });
      const processTaskMock = vi.fn().mockResolvedValue({ processed: true });
      
      // Define a process with tasks
      const orderProcess = dsl.component('OrderProcess', {
        type: ComponentType.PROCESS,
        description: 'Order process with tasks',
        version: '1.0.0',
        initialState: 'validating',
        states: {
          validating: {
            description: 'Validating the order',
            task: { ref: 'ValidateOrder' },
            transitions: [
              { to: 'processing', on: 'ORDER_VALID', condition: 'isValid' }
            ]
          },
          processing: {
            description: 'Processing the order',
            task: { ref: 'ProcessOrder' },
            transitions: [
              { to: 'completed', on: 'ORDER_PROCESSED' }
            ]
          },
          completed: {
            description: 'Order has been processed',
            final: true
          }
        }
      });
      
      // Register task implementations
      dsl.implement('ValidateOrder', validateTaskMock);
      dsl.implement('ProcessOrder', processTaskMock);
      
      // Register condition
      (orderProcess as any).registerCondition('isValid', 
        (data: any) => data && data.valid === true
      );
      
      // Start process instance
      const instance = await (orderProcess as any).start({ orderId: 'order-123' });
      
      // Validate task should be executed automatically when entering the state
      expect(validateTaskMock).toHaveBeenCalledWith(
        { orderId: 'order-123' },
        expect.any(Object)
      );
      
      // Simulate transition based on task result
      const validationResult = await validateTaskMock.mock.results[0].value;
      await instance.transition('ORDER_VALID', validationResult);
      
      // Process task should be executed
      expect(processTaskMock).toHaveBeenCalled();
      expect(instance.getCurrentState()).toBe('processing');
    });
    
    it('should handle conditional transitions', () => {
      // Define a process with conditional transitions
      const approvalProcess = dsl.component('ApprovalProcess', {
        type: ComponentType.PROCESS,
        description: 'Approval process with conditions',
        version: '1.0.0',
        initialState: 'pending',
        states: {
          pending: {
            description: 'Request is pending approval',
            transitions: [
              { 
                to: 'approved', 
                on: 'APPROVE',
                condition: 'canApprove'
              },
              { 
                to: 'rejected', 
                on: 'REJECT' 
              }
            ]
          },
          approved: {
            description: 'Request is approved',
            final: true
          },
          rejected: {
            description: 'Request is rejected',
            final: true
          }
        }
      });
      
      // Register condition handlers
      const canApprove = vi.fn().mockImplementation((data, context) => {
        return data.amount <= 1000 || context.user?.role === 'admin';
      });
      
      (approvalProcess as any).registerCondition('canApprove', canApprove);
      
      // Start a process instance
      const instance = (approvalProcess as any).start({ id: 'request-1', amount: 500 });
      
      // Transition should succeed (amount <= 1000)
      instance.transition('APPROVE', { amount: 500 });
      expect(instance.getCurrentState()).toBe('approved');
      
      // Create another instance with higher amount
      const instance2 = (approvalProcess as any).start({ id: 'request-2', amount: 2000 });
      
      // Transition should fail (amount > 1000, not admin)
      expect(() => {
        instance2.transition('APPROVE', { amount: 2000 });
      }).toThrow(/condition failed/i);
      
      // Transition should succeed with admin context
      instance2.transition('APPROVE', { amount: 2000 }, { user: { role: 'admin' } });
      expect(instance2.getCurrentState()).toBe('approved');
    });
  });
  
  describe('Process Event Integration', () => {
    it('should react to events and trigger transitions', () => {
      // Define a process that reacts to events
      const orderProcess = dsl.component('OrderProcess', {
        type: ComponentType.PROCESS,
        description: 'Order process with event reactions',
        version: '1.0.0',
        initialState: 'created',
        states: {
          created: {
            description: 'Order has been created',
            transitions: [
              { to: 'processing', on: 'ORDER_SUBMITTED' }
            ]
          },
          processing: {
            description: 'Order is being processed',
            transitions: [
              { to: 'shipped', on: 'ORDER_SHIPPED' },
              { to: 'cancelled', on: 'ORDER_CANCELLED' }
            ]
          },
          shipped: {
            description: 'Order has been shipped',
            transitions: [
              { to: 'delivered', on: 'ORDER_DELIVERED' }
            ]
          },
          delivered: {
            description: 'Order has been delivered',
            final: true
          },
          cancelled: {
            description: 'Order has been cancelled',
            final: true
          }
        },
        events: {
          'OrderSubmitted': 'ORDER_SUBMITTED',
          'OrderShipped': 'ORDER_SHIPPED',
          'OrderDelivered': 'ORDER_DELIVERED',
          'OrderCancelled': 'ORDER_CANCELLED'
        }
      });
      
      // Mock event handler
      const eventHandler = vi.fn();
      (dsl as any).events = {
        on: vi.fn(),
        emit: eventHandler
      };
      
      // Setup event listener for process
      (orderProcess as any).setupEventListeners();
      
      // Start a process instance
      const instance = (orderProcess as any).start({ orderId: 'order-123' });
      expect(instance.getCurrentState()).toBe('created');
      
      // Emit an event
      const event = {
        type: 'OrderSubmitted',
        payload: { orderId: 'order-123' }
      };
      
      // Call the event handler directly (since we're mocking the event bus)
      const eventListener = (dsl as any).events.on.mock.calls[0][1];
      eventListener(event);
      
      // Process should have transitioned
      expect(instance.getCurrentState()).toBe('processing');
    });
  });
  
  describe('Process Persistence', () => {
    it('should support serializing and deserializing process state', () => {
      // Define a process
      const shippingProcess = dsl.component('ShippingProcess', {
        type: ComponentType.PROCESS,
        description: 'Shipping process',
        version: '1.0.0',
        initialState: 'preparing',
        states: {
          preparing: {
            description: 'Preparing for shipment',
            transitions: [
              { to: 'shipped', on: 'SHIP' }
            ]
          },
          shipped: {
            description: 'Package has been shipped',
            transitions: [
              { to: 'delivered', on: 'DELIVER' }
            ]
          },
          delivered: {
            description: 'Package has been delivered',
            final: true
          }
        }
      });
      
      // Start a process instance and advance it
      const instance = (shippingProcess as any).start({ packageId: 'pkg-123' });
      instance.transition('SHIP', { trackingId: 'trk-123' });
      
      // Serialize the process state
      const serialized = instance.serialize();
      
      // Verify it contains the necessary information
      expect(serialized).toMatchObject({
        id: expect.any(String),
        processId: 'ShippingProcess',
        currentState: 'shipped',
        data: { packageId: 'pkg-123', trackingId: 'trk-123' },
        history: expect.arrayContaining([
          expect.objectContaining({
            from: 'preparing',
            to: 'shipped',
            event: 'SHIP'
          })
        ])
      });
      
      // Deserialize to create a new instance
      const restoredInstance = (shippingProcess as any).deserialize(serialized);
      
      // Verify the restored instance has the correct state
      expect(restoredInstance.getCurrentState()).toBe('shipped');
      expect(restoredInstance.getData()).toMatchObject({ 
        packageId: 'pkg-123', 
        trackingId: 'trk-123' 
      });
      
      // Should be able to continue the process
      restoredInstance.transition('DELIVER', { deliveredAt: new Date().toISOString() });
      expect(restoredInstance.getCurrentState()).toBe('delivered');
      expect(restoredInstance.isCompleted()).toBe(true);
    });
  });
}); 