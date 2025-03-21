import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

// Mock the saga extension module
vi.mock('../../../src/extensions/saga.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/saga.extension.js');
  return {
    ...actual,
    setupSagaExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupSagaExtension, 
  SagaExtensionOptions, 
  SagaInstance,
  CompensationStrategy
} from '../../../src/extensions/saga.extension.js';

describe('Saga Extension', () => {
  let dsl: DSL;
  let sagaOptions: SagaExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    sagaOptions = {
      enableTransactionLogging: true,
      defaultCompensationStrategy: CompensationStrategy.BACKWARD
    };
    
    // Setup extension
    setupSagaExtension(dsl, sagaOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Saga Definition', () => {
    it('should allow defining saga components', () => {
      // Define a schema first
      const orderSchema = dsl.component('OrderSchema', {
        type: ComponentType.SCHEMA,
        description: 'Order schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          amount: { type: 'number' },
          items: { 
            type: 'array', 
            items: { 
              type: 'object', 
              properties: { 
                id: { type: 'string' }, 
                quantity: { type: 'number' } 
              } 
            } 
          }
        }
      });
      
      // Define tasks for the saga
      const createOrderTask = dsl.component('CreateOrder', {
        type: ComponentType.ACTOR,
        description: 'Create an order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderSchema' }
      });
      
      const processPaymentTask = dsl.component('ProcessPayment', {
        type: ComponentType.ACTOR,
        description: 'Process payment for an order',
        version: '1.0.0',
        input: { ref: 'PaymentInput' },
        output: { ref: 'PaymentResult' }
      });
      
      const updateInventoryTask = dsl.component('UpdateInventory', {
        type: ComponentType.ACTOR,
        description: 'Update inventory for items',
        version: '1.0.0',
        input: { ref: 'InventoryUpdate' },
        output: { ref: 'InventoryResult' }
      });

      // Define compensation tasks
      const cancelOrderTask = dsl.component('CancelOrder', {
        type: ComponentType.ACTOR,
        description: 'Cancel an order',
        version: '1.0.0',
        input: { ref: 'OrderCancellation' },
        output: { ref: 'CancellationResult' }
      });
      
      const refundPaymentTask = dsl.component('RefundPayment', {
        type: ComponentType.ACTOR,
        description: 'Refund a payment',
        version: '1.0.0',
        input: { ref: 'RefundInput' },
        output: { ref: 'RefundResult' }
      });
      
      const restoreInventoryTask = dsl.component('RestoreInventory', {
        type: ComponentType.ACTOR,
        description: 'Restore inventory levels',
        version: '1.0.0',
        input: { ref: 'InventoryRestore' },
        output: { ref: 'InventoryResult' }
      });
      
      // Define a saga component
      const orderProcessingSaga = dsl.component('OrderProcessingSaga', {
        type: ComponentType.SAGA,
        description: 'Order processing saga',
        version: '1.0.0',
        correlationProperty: 'orderId',
        steps: [
          {
            name: 'createOrder',
            task: { ref: 'CreateOrder' },
            compensation: { ref: 'CancelOrder' },
            output: {
              mapping: {
                'orderId': 'id',
                'customerId': 'customerId'
              }
            }
          },
          {
            name: 'processPayment',
            task: { ref: 'ProcessPayment' },
            compensation: { ref: 'RefundPayment' },
            input: {
              mapping: {
                'orderId': 'orderId',
                'amount': 'amount'
              }
            },
            output: {
              mapping: {
                'paymentId': 'id'
              }
            }
          },
          {
            name: 'updateInventory',
            task: { ref: 'UpdateInventory' },
            compensation: { ref: 'RestoreInventory' },
            input: {
              mapping: {
                'orderId': 'orderId',
                'items': 'items'
              }
            }
          }
        ]
      });

      // Verify the saga definition
      expect(orderProcessingSaga.id).toBe('OrderProcessingSaga');
      expect(orderProcessingSaga.type).toBe(ComponentType.SAGA);
      expect((orderProcessingSaga as any).steps.length).toBe(3);
      expect((orderProcessingSaga as any).correlationProperty).toBe('orderId');
    });
  });

  describe('Saga Execution', () => {
    it('should execute saga steps in sequence', async () => {
      // Setup mock tasks
      const createOrderMock = vi.fn().mockResolvedValue({ id: 'order-123', customerId: 'cust-123', amount: 100 });
      const processPaymentMock = vi.fn().mockResolvedValue({ id: 'pmt-123', status: 'completed' });
      const updateInventoryMock = vi.fn().mockResolvedValue({ updated: true });
      
      // Define tasks and implementations
      const createOrderTask = dsl.component('CreateOrder', {
        type: ComponentType.ACTOR,
        description: 'Create order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderSchema' }
      });
      
      const processPaymentTask = dsl.component('ProcessPayment', {
        type: ComponentType.ACTOR,
        description: 'Process payment',
        version: '1.0.0',
        input: { ref: 'PaymentInput' },
        output: { ref: 'PaymentResult' }
      });
      
      const updateInventoryTask = dsl.component('UpdateInventory', {
        type: ComponentType.ACTOR,
        description: 'Update inventory',
        version: '1.0.0',
        input: { ref: 'InventoryUpdate' },
        output: { ref: 'InventoryResult' }
      });
      
      // Implement tasks
      dsl.implement('CreateOrder', createOrderMock);
      dsl.implement('ProcessPayment', processPaymentMock);
      dsl.implement('UpdateInventory', updateInventoryMock);
      
      // Define the saga
      const orderSaga = dsl.component('OrderSaga', {
        type: ComponentType.SAGA,
        description: 'Order saga',
        version: '1.0.0',
        correlationProperty: 'orderId',
        steps: [
          {
            name: 'createOrder',
            task: { ref: 'CreateOrder' },
            output: {
              mapping: {
                'orderId': 'id',
                'amount': 'amount'
              }
            }
          },
          {
            name: 'processPayment',
            task: { ref: 'ProcessPayment' },
            input: {
              mapping: {
                'orderId': 'orderId',
                'amount': 'amount'
              }
            }
          },
          {
            name: 'updateInventory',
            task: { ref: 'UpdateInventory' },
            input: {
              mapping: {
                'orderId': 'orderId'
              }
            }
          }
        ]
      });
      
      // Mock task execution registry
      // This would normally be provided by the task extension
      const taskExecutor = vi.fn().mockImplementation(async (taskId, input, context) => {
        if (taskId === 'CreateOrder') return createOrderMock(input, context);
        if (taskId === 'ProcessPayment') return processPaymentMock(input, context);
        if (taskId === 'UpdateInventory') return updateInventoryMock(input, context);
        throw new Error(`Unknown task: ${taskId}`);
      });
      
      (dsl as any).executeTask = taskExecutor;
      
      // Execute the saga
      const saga = (orderSaga as any).start({ customerId: 'cust-123', items: [{ id: 'prod-1', quantity: 2 }] });
      
      // Complete the saga execution
      const result = await saga.execute();
      
      // Verify tasks were executed in order
      expect(createOrderMock).toHaveBeenCalledTimes(1);
      expect(processPaymentMock).toHaveBeenCalledTimes(1);
      expect(updateInventoryMock).toHaveBeenCalledTimes(1);
      
      // Verify call order
      expect(createOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({ 
          customerId: 'cust-123',
          items: expect.arrayContaining([{ id: 'prod-1', quantity: 2 }])
        }),
        expect.any(Object)
      );
      
      expect(processPaymentMock).toHaveBeenCalledWith(
        expect.objectContaining({ 
          orderId: 'order-123',
          amount: 100
        }),
        expect.any(Object)
      );
      
      expect(updateInventoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-123' }),
        expect.any(Object)
      );
      
      // Verify saga result
      expect(result.status).toBe('COMPLETED');
      expect(result.data).toEqual(expect.objectContaining({
        orderId: 'order-123',
        amount: 100
      }));
    });
    
    it('should handle saga failure and run compensations', async () => {
      // Setup tasks: first two succeed, third fails
      const createOrderMock = vi.fn().mockResolvedValue({ id: 'order-123', customerId: 'cust-123', amount: 100 });
      const processPaymentMock = vi.fn().mockResolvedValue({ id: 'pmt-123', status: 'completed' });
      const updateInventoryMock = vi.fn().mockRejectedValue(new Error('Inventory not available'));
      
      // Setup compensation tasks
      const cancelOrderMock = vi.fn().mockResolvedValue({ cancelled: true });
      const refundPaymentMock = vi.fn().mockResolvedValue({ refunded: true });
      
      // Define tasks
      dsl.component('CreateOrder', {
        type: ComponentType.ACTOR,
        description: 'Create order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderSchema' }
      });
      
      dsl.component('ProcessPayment', {
        type: ComponentType.ACTOR,
        description: 'Process payment',
        version: '1.0.0',
        input: { ref: 'PaymentInput' },
        output: { ref: 'PaymentResult' }
      });
      
      dsl.component('UpdateInventory', {
        type: ComponentType.ACTOR,
        description: 'Update inventory',
        version: '1.0.0',
        input: { ref: 'InventoryUpdate' },
        output: { ref: 'InventoryResult' }
      });
      
      dsl.component('CancelOrder', {
        type: ComponentType.ACTOR,
        description: 'Cancel order',
        version: '1.0.0',
        input: { ref: 'OrderCancellation' },
        output: { ref: 'CancellationResult' }
      });
      
      dsl.component('RefundPayment', {
        type: ComponentType.ACTOR,
        description: 'Refund payment',
        version: '1.0.0',
        input: { ref: 'RefundInput' },
        output: { ref: 'RefundResult' }
      });
      
      // Implement tasks
      dsl.implement('CreateOrder', createOrderMock);
      dsl.implement('ProcessPayment', processPaymentMock);
      dsl.implement('UpdateInventory', updateInventoryMock);
      dsl.implement('CancelOrder', cancelOrderMock);
      dsl.implement('RefundPayment', refundPaymentMock);
      
      // Define a saga with compensations
      const orderSaga = dsl.component('OrderSaga', {
        type: ComponentType.SAGA,
        description: 'Order saga with compensations',
        version: '1.0.0',
        correlationProperty: 'orderId',
        steps: [
          {
            name: 'createOrder',
            task: { ref: 'CreateOrder' },
            compensation: { ref: 'CancelOrder' },
            output: {
              mapping: {
                'orderId': 'id',
                'amount': 'amount'
              }
            }
          },
          {
            name: 'processPayment',
            task: { ref: 'ProcessPayment' },
            compensation: { ref: 'RefundPayment' },
            input: {
              mapping: {
                'orderId': 'orderId',
                'amount': 'amount'
              }
            },
            output: {
              mapping: {
                'paymentId': 'id'
              }
            }
          },
          {
            name: 'updateInventory',
            task: { ref: 'UpdateInventory' },
            input: {
              mapping: {
                'orderId': 'orderId'
              }
            }
          }
        ]
      });
      
      // Mock task execution
      const taskExecutor = vi.fn().mockImplementation(async (taskId, input, context) => {
        if (taskId === 'CreateOrder') return createOrderMock(input, context);
        if (taskId === 'ProcessPayment') return processPaymentMock(input, context);
        if (taskId === 'UpdateInventory') return updateInventoryMock(input, context);
        if (taskId === 'CancelOrder') return cancelOrderMock(input, context);
        if (taskId === 'RefundPayment') return refundPaymentMock(input, context);
        throw new Error(`Unknown task: ${taskId}`);
      });
      
      (dsl as any).executeTask = taskExecutor;
      
      // Execute the saga
      const saga = (orderSaga as any).start({ customerId: 'cust-123', items: [{ id: 'prod-1', quantity: 2 }] });
      
      try {
        await saga.execute();
        fail('Saga should have thrown an error');
      } catch (error) {
        // Expected - saga failed
        
        // Verify compensations were executed in reverse order
        expect(refundPaymentMock).toHaveBeenCalledTimes(1);
        expect(cancelOrderMock).toHaveBeenCalledTimes(1);
        
        // Verify compensation parameters
        expect(refundPaymentMock).toHaveBeenCalledWith(
          expect.objectContaining({ 
            paymentId: 'pmt-123'
          }),
          expect.any(Object)
        );
        
        expect(cancelOrderMock).toHaveBeenCalledWith(
          expect.objectContaining({ 
            orderId: 'order-123'
          }),
          expect.any(Object)
        );
        
        // Verify saga status
        expect(saga.getStatus()).toBe('FAILED_WITH_COMPENSATION');
        expect(saga.getError()).toEqual(expect.objectContaining({
          message: 'Inventory not available'
        }));
      }
    });
  });

  describe('Saga Persistence and Recovery', () => {
    it('should support serializing and deserializing saga state', async () => {
      // Define a simple saga
      const purchaseSaga = dsl.component('PurchaseSaga', {
        type: ComponentType.SAGA,
        description: 'Purchase saga',
        version: '1.0.0',
        correlationProperty: 'orderId',
        steps: [
          {
            name: 'reserveInventory',
            task: { ref: 'ReserveInventory' },
            compensation: { ref: 'ReleaseInventory' }
          },
          {
            name: 'processPayment',
            task: { ref: 'ProcessPayment' },
            compensation: { ref: 'RefundPayment' }
          }
        ]
      });
      
      // Start a saga instance
      const saga = (purchaseSaga as any).start({ 
        orderId: 'order-123', 
        productId: 'prod-1', 
        quantity: 2,
        amount: 100
      });
      
      // Mock a partial execution
      (saga as any).stepResults = [
        { step: 'reserveInventory', result: { reserved: true, inventoryId: 'inv-123' } }
      ];
      (saga as any).currentStepIndex = 1;
      (saga as any).data = { 
        orderId: 'order-123', 
        productId: 'prod-1', 
        quantity: 2,
        amount: 100,
        reserved: true, 
        inventoryId: 'inv-123' 
      };
      
      // Serialize the saga state
      const serialized = saga.serialize();
      
      // Verify it contains the necessary information
      expect(serialized).toMatchObject({
        id: expect.any(String),
        sagaId: 'PurchaseSaga',
        correlationId: 'order-123',
        status: 'IN_PROGRESS',
        currentStepIndex: 1,
        data: {
          orderId: 'order-123',
          productId: 'prod-1',
          quantity: 2,
          amount: 100,
          reserved: true,
          inventoryId: 'inv-123'
        },
        stepResults: [
          { 
            step: 'reserveInventory', 
            result: { reserved: true, inventoryId: 'inv-123' } 
          }
        ]
      });
      
      // Deserialize to create a new instance
      const restoredSaga = (purchaseSaga as any).deserialize(serialized);
      
      // Verify the restored instance has the correct state
      expect(restoredSaga.getId()).toBe(serialized.id);
      expect(restoredSaga.getCurrentStepIndex()).toBe(1);
      expect(restoredSaga.getData()).toMatchObject({
        orderId: 'order-123',
        productId: 'prod-1',
        reserved: true,
        inventoryId: 'inv-123'
      });
      
      // Should be able to continue execution
      const processPaymentResult = { paymentId: 'pmt-456', status: 'completed' };
      
      // Mock task execution
      (dsl as any).executeTask = vi.fn().mockResolvedValue(processPaymentResult);
      
      // Continue execution
      const result = await restoredSaga.continueExecution();
      
      // Verify final state
      expect(result.status).toBe('COMPLETED');
      expect(restoredSaga.getCurrentStepIndex()).toBe(2);
      expect(restoredSaga.getData()).toMatchObject({
        orderId: 'order-123',
        reserved: true,
        inventoryId: 'inv-123',
        paymentId: 'pmt-456',
        status: 'completed'
      });
    });
  });

  describe('Saga Integration with System', () => {
    it('should register sagas with the system', () => {
      // Define schemas and tasks
      dsl.component('OrderSchema', {
        type: ComponentType.SCHEMA,
        description: 'Order schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          amount: { type: 'number' }
        }
      });
      
      dsl.component('CreateOrder', {
        type: ComponentType.ACTOR,
        description: 'Create order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderSchema' }
      });
      
      dsl.component('ProcessPayment', {
        type: ComponentType.ACTOR,
        description: 'Process payment',
        version: '1.0.0',
        input: { ref: 'PaymentInput' },
        output: { ref: 'PaymentResult' }
      });
      
      // Define a saga
      const orderSaga = dsl.component('OrderSaga', {
        type: ComponentType.SAGA,
        description: 'Order saga',
        version: '1.0.0',
        correlationProperty: 'orderId',
        steps: [
          {
            name: 'createOrder',
            task: { ref: 'CreateOrder' }
          },
          {
            name: 'processPayment',
            task: { ref: 'ProcessPayment' }
          }
        ]
      });
      
      // Define a system
      const ecommerceSystem = dsl.system('EcommerceSystem', {
        description: 'E-commerce system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'OrderSchema' }],
          tasks: [
            { ref: 'CreateOrder' },
            { ref: 'ProcessPayment' }
          ],
          sagas: [
            { ref: 'OrderSaga' }
          ]
        }
      });
      
      // Verify sagas are registered
      expect((ecommerceSystem as any).components.sagas).toHaveLength(1);
      expect((ecommerceSystem as any).components.sagas[0].ref).toBe('OrderSaga');
      
      // Verify system can access sagas
      expect(typeof (ecommerceSystem as any).getSagas).toBe('function');
      
      // Get sagas from the system
      const sagas = (ecommerceSystem as any).getSagas();
      expect(sagas).toHaveLength(1);
      expect(sagas[0].id).toBe('OrderSaga');
    });
  });
}); 