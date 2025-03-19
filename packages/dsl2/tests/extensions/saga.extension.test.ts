import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the saga extension module to test
vi.mock('../../src/extensions/saga.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/saga.extension.js');
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
  SagaDefinition,
  SagaStep,
  CompensationStrategy
} from '../../src/extensions/saga.extension.js';

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
      
      // Define commands for the saga
      const createOrder = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create an order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderSchema' }
      });
      
      const processPayment = dsl.component('ProcessPayment', {
        type: ComponentType.COMMAND,
        description: 'Process payment for an order',
        version: '1.0.0',
        input: { ref: 'PaymentInput' },
        output: { ref: 'PaymentResult' }
      });
      
      const updateInventory = dsl.component('UpdateInventory', {
        type: ComponentType.COMMAND,
        description: 'Update inventory for items',
        version: '1.0.0',
        input: { ref: 'InventoryUpdate' },
        output: { ref: 'InventoryResult' }
      });

      // Define compensation commands
      const cancelOrder = dsl.component('CancelOrder', {
        type: ComponentType.COMMAND,
        description: 'Cancel an order',
        version: '1.0.0',
        input: { ref: 'OrderCancellation' },
        output: { ref: 'CancellationResult' }
      });
      
      const refundPayment = dsl.component('RefundPayment', {
        type: ComponentType.COMMAND,
        description: 'Refund a payment',
        version: '1.0.0',
        input: { ref: 'RefundInput' },
        output: { ref: 'RefundResult' }
      });
      
      const restoreInventory = dsl.component('RestoreInventory', {
        type: ComponentType.COMMAND,
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
            command: { ref: 'CreateOrder' },
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
            command: { ref: 'ProcessPayment' },
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
            command: { ref: 'UpdateInventory' },
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
      // Setup mock commands
      const createOrderMock = vi.fn().mockResolvedValue({ id: 'order-123', customerId: 'cust-123', amount: 100 });
      const processPaymentMock = vi.fn().mockResolvedValue({ id: 'pmt-123', status: 'completed' });
      const updateInventoryMock = vi.fn().mockResolvedValue({ updated: true });
      
      // Define commands and implementations
      const createOrder = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderSchema' }
      });
      
      const processPayment = dsl.component('ProcessPayment', {
        type: ComponentType.COMMAND,
        description: 'Process payment',
        version: '1.0.0',
        input: { ref: 'PaymentInput' },
        output: { ref: 'PaymentResult' }
      });
      
      const updateInventory = dsl.component('UpdateInventory', {
        type: ComponentType.COMMAND,
        description: 'Update inventory',
        version: '1.0.0',
        input: { ref: 'InventoryUpdate' },
        output: { ref: 'InventoryResult' }
      });
      
      // Implement commands
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
            command: { ref: 'CreateOrder' },
            output: {
              mapping: {
                'orderId': 'id',
                'amount': 'amount'
              }
            }
          },
          {
            name: 'processPayment',
            command: { ref: 'ProcessPayment' },
            input: {
              mapping: {
                'orderId': 'orderId',
                'amount': 'amount'
              }
            }
          },
          {
            name: 'updateInventory',
            command: { ref: 'UpdateInventory' },
            input: {
              mapping: {
                'orderId': 'orderId'
              }
            }
          }
        ]
      });
      
      // Execute the saga
      const sagaInput = { 
        customerName: 'John Doe',
        items: [{ id: 'item-1', quantity: 2 }],
        shippingAddress: '123 Main St'
      };
      
      const result = await (orderSaga as any).execute(sagaInput);
      
      // Verify all steps were executed in sequence
      expect(createOrderMock).toHaveBeenCalledWith(sagaInput, expect.any(Object));
      expect(processPaymentMock).toHaveBeenCalledWith(
        expect.objectContaining({ 
          orderId: 'order-123',
          amount: 100
        }),
        expect.any(Object)
      );
      expect(updateInventoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ 
          orderId: 'order-123'
        }),
        expect.any(Object)
      );
      
      // Verify saga result
      expect(result.status).toBe('COMPLETED');
      expect(result.data).toMatchObject({
        orderId: 'order-123',
        amount: 100
      });
    });
    
    it('should apply data mappings between steps', async () => {
      // Setup mock implementations
      const step1Mock = vi.fn().mockResolvedValue({ id: 'entity-1', name: 'Test', value: 42 });
      const step2Mock = vi.fn().mockResolvedValue({ result: 'success', processedId: 'proc-1' });
      
      // Define commands
      dsl.component('Step1', { 
        type: ComponentType.COMMAND, 
        description: 'Step 1', 
        version: '1.0.0',
        input: { ref: 'Step1Input' }, 
        output: { ref: 'Step1Output' } 
      });
      dsl.component('Step2', { 
        type: ComponentType.COMMAND, 
        description: 'Step 2', 
        version: '1.0.0',
        input: { ref: 'Step2Input' }, 
        output: { ref: 'Step2Output' } 
      });
      
      // Implement commands
      dsl.implement('Step1', step1Mock);
      dsl.implement('Step2', step2Mock);
      
      // Define saga with mappings
      const dataMappingSaga = dsl.component('DataMappingSaga', {
        type: ComponentType.SAGA,
        description: 'Data mapping saga',
        version: '1.0.0',
        correlationProperty: 'entityId',
        steps: [
          {
            name: 'step1',
            command: { ref: 'Step1' },
            output: {
              mapping: {
                'entityId': 'id',
                'entityName': 'name',
                'someValue': 'value'
              }
            }
          },
          {
            name: 'step2',
            command: { ref: 'Step2' },
            input: {
              mapping: {
                'id': 'entityId',
                'name': 'entityName',
                'processValue': 'someValue'
              }
            }
          }
        ]
      });
      
      // Execute saga
      await (dataMappingSaga as any).execute({ initialData: 'test' });
      
      // Verify step2 received mapped data from step1
      expect(step2Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'entity-1',
          name: 'Test',
          processValue: 42
        }),
        expect.any(Object)
      );
    });
  });

  describe('Compensation', () => {
    it('should trigger compensation when a step fails', async () => {
      // Setup mock implementations
      const step1Mock = vi.fn().mockResolvedValue({ id: 'entity-1' });
      const step2Mock = vi.fn().mockRejectedValue(new Error('Step 2 failed'));
      const compensate1Mock = vi.fn().mockResolvedValue({ compensated: true });
      
      // Define commands
      dsl.component('Step1', { 
        type: ComponentType.COMMAND, 
        description: 'Step 1', 
        version: '1.0.0',
        input: { ref: 'Step1Input' }, 
        output: { ref: 'Step1Output' } 
      });
      dsl.component('Step2', { 
        type: ComponentType.COMMAND, 
        description: 'Step 2', 
        version: '1.0.0',
        input: { ref: 'Step2Input' }, 
        output: { ref: 'Step2Output' } 
      });
      dsl.component('Compensate1', { 
        type: ComponentType.COMMAND, 
        description: 'Compensate Step 1', 
        version: '1.0.0',
        input: { ref: 'Comp1Input' }, 
        output: { ref: 'Comp1Output' } 
      });
      
      // Implement commands
      dsl.implement('Step1', step1Mock);
      dsl.implement('Step2', step2Mock);
      dsl.implement('Compensate1', compensate1Mock);
      
      // Define saga with compensation
      const compensatingSaga = dsl.component('CompensatingSaga', {
        type: ComponentType.SAGA,
        description: 'Compensating saga',
        version: '1.0.0',
        correlationProperty: 'entityId',
        steps: [
          {
            name: 'step1',
            command: { ref: 'Step1' },
            compensation: { ref: 'Compensate1' },
            output: {
              mapping: {
                'entityId': 'id'
              }
            }
          },
          {
            name: 'step2',
            command: { ref: 'Step2' },
            input: {
              mapping: {
                'id': 'entityId'
              }
            }
          }
        ]
      });
      
      // Execute saga that will fail
      const result = await (compensatingSaga as any).execute({ initialData: 'test' });
      
      // Verify compensation was triggered for successful steps
      expect(compensate1Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity-1'
        }),
        expect.any(Object)
      );
      
      // Verify saga result status
      expect(result.status).toBe('COMPENSATED');
      expect(result.error).toMatch(/Step 2 failed/);
    });
    
    it('should support different compensation strategies', async () => {
      // Setup test saga with a specified compensation strategy
      const backwardSaga = dsl.component('BackwardCompensationSaga', {
        type: ComponentType.SAGA,
        description: 'Saga with backward compensation',
        version: '1.0.0',
        compensationStrategy: CompensationStrategy.BACKWARD,
        steps: [/* steps would go here */]
      });
      
      const forwardSaga = dsl.component('ForwardCompensationSaga', {
        type: ComponentType.SAGA,
        description: 'Saga with forward compensation',
        version: '1.0.0',
        compensationStrategy: CompensationStrategy.FORWARD,
        steps: [/* steps would go here */]
      });
      
      // Verify the strategies were set correctly
      expect((backwardSaga as any).compensationStrategy).toBe(CompensationStrategy.BACKWARD);
      expect((forwardSaga as any).compensationStrategy).toBe(CompensationStrategy.FORWARD);
    });
  });

  describe('Saga Instance Tracking', () => {
    it('should track saga instances and allow querying them', async () => {
      // Setup mocks
      const commandMock = vi.fn().mockResolvedValue({ id: 'test-123' });
      
      // Define command and implementation
      dsl.component('TestCommand', { 
        type: ComponentType.COMMAND, 
        description: 'Test command', 
        version: '1.0.0',
        input: { ref: 'TestInput' }, 
        output: { ref: 'TestOutput' } 
      });
      dsl.implement('TestCommand', commandMock);
      
      // Define a simple saga
      const testSaga = dsl.component('TestSaga', {
        type: ComponentType.SAGA,
        description: 'Test saga',
        version: '1.0.0',
        correlationProperty: 'testId',
        steps: [
          {
            name: 'testStep',
            command: { ref: 'TestCommand' },
            output: {
              mapping: {
                'testId': 'id'
              }
            }
          }
        ]
      });
      
      // Execute multiple instances of the saga
      await (testSaga as any).execute({ input1: 'value1' });
      await (testSaga as any).execute({ input2: 'value2' });
      
      // Query for saga instances
      const instances = await (testSaga as any).getInstances();
      
      // Verify instances are tracked
      expect(instances.length).toBe(2);
      expect(instances[0].data.testId).toBe('test-123');
      expect(instances[1].data.testId).toBe('test-123');
      
      // Query for a specific instance by correlation ID
      const instance = await (testSaga as any).getInstance('test-123');
      expect(instance).toBeDefined();
      expect(instance.correlationId).toBe('test-123');
    });
  });

  describe('System Integration', () => {
    it('should integrate sagas with system definitions', () => {
      // Define necessary components
      dsl.component('CreateOrder', { 
        type: ComponentType.COMMAND, 
        description: 'Create order', 
        version: '1.0.0',
        input: { ref: 'OrderInput' }, 
        output: { ref: 'OrderOutput' } 
      });
      
      dsl.component('ProcessPayment', { 
        type: ComponentType.COMMAND, 
        description: 'Process payment', 
        version: '1.0.0',
        input: { ref: 'PaymentInput' }, 
        output: { ref: 'PaymentOutput' } 
      });
      
      // Define a saga
      dsl.component('OrderSaga', {
        type: ComponentType.SAGA,
        description: 'Order processing saga',
        version: '1.0.0',
        correlationProperty: 'orderId',
        steps: [
          {
            name: 'createOrder',
            command: { ref: 'CreateOrder' }
          },
          {
            name: 'processPayment',
            command: { ref: 'ProcessPayment' }
          }
        ]
      });
      
      // Define a system that uses the saga
      const orderSystem = dsl.system('OrderSystem', {
        description: 'Order management system',
        version: '1.0.0',
        components: {
          commands: [
            { ref: 'CreateOrder' },
            { ref: 'ProcessPayment' }
          ],
          sagas: [
            { ref: 'OrderSaga' }
          ]
        }
      });
      
      // Verify the system can access sagas
      expect(typeof (orderSystem as any).getSagas).toBe('function');
      
      // Get sagas from the system
      const sagas = (orderSystem as any).getSagas();
      expect(sagas.length).toBe(1);
      expect(sagas[0].id).toBe('OrderSaga');
    });
  });
}); 