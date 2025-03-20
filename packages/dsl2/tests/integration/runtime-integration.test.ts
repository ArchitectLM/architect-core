import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { RuntimeAdapter } from '../../src/runtime/adapter.js';
import { ComponentType } from '../../src/models/component.js';
import { ProcessDefinition, TaskDefinition, Runtime } from '@architectlm/core';

// Mock runtime object for testing
const mockRuntime = {
  createProcess: vi.fn().mockResolvedValue({ id: 'process-123', state: 'initial' }),
  getProcess: vi.fn(),
  transitionProcess: vi.fn(),
  executeTask: vi.fn().mockResolvedValue({ result: 'task-executed' }),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  publish: vi.fn()
};

// Mock the core2 runtime
vi.mock('@architectlm/core', async () => {
  return {
    createRuntime: vi.fn().mockReturnValue(mockRuntime)
  };
});

describe('Runtime Integration', () => {
  let dsl: DSL;
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    dsl = new DSL();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Converting DSL to Runtime Configuration', () => {
    it('should convert DSL system to process definitions', () => {
      // Define components
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { id: { type: 'string' } }
      });

      dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' }
      });

      dsl.implement('CreateUser', async (input: any, context: any) => {
        return { id: 'user-123', ...input };
      });

      // Define system
      const system = dsl.system('UserSystem', {
        description: 'User management system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'User' }],
          tasks: [{ ref: 'CreateUser' }]
        },
        processes: [
          {
            name: 'UserRegistrationProcess',
            description: 'User registration process',
            initialState: 'started',
            states: {
              started: {
                description: 'Registration started',
                transitions: [{ to: 'completed', on: 'USER_CREATED' }]
              },
              completed: {
                description: 'Registration completed',
                final: true
              }
            }
          }
        ]
      });

      // Create adapter
      adapter = new RuntimeAdapter(dsl);

      // Convert to runtime configuration
      const config = adapter.getRuntimeConfig('UserSystem');

      // Verify process definitions
      expect(config.processDefinitions).toBeDefined();
      const processKeys = Object.keys(config.processDefinitions);
      expect(processKeys).toContain('UserRegistrationProcess');
      
      const process = config.processDefinitions['UserRegistrationProcess'] as ProcessDefinition;
      expect(process.initialState).toBe('started');
      expect(process.transitions).toHaveLength(1);
      expect(process.transitions[0]).toEqual({ 
        from: 'started', 
        to: 'completed', 
        on: 'USER_CREATED' 
      });

      // Verify task definitions
      expect(config.taskDefinitions).toBeDefined();
      const taskKeys = Object.keys(config.taskDefinitions);
      expect(taskKeys).toContain('CreateUser');
      
      const task = config.taskDefinitions['CreateUser'] as TaskDefinition;
      expect(task.name).toBe('CreateUser');
      expect(typeof task.handler).toBe('function');
    });

    it('should throw an error for unknown system', () => {
      adapter = new RuntimeAdapter(dsl);
      expect(() => adapter.getRuntimeConfig('NonExistentSystem'))
        .toThrow(/system not found/i);
    });
  });

  describe('Runtime Creation and Operation', () => {
    it('should create a runtime from a system definition', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter
      adapter = new RuntimeAdapter(dsl);
      
      // Create runtime
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Verify runtime was created with the right configuration
      expect(runtime).toBeDefined();
      expect(runtime).toBe(mockRuntime);
    });

    it('should execute a task through the runtime', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter and runtime
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Execute a task
      const result = await adapter.executeTask(
        runtime, 
        'CreateUser', 
        { name: 'John Doe', email: 'john@example.com' }
      );
      
      expect(result).toBeDefined();
      expect(result).toEqual({ result: 'task-executed' });
      expect(runtime.executeTask).toHaveBeenCalledWith(
        'CreateUser', 
        { name: 'John Doe', email: 'john@example.com' }
      );
    });

    it('should start a process instance', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter and runtime
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Start a process
      const process = await adapter.startProcess(
        runtime, 
        'UserRegistrationProcess',
        { userId: 'user-123' }
      );
      
      expect(process).toBeDefined();
      expect(process.id).toBe('process-123');
      expect(process.state).toBe('initial');
      expect(runtime.createProcess).toHaveBeenCalledWith(
        'UserRegistrationProcess',
        { userId: 'user-123' }
      );
    });

    it('should publish events through the runtime', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter and runtime
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Publish an event
      await adapter.publishEvent(
        runtime,
        'UserCreatedEvent',
        { id: 'user-123', name: 'John Doe' }
      );
      
      expect(runtime.publish).toHaveBeenCalledWith(
        'UserCreatedEvent',
        { id: 'user-123', name: 'John Doe' }
      );
    });

    it('should execute a saga through the runtime', async () => {
      // Set up the test components and system with saga
      setupTestSystemWithSaga(dsl);
      
      // Create adapter and runtime
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('EcommerceSystem');
      
      // Mock the saga execution
      const mockSagaExecutor = vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        data: { orderId: 'order-123', paymentId: 'pmt-456' }
      });
      
      adapter.executeSaga = mockSagaExecutor;
      
      // Execute a saga
      const result = await adapter.executeSaga(
        runtime,
        'OrderSaga',
        { customerId: 'cust-123', items: [{ productId: 'prod-1', quantity: 2 }] }
      );
      
      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(result.data).toEqual(
        expect.objectContaining({ 
          orderId: 'order-123', 
          paymentId: 'pmt-456' 
        })
      );
    });
  });
});

