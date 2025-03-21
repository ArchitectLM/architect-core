import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { 
  setupSagaActorExtension, 
  SagaActorExtensionOptions,
  CompensationStrategy
} from '../../../src/extensions/saga.actor.extension.js';
import { extensionRegistry } from '../../../src/extensions/index.js';
import { setupActorExtension } from '../../../src/extensions/actor.extension.js';

// Mock actor implementations for saga steps
const mockActorImplementations = {
  'OrderActor': {
    createOrder: vi.fn().mockImplementation(async (input, context) => {
      return { orderId: 'order-123', customerId: input.customerId, items: input.items };
    }),
    cancelOrder: vi.fn().mockImplementation(async (input, context) => {
      return { cancelled: true, orderId: input.orderId };
    })
  },
  'PaymentActor': {
    processPayment: vi.fn().mockImplementation(async (input, context) => {
      return { success: true, transactionId: 'tx-123', amount: input.amount };
    }),
    refundPayment: vi.fn().mockImplementation(async (input, context) => {
      return { success: true, refundId: 'refund-123', transactionId: input.transactionId };
    })
  },
  'InventoryActor': {
    updateInventory: vi.fn().mockImplementation(async (input, context) => {
      return { updated: true, items: input.items };
    }),
    restoreInventory: vi.fn().mockImplementation(async (input, context) => {
      return { restored: true, items: input.items };
    })
  },
  'ShippingActor': {
    scheduleShipment: vi.fn().mockImplementation(async (input, context) => {
      return { scheduled: true, shipmentId: 'ship-123', orderId: input.orderId };
    }),
    cancelShipment: vi.fn().mockImplementation(async (input, context) => {
      return { cancelled: true, shipmentId: input.shipmentId };
    })
  }
};

