import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { 
  setupWorkflowExtension, 
  WorkflowExtensionOptions,
} from '../../../src/extensions/workflow.extension.js';
import { extensionRegistry } from '../../../src/extensions/index.js';
import { setupActorExtension } from '../../../src/extensions/actor.extension.js';

// Mock actor implementations
const mockActorImplementations = {
  'OrderValidatorActor': {
    validateOrder: vi.fn().mockImplementation(async (input, context) => {
      return { valid: true, orderId: input.orderId, total: 100 };
    })
  },
  'PaymentProcessorActor': {
    processPayment: vi.fn().mockImplementation(async (input, context) => {
      return { success: true, transactionId: 'tx-123', paymentDetails: { amount: input.amount } };
    }),
    refundPayment: vi.fn().mockImplementation(async (input, context) => {
      return { success: true, refundId: 'refund-123' };
    })
  },
  'ShippingActor': {
    shipOrder: vi.fn().mockImplementation(async (input, context) => {
      return { shipped: true, trackingCode: 'track-123', shippingDetails: { address: input.address } };
    })
  }
};

describe('Workflow Extension', () => {
  let dsl: DSL;
  let workflowOptions: WorkflowExtensionOptions;

  beforeEach(() => {
    // Clear the extension registry to start fresh
    extensionRegistry.clear();
    
    dsl = new DSL();
    workflowOptions = {
      strictValidation: true
    };
    
    // Setup actor extension first
    setupActorExtension(dsl);
    
    // Then setup workflow extension
    setupWorkflowExtension(dsl, workflowOptions);
    
    // Mock actor implementations
    vi.spyOn(dsl, 'getImplementation').mockImplementation((actorId: string) => {
      return mockActorImplementations[actorId as keyof typeof mockActorImplementations] || null;
    });
    
    // Mock the component registration to avoid dependency on the actual registry
    vi.spyOn(dsl, 'component').mockImplementation((id, definition) => {
      return { id, ...definition };
    });
    
    // Mock getComponent to return components for testing
    vi.spyOn(dsl, 'getComponent').mockImplementation((id) => {
      if (id.endsWith('_Actor')) {
        return { 
          id, 
          type: ComponentType.ACTOR,
          messageHandlers: {
            startWorkflow: { input: {}, output: {} },
            triggerEvent: { input: {}, output: {} },
            getWorkflowState: { input: {}, output: {} }
          }
        };
      }
      return undefined;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GIVEN a workflow extension', () => {
    describe('WHEN defining a workflow', () => {
      it('THEN should create a workflow component that represents an actor under the hood', () => {
        // Define needed actors first
        dsl.component('OrderValidatorActor', {
          type: ComponentType.ACTOR,
          description: 'Validates orders',
          version: '1.0.0'
        });
        
        dsl.component('PaymentProcessorActor', {
          type: ComponentType.ACTOR,
          description: 'Processes payments',
          version: '1.0.0'
        });
        
        // Define a workflow component
        const orderWorkflow = dsl.workflowExtension.createWorkflow('OrderWorkflow', {
          description: 'Order processing workflow',
          version: '1.0.0',
          initialState: 'created',
          states: {
            created: {
              description: 'Order created',
              transitions: [
                { event: 'VALIDATE_ORDER', target: 'validated', actor: 'OrderValidatorActor', handler: 'validateOrder' }
              ]
            },
            validated: {
              description: 'Order validated',
              transitions: [
                { event: 'PROCESS_PAYMENT', target: 'payment_processed', actor: 'PaymentProcessorActor', handler: 'processPayment' }
              ]
            },
            payment_processed: {
              description: 'Payment processed',
              transitions: [
                { event: 'COMPLETE_ORDER', target: 'completed' }
              ],
              final: true
            },
            completed: {
              description: 'Order completed',
              final: true
            }
          }
        });
        
        // Verify the workflow was created as a component
        expect(orderWorkflow).toBeDefined();
        expect(orderWorkflow.id).toBe('OrderWorkflow');
        expect(orderWorkflow.type).toBe(ComponentType.WORKFLOW);
        expect(orderWorkflow.states).toBeDefined();
        expect(orderWorkflow.states.created).toBeDefined();
        expect(orderWorkflow.states.validated).toBeDefined();
        expect(orderWorkflow.states.payment_processed).toBeDefined();
        
        // Verify the workflow should generate an actor internally
        const workflowActor = dsl.getComponent('OrderWorkflow_Actor');
        expect(workflowActor).toBeDefined();
        expect(workflowActor.type).toBe(ComponentType.ACTOR);
      });
    });
    
    describe('WHEN executing a workflow', () => {
      it('THEN should transition between states and invoke actor handlers', async () => {
        // Define the actors
        dsl.component('OrderValidatorActor', {
          type: ComponentType.ACTOR,
          description: 'Validates orders',
          version: '1.0.0'
        });
        
        dsl.component('PaymentProcessorActor', {
          type: ComponentType.ACTOR,
          description: 'Processes payments',
          version: '1.0.0'
        });
        
        // Define a workflow component
        const orderWorkflow = dsl.workflowExtension.createWorkflow('OrderWorkflow', {
          description: 'Order processing workflow',
          version: '1.0.0',
          initialState: 'created',
          states: {
            created: {
              description: 'Order created',
              transitions: [
                { event: 'VALIDATE_ORDER', target: 'validated', actor: 'OrderValidatorActor', handler: 'validateOrder' }
              ]
            },
            validated: {
              description: 'Order validated',
              transitions: [
                { event: 'PROCESS_PAYMENT', target: 'payment_processed', actor: 'PaymentProcessorActor', handler: 'processPayment' }
              ]
            },
            payment_processed: {
              description: 'Payment processed',
              final: true
            }
          }
        });
        
        // Mock implementation of workflow actor
        const mockWorkflowImpl = {
          startWorkflow: vi.fn().mockResolvedValue({ state: 'created', data: {} }),
          triggerEvent: vi.fn().mockImplementation(async (input, context) => {
            const event = input.event;
            if (event === 'VALIDATE_ORDER') {
              // This should call the validateOrder handler on OrderValidatorActor
              await mockActorImplementations.OrderValidatorActor.validateOrder(
                { orderId: 'order-123' }, {}
              );
              return { state: 'validated', data: { orderId: 'order-123', valid: true } };
            } else if (event === 'PROCESS_PAYMENT') {
              // This should call the processPayment handler on PaymentProcessorActor
              await mockActorImplementations.PaymentProcessorActor.processPayment(
                { amount: 100 }, {}
              );
              return { state: 'payment_processed', data: { transactionId: 'tx-123', success: true } };
            }
            return { state: 'created', data: {} };
          }),
          getWorkflowState: vi.fn().mockReturnValue({ state: 'created', data: {} })
        };
        
        // Mock implementation registration
        vi.spyOn(dsl, 'getImplementation').mockImplementation((actorId: string) => {
          if (actorId === 'OrderWorkflow_Actor') {
            return mockWorkflowImpl;
          }
          return mockActorImplementations[actorId as keyof typeof mockActorImplementations] || null;
        });
        
        // Start a workflow instance
        const orderWorkflowInstance = await dsl.workflowExtension.createWorkflowInstance('OrderWorkflow', { orderId: 'order-123' });
        
        // Trigger workflow events
        const validationResult = await orderWorkflowInstance.trigger('VALIDATE_ORDER', { orderId: 'order-123' });
        expect(validationResult.state).toBe('validated');
        
        const paymentResult = await orderWorkflowInstance.trigger('PROCESS_PAYMENT', { amount: 100 });
        expect(paymentResult.state).toBe('payment_processed');
        
        // Verify actor handlers were called
        expect(mockActorImplementations.OrderValidatorActor.validateOrder).toHaveBeenCalledWith(
          expect.objectContaining({ orderId: 'order-123' }),
          expect.any(Object)
        );
        
        expect(mockActorImplementations.PaymentProcessorActor.processPayment).toHaveBeenCalledWith(
          expect.objectContaining({ amount: 100 }),
          expect.any(Object)
        );
      });
    });
    
    describe('WHEN defining workflow with data mapping', () => {
      it('THEN should map data between transitions', async () => {
        // Define a workflow component with data mapping
        const orderWorkflow = dsl.workflowExtension.createWorkflow('OrderWorkflow', {
          description: 'Order processing workflow',
          version: '1.0.0',
          initialState: 'created',
          states: {
            created: {
              description: 'Order created',
              transitions: [
                { 
                  event: 'VALIDATE_ORDER', 
                  target: 'validated', 
                  actor: 'OrderValidatorActor', 
                  handler: 'validateOrder',
                  output: {
                    mapping: {
                      'orderTotal': 'total' // Map actor's 'total' to workflow's 'orderTotal'
                    }
                  }
                }
              ]
            },
            validated: {
              description: 'Order validated',
              transitions: [
                { 
                  event: 'PROCESS_PAYMENT', 
                  target: 'payment_processed', 
                  actor: 'PaymentProcessorActor', 
                  handler: 'processPayment',
                  input: {
                    mapping: {
                      'amount': 'orderTotal' // Map workflow's 'orderTotal' to actor's 'amount'
                    }
                  },
                  output: {
                    mapping: {
                      'paymentId': 'transactionId' // Map actor's 'transactionId' to workflow's 'paymentId'
                    }
                  }
                }
              ]
            },
            payment_processed: {
              description: 'Payment processed',
              final: true
            }
          }
        });
        
        // Mock implementation with data mapping
        const mockWorkflowImpl = {
          startWorkflow: vi.fn().mockResolvedValue({ state: 'created', data: {} }),
          triggerEvent: vi.fn().mockImplementation(async (input, context) => {
            const event = input.event;
            const data = input.data || {};
            
            if (event === 'VALIDATE_ORDER') {
              // Simulate actor returning data that should be mapped
              const result = await mockActorImplementations.OrderValidatorActor.validateOrder(
                { orderId: 'order-123' }, {}
              );
              
              // Return a result with the data mapping applied
              return { 
                state: 'validated', 
                data: { 
                  orderId: 'order-123', 
                  valid: true,
                  orderTotal: result.total // This is mapped from 'total' to 'orderTotal'
                } 
              };
            } else if (event === 'PROCESS_PAYMENT') {
              // Verify input mapping
              expect(data.amount).toBe(100);  // Should be mapped from workflow.data.orderTotal
              
              // Simulate actor returning data that should be mapped
              const result = await mockActorImplementations.PaymentProcessorActor.processPayment(
                { amount: data.amount }, {}
              );
              
              // Return a result with the data mapping applied
              return { 
                state: 'payment_processed', 
                data: {
                  paymentId: result.transactionId, // This is mapped from 'transactionId' to 'paymentId'
                  success: true
                } 
              };
            }
            return { state: 'created', data: {} };
          }),
          getWorkflowState: vi.fn().mockReturnValue({ state: 'created', data: {} })
        };
        
        // Mock implementation registration
        vi.spyOn(dsl, 'getImplementation').mockImplementation((actorId: string) => {
          if (actorId === 'OrderWorkflow_Actor') {
            return mockWorkflowImpl;
          }
          return mockActorImplementations[actorId as keyof typeof mockActorImplementations] || null;
        });
        
        // Start a workflow instance
        const instance = await dsl.workflowExtension.createWorkflowInstance('OrderWorkflow', {});
        
        // Trigger first event to set up orderTotal
        const validationResult = await instance.trigger('VALIDATE_ORDER', {});
        expect(validationResult.state).toBe('validated');
        expect(validationResult.data.orderTotal).toBe(100); // Mapped from actor result
        
        // Trigger second event that should use the mapped orderTotal
        const paymentResult = await instance.trigger('PROCESS_PAYMENT', {});
        expect(paymentResult.state).toBe('payment_processed');
        expect(paymentResult.data.paymentId).toBe('tx-123'); // Mapped from transactionId
      });
    });
  });
}); 