// Helper to set up test components and system
function setupTestSystem(dsl: DSL) {
  // Define components
  dsl.component('User', {
    type: ComponentType.SCHEMA,
    description: 'User schema',
    version: '1.0.0',
    properties: { 
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' }
    }
  });

  dsl.component('CreateUser', {
    type: ComponentType.TASK,
    description: 'Create a user',
    version: '1.0.0',
    input: { ref: 'CreateUserInput' },
    output: { ref: 'User' }
  });

  dsl.component('UserCreatedEvent', {
    type: ComponentType.EVENT,
    description: 'Event emitted when a user is created',
    version: '1.0.0',
    payload: { ref: 'User' }
  });

  dsl.implement('CreateUser', async (input: any, context: any) => {
    return { id: 'user-123', ...input };
  });

  // Define system
  return dsl.system('UserSystem', {
    description: 'User management system',
    version: '1.0.0',
    components: {
      schemas: [{ ref: 'User' }],
      tasks: [{ ref: 'CreateUser' }],
      events: [{ ref: 'UserCreatedEvent' }]
    },
    processes: [
      {
        name: 'UserRegistrationProcess',
        description: 'User registration process',
        initialState: 'started',
        states: {
          started: {
            description: 'Registration started',
            transitions: [{ to: 'completed', on: 'USER_CREATED' }]
          },
          completed: {
            description: 'Registration completed',
            final: true
          }
        }
      }
    ]
  });
}

// Helper to set up test components with a saga
function setupTestSystemWithSaga(dsl: DSL) {
  // Define schemas
  dsl.component('Order', {
    type: ComponentType.SCHEMA,
    description: 'Order schema',
    version: '1.0.0',
    properties: {
      id: { type: 'string' },
      customerId: { type: 'string' },
      items: { type: 'array', items: { type: 'object' } },
      total: { type: 'number' }
    }
  });
  
  dsl.component('Payment', {
    type: ComponentType.SCHEMA,
    description: 'Payment schema',
    version: '1.0.0',
    properties: {
      id: { type: 'string' },
      orderId: { type: 'string' },
      amount: { type: 'number' },
      status: { type: 'string' }
    }
  });
  
  // Define tasks
  dsl.component('CreateOrder', {
    type: ComponentType.TASK,
    description: 'Create an order',
    version: '1.0.0',
    input: { ref: 'CreateOrderInput' },
    output: { ref: 'Order' }
  });
  
  dsl.component('ProcessPayment', {
    type: ComponentType.TASK,
    description: 'Process payment',
    version: '1.0.0',
    input: { ref: 'PaymentInput' },
    output: { ref: 'Payment' }
  });
  
  // Define events
  dsl.component('OrderCreatedEvent', {
    type: ComponentType.EVENT,
    description: 'Order created event',
    version: '1.0.0',
    payload: { ref: 'Order' }
  });
  
  dsl.component('PaymentProcessedEvent', {
    type: ComponentType.EVENT,
    description: 'Payment processed event',
    version: '1.0.0',
    payload: { ref: 'Payment' }
  });
  
  // Define saga
  dsl.component('OrderSaga', {
    type: ComponentType.SAGA,
    description: 'Order processing saga',
    version: '1.0.0',
    correlationProperty: 'orderId',
    steps: [
      {
        name: 'createOrder',
        task: { ref: 'CreateOrder' },
        output: {
          mapping: {
            'orderId': 'id',
            'total': 'total'
          }
        }
      },
      {
        name: 'processPayment',
        task: { ref: 'ProcessPayment' },
        input: {
          mapping: {
            'orderId': 'orderId',
            'amount': 'total'
          }
        },
        output: {
          mapping: {
            'paymentId': 'id'
          }
        }
      }
    ]
  });
  
  // Implement tasks
  dsl.implement('CreateOrder', async (input: any, context: any) => {
    return { 
      id: 'order-123', 
      customerId: input.customerId,
      items: input.items,
      total: input.items.reduce((sum: number, item: any) => sum + (item.price || 10) * item.quantity, 0)
    };
  });
  
  dsl.implement('ProcessPayment', async (input: any, context: any) => {
    return {
      id: 'pmt-456',
      orderId: input.orderId,
      amount: input.amount,
      status: 'completed'
    };
  });
  
  // Define system
  return dsl.system('EcommerceSystem', {
    description: 'E-commerce system',
    version: '1.0.0',
    components: {
      schemas: [
        { ref: 'Order' },
        { ref: 'Payment' }
      ],
      tasks: [
        { ref: 'CreateOrder' },
        { ref: 'ProcessPayment' }
      ],
      events: [
        { ref: 'OrderCreatedEvent' },
        { ref: 'PaymentProcessedEvent' }
      ],
      sagas: [
        { ref: 'OrderSaga' }
      ]
    },
    processes: [
      {
        name: 'OrderFulfillmentProcess',
        description: 'Order fulfillment process',
        initialState: 'created',
        states: {
          created: {
            description: 'Order created',
            transitions: [{ to: 'paid', on: 'PAYMENT_COMPLETED' }]
          },
          paid: {
            description: 'Order paid',
            transitions: [{ to: 'fulfilled', on: 'ORDER_SHIPPED' }]
          },
          fulfilled: {
            description: 'Order fulfilled',
            final: true
          }
        }
      }
    ]
  });
} 