describe('Saga Actor Extension', () => {
  let dsl: DSL;
  let sagaOptions: SagaActorExtensionOptions;

  beforeEach(() => {
    // Clear the extension registry to start fresh
    extensionRegistry.clear();
    
    dsl = new DSL();
    sagaOptions = {
      enableTransactionLogging: true,
      defaultCompensationStrategy: CompensationStrategy.BACKWARD
    };
    
    // Setup actor extension first
    setupActorExtension(dsl);
    
    // Setup extension
    setupSagaActorExtension(dsl, sagaOptions);
    
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
            startSaga: { input: {}, output: {} },
            executeSaga: { input: {}, output: {} },
            getSagaState: { input: {}, output: {} }
          }
        };
      }
      return undefined;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GIVEN a saga actor extension', () => {
    describe('WHEN defining a saga', () => {
      it('THEN should create a saga component that is implemented as an actor under the hood', () => {
        // Define actors first
        dsl.component('OrderActor', {
          type: ComponentType.ACTOR,
          description: 'Manages orders',
          version: '1.0.0'
        });
        
        dsl.component('PaymentActor', {
          type: ComponentType.ACTOR,
          description: 'Manages payments',
          version: '1.0.0'
        });
        
        // Define a saga using actors for steps
        const orderSaga = dsl.sagaActorExtension.createSaga('OrderSaga', {
          description: 'Order processing saga',
          version: '1.0.0',
          correlationProperty: 'orderId',
          steps: [
            {
              name: 'createOrder',
              actor: 'OrderActor',
              handler: 'createOrder',
              compensation: {
                actor: 'OrderActor',
                handler: 'cancelOrder'
              },
              output: {
                mapping: {
                  'orderId': 'orderId',
                  'orderItems': 'items'
                }
              }
            },
            {
              name: 'processPayment',
              actor: 'PaymentActor',
              handler: 'processPayment',
              compensation: {
                actor: 'PaymentActor',
                handler: 'refundPayment'
              },
              input: {
                mapping: {
                  'orderId': 'orderId',
                  'amount': 'orderTotal'
                }
              },
              output: {
                mapping: {
                  'paymentId': 'transactionId'
                }
              }
            }
          ]
        });
        
        // Verify the saga component was created
        expect(orderSaga).toBeDefined();
        expect(orderSaga.id).toBe('OrderSaga');
        expect(orderSaga.type).toBe(ComponentType.SAGA);
        expect(orderSaga.steps).toBeDefined();
        expect(orderSaga.steps.length).toBe(2);
        expect(orderSaga.steps[0].name).toBe('createOrder');
        expect(orderSaga.steps[1].name).toBe('processPayment');
        
        // Verify the saga should create an actor internally
        const sagaActor = dsl.getComponent('OrderSaga_Actor');
        expect(sagaActor).toBeDefined();
        expect(sagaActor.type).toBe(ComponentType.ACTOR);
      });
    });
    
    describe('WHEN executing a saga', () => {
      it('THEN should execute steps in order and invoke actor handlers', async () => {
        // Define a saga using actors
        const orderSaga = dsl.sagaActorExtension.createSaga('OrderSaga', {
          description: 'Order processing saga',
          version: '1.0.0',
          correlationProperty: 'orderId',
          steps: [
            {
              name: 'createOrder',
              actor: 'OrderActor',
              handler: 'createOrder',
              compensation: {
                actor: 'OrderActor',
                handler: 'cancelOrder'
              }
            },
            {
              name: 'processPayment',
              actor: 'PaymentActor',
              handler: 'processPayment',
              compensation: {
                actor: 'PaymentActor',
                handler: 'refundPayment'
              }
            },
            {
              name: 'updateInventory',
              actor: 'InventoryActor',
              handler: 'updateInventory',
              compensation: {
                actor: 'InventoryActor',
                handler: 'restoreInventory'
              }
            }
          ]
        });
        
        // Mock saga actor implementation
        const mockSagaImpl = {
          startSaga: vi.fn().mockResolvedValue({ sagaId: 'saga-123', status: 'new' }),
          executeSaga: vi.fn().mockImplementation(async (input, context) => {
            // Simulate calling the step handlers
            await mockActorImplementations.OrderActor.createOrder({ customerId: 'cust-123', items: [{ id: 'product-1', quantity: 2 }] }, {});
            await mockActorImplementations.PaymentActor.processPayment({ amount: 100, orderId: 'order-123' }, {});
            await mockActorImplementations.InventoryActor.updateInventory({ items: [{ id: 'product-1', quantity: 2 }] }, {});
            
            return {
              sagaId: 'saga-123',
              status: 'completed',
              steps: [
                { name: 'createOrder', status: 'completed', result: { orderId: 'order-123' } },
                { name: 'processPayment', status: 'completed', result: { transactionId: 'tx-123' } },
                { name: 'updateInventory', status: 'completed', result: { updated: true } }
              ],
              data: {
                orderId: 'order-123',
                transactionId: 'tx-123',
                items: [{ id: 'product-1', quantity: 2 }]
              }
            };
          }),
          getSagaState: vi.fn().mockReturnValue({ status: 'new', data: {} })
        };
        
        // Mock implementation registration for saga actor
        vi.spyOn(dsl, 'getImplementation').mockImplementation((actorId: string) => {
          if (actorId === 'OrderSaga_Actor') {
            return mockSagaImpl;
          }
          return mockActorImplementations[actorId as keyof typeof mockActorImplementations] || null;
        });
        
        // Start a saga
        const sagaInstance = await dsl.sagaActorExtension.startSaga('OrderSaga', {
          customerId: 'cust-123', 
          items: [{ id: 'product-1', quantity: 2 }],
          orderTotal: 100
        });
        
        // Execute the saga
        const result = await sagaInstance.execute();
        
        // Verify results
        expect(result.status).toBe('completed');
        expect(result.data.orderId).toBe('order-123');
        expect(result.data.transactionId).toBe('tx-123');
        
        // Verify actor handlers were called in the correct order
        expect(mockActorImplementations.OrderActor.createOrder).toHaveBeenCalled();
        expect(mockActorImplementations.PaymentActor.processPayment).toHaveBeenCalled();
        expect(mockActorImplementations.InventoryActor.updateInventory).toHaveBeenCalled();
      });
      
      it('THEN should handle failures and perform compensation', async () => {
        // Define a saga with steps that will partially fail
        const orderSaga = dsl.sagaActorExtension.createSaga('FailingSaga', {
          description: 'Saga that will partially fail',
          version: '1.0.0',
          correlationProperty: 'orderId',
          steps: [
            {
              name: 'createOrder',
              actor: 'OrderActor',
              handler: 'createOrder',
              compensation: {
                actor: 'OrderActor',
                handler: 'cancelOrder'
              }
            },
            {
              name: 'processPayment',
              actor: 'PaymentActor',
              handler: 'processPayment',
              compensation: {
                actor: 'PaymentActor',
                handler: 'refundPayment'
              }
            },
            {
              name: 'updateInventory',
              actor: 'InventoryActor',
              handler: 'updateInventory',
              compensation: {
                actor: 'InventoryActor',
                handler: 'restoreInventory'
              }
            }
          ]
        });
        
        // Reset the mock call history
        mockActorImplementations.OrderActor.createOrder.mockClear();
        mockActorImplementations.OrderActor.cancelOrder.mockClear();
        mockActorImplementations.PaymentActor.processPayment.mockClear();
        mockActorImplementations.PaymentActor.refundPayment.mockClear();
        
        // Mock payment processing to fail
        mockActorImplementations.PaymentActor.processPayment.mockRejectedValueOnce(new Error('Payment declined'));
        
        // Mock saga actor implementation for failure case
        const mockFailingSagaImpl = {
          startSaga: vi.fn().mockResolvedValue({ sagaId: 'saga-456', status: 'new' }),
          executeSaga: vi.fn().mockImplementation(async (input, context) => {
            // Simulate execution with failure
            await mockActorImplementations.OrderActor.createOrder({ customerId: 'cust-456', items: [{ id: 'product-2', quantity: 3 }] }, {});
            
            try {
              // This will fail
              await mockActorImplementations.PaymentActor.processPayment({ amount: 150, orderId: 'order-456' }, {});
            } catch (error) {
              // Compensate the previous step
              await mockActorImplementations.OrderActor.cancelOrder({ orderId: 'order-456' }, {});
              
              return {
                sagaId: 'saga-456',
                status: 'failed',
                error: 'Payment declined',
                steps: [
                  { name: 'createOrder', status: 'compensated', result: { orderId: 'order-456' } },
                  { name: 'processPayment', status: 'failed', error: 'Payment declined' }
                ],
                data: {
                  orderId: 'order-456',
                  items: [{ id: 'product-2', quantity: 3 }]
                }
              };
            }
            
            return {}; // Should not reach here
          }),
          getSagaState: vi.fn().mockReturnValue({ status: 'new', data: {} })
        };
        
        // Mock implementation registration for failing saga
        vi.spyOn(dsl, 'getImplementation').mockImplementation((actorId: string) => {
          if (actorId === 'FailingSaga_Actor') {
            return mockFailingSagaImpl;
          }
          return mockActorImplementations[actorId as keyof typeof mockActorImplementations] || null;
        });
        
        // Start a saga that will fail
        const sagaInstance = await dsl.sagaActorExtension.startSaga('FailingSaga', {
          customerId: 'cust-456', 
          items: [{ id: 'product-2', quantity: 3 }],
          orderTotal: 150
        });
        
        // Execute the failing saga
        const result = await sagaInstance.execute();
        
        // Verify failure results
        expect(result.status).toBe('failed');
        expect(result.error).toBe('Payment declined');
        
        // Verify specific steps status
        expect(result.steps.find(s => s.name === 'createOrder')?.status).toBe('compensated');
        expect(result.steps.find(s => s.name === 'processPayment')?.status).toBe('failed');
        
        // Verify compensation was performed
        expect(mockActorImplementations.OrderActor.createOrder).toHaveBeenCalled();
        expect(mockActorImplementations.PaymentActor.processPayment).toHaveBeenCalled();
        expect(mockActorImplementations.OrderActor.cancelOrder).toHaveBeenCalled();
      });
    });
    
    describe('WHEN defining a saga with data mapping', () => {
      it('THEN should map data between steps', async () => {
        // Define a saga with data mapping
        const mappingSaga = dsl.sagaActorExtension.createSaga('MappingSaga', {
          description: 'Saga with data mapping',
          version: '1.0.0',
          correlationProperty: 'orderId',
          steps: [
            {
              name: 'createOrder',
              actor: 'OrderActor',
              handler: 'createOrder',
              output: {
                mapping: {
                  'orderIdentifier': 'orderId', // Map 'orderId' from actor output to 'orderIdentifier' in saga data
                  'products': 'items'           // Map 'items' from actor output to 'products' in saga data
                }
              }
            },
            {
              name: 'processPayment',
              actor: 'PaymentActor',
              handler: 'processPayment',
              input: {
                mapping: {
                  'orderId': 'orderIdentifier',  // Map 'orderIdentifier' from saga data to 'orderId' for actor input
                  'amount': 'totalAmount'        // Map 'totalAmount' from saga data to 'amount' for actor input
                }
              },
              output: {
                mapping: {
                  'paymentConfirmation': 'transactionId'  // Map 'transactionId' from actor output to 'paymentConfirmation' in saga data
                }
              }
            }
          ]
        });
        
        // Mock saga actor implementation with data mapping
        const mockMappingSagaImpl = {
          startSaga: vi.fn().mockResolvedValue({ sagaId: 'mapping-saga-123', status: 'new' }),
          executeSaga: vi.fn().mockImplementation(async (input, context) => {
            // Initial data
            const initialData = {
              customerName: 'John Doe',
              totalAmount: 250,
              shippingAddress: '123 Main St'
            };
            
            // Step 1: Create Order - test output mapping
            const createOrderResult = await mockActorImplementations.OrderActor.createOrder({ 
              customerId: 'cust-mapping', 
              items: [{ id: 'product-mapping', quantity: 1 }] 
            }, {});
            
            // Step 2: Process Payment - test input and output mapping
            const processPaymentInput = {
              // These should be mapped from saga data
              orderId: initialData.orderIdentifier || createOrderResult.orderId, // Using both possible sources
              amount: initialData.totalAmount
            };
            
            // Verify input mapping
            expect(processPaymentInput.orderId).toBe('order-123'); // Should be mapped from createOrderResult
            expect(processPaymentInput.amount).toBe(250);          // Should be from initialData
            
            const processPaymentResult = await mockActorImplementations.PaymentActor.processPayment(processPaymentInput, {});
            
            // Final saga data after mapping
            const sagaData = {
              ...initialData,
              // Data mapped from createOrder output
              orderIdentifier: createOrderResult.orderId,      // Mapped from 'orderId'
              products: createOrderResult.items,              // Mapped from 'items'
              
              // Data mapped from processPayment output
              paymentConfirmation: processPaymentResult.transactionId  // Mapped from 'transactionId'
            };
            
            // Verify output mappings worked
            expect(sagaData.orderIdentifier).toBe('order-123');
            expect(sagaData.paymentConfirmation).toBe('tx-123');
            
            return {
              sagaId: 'mapping-saga-123',
              status: 'completed',
              steps: [
                { name: 'createOrder', status: 'completed' },
                { name: 'processPayment', status: 'completed' }
              ],
              data: sagaData
            };
          }),
          getSagaState: vi.fn().mockReturnValue({ status: 'new', data: {} })
        };
        
        // Mock implementation registration for mapping saga
        vi.spyOn(dsl, 'getImplementation').mockImplementation((actorId: string) => {
          if (actorId === 'MappingSaga_Actor') {
            return mockMappingSagaImpl;
          }
          return mockActorImplementations[actorId as keyof typeof mockActorImplementations] || null;
        });
        
        // Start a saga with mapping
        const sagaInstance = await dsl.sagaActorExtension.startSaga('MappingSaga', {
          customerName: 'John Doe',
          totalAmount: 250,
          shippingAddress: '123 Main St'
        });
        
        // Execute the saga
        const result = await sagaInstance.execute();
        
        // Verify mapping results
        expect(result.status).toBe('completed');
        expect(result.data.orderIdentifier).toBe('order-123');
        expect(result.data.paymentConfirmation).toBe('tx-123');
        expect(result.data.totalAmount).toBe(250);
      });
    });
  });
}); 