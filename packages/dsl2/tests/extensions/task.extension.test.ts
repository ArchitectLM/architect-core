import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the task extension module
vi.mock('../../src/extensions/task.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/task.extension.js');
  return {
    ...actual,
    setupTaskExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupTaskExtension, 
  TaskExtensionOptions
} from '../../src/extensions/task.extension.js';

describe('Task Extension', () => {
  let dsl: DSL;
  let taskOptions: TaskExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    taskOptions = {
      validation: true,
      logging: true
    };
    
    // Setup extension
    setupTaskExtension(dsl, taskOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Definition', () => {
    it('should allow defining task components', () => {
      // Define a schema first
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name', 'email']
      });

      // Define input schema
      const createUserInput = dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Input for creating a user',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] }
        },
        required: ['name', 'email']
      });

      // Define a task component
      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a new user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' },
        produces: [{ 
          event: 'UserCreated', 
          description: 'Event emitted when a user is created' 
        }],
        isReadOnly: false
      });

      expect(createUserTask.id).toBe('CreateUser');
      expect(createUserTask.type).toBe(ComponentType.TASK);
      expect((createUserTask as any).input).toEqual({ ref: 'CreateUserInput' });
      expect((createUserTask as any).output).toEqual({ ref: 'User' });
      expect((createUserTask as any).produces).toHaveLength(1);
      expect((createUserTask as any).produces[0].event).toBe('UserCreated');
      expect((createUserTask as any).isReadOnly).toBe(false);
    });

    it('should allow defining read-only tasks (queries)', () => {
      // Define a schema first
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });

      // Define input for the query
      const getUserInput = dsl.component('GetUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Input for retrieving a user',
        version: '1.0.0',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      });

      // Define a read-only task (query)
      const getUserTask = dsl.component('GetUser', {
        type: ComponentType.TASK,
        description: 'Get a user by ID',
        version: '1.0.0',
        input: { ref: 'GetUserInput' },
        output: { ref: 'User' },
        isReadOnly: true
      });

      expect(getUserTask.id).toBe('GetUser');
      expect(getUserTask.type).toBe(ComponentType.TASK);
      expect((getUserTask as any).isReadOnly).toBe(true);
    });
  });

  describe('Task Implementation', () => {
    it('should implement a task with business logic', async () => {
      // Define necessary schemas
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

      dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Input for creating a user',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['name', 'email']
      });

      // Define task
      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a new user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' }
      });

      // Implement the task
      const createUserImpl = vi.fn().mockImplementation((input, context) => {
        return {
          id: `user-${Date.now()}`,
          name: input.name,
          email: input.email
        };
      });

      dsl.implement('CreateUser', createUserImpl);

      // Execute the task
      const input = { name: 'John Doe', email: 'john@example.com' };
      const result = await (createUserTask as any).execute(input, {});

      // Verify the implementation was called
      expect(createUserImpl).toHaveBeenCalledWith(input, expect.any(Object));
      
      // Verify the result format
      expect(result).toMatchObject({
        id: expect.stringContaining('user-'),
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should validate input against schema', async () => {
      // Define schemas
      dsl.component('CreateUserInput', {
        type: ComponentType.SCHEMA,
        description: 'Input for creating a user',
        version: '1.0.0',
        properties: {
          name: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' }
        },
        required: ['name', 'email']
      });

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

      // Define and implement task
      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' }
      });

      const createUserImpl = vi.fn().mockImplementation((input, context) => {
        return {
          id: `user-${Date.now()}`,
          name: input.name,
          email: input.email
        };
      });

      dsl.implement('CreateUser', createUserImpl);

      // Mock validation functions
      (createUserTask as any).validateInput = vi.fn().mockImplementation((input) => {
        if (!input.name || input.name.length < 3) {
          return { valid: false, errors: ['Name must be at least 3 characters long'] };
        }
        if (!input.email || !input.email.includes('@')) {
          return { valid: false, errors: ['Invalid email format'] };
        }
        return { valid: true };
      });

      // Execute with valid input
      const validInput = { name: 'John Doe', email: 'john@example.com' };
      await (createUserTask as any).execute(validInput, {});
      expect(createUserImpl).toHaveBeenCalledWith(validInput, expect.any(Object));

      // Execute with invalid input
      const invalidInput = { name: 'Jo', email: 'invalid-email' };
      await expect((createUserTask as any).execute(invalidInput, {}))
        .rejects.toThrow(/validation/i);
      
      // Implementation should not be called for invalid input
      expect(createUserImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task Execution Context', () => {
    it('should provide execution context to task implementations', async () => {
      // Define task
      const testTask = dsl.component('TestTask', {
        type: ComponentType.TASK,
        description: 'Test task with context',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' }
      });

      // Implement with context awareness
      const taskImplementation = vi.fn().mockImplementation((input, context) => {
        return {
          input,
          receivedContext: {
            tenant: context.tenant,
            user: context.user,
            requestId: context.requestId
          }
        };
      });

      dsl.implement('TestTask', taskImplementation);

      // Execute with context
      const context = {
        tenant: { id: 'tenant-123', name: 'Acme Inc' },
        user: { id: 'user-456', role: 'admin' },
        requestId: 'req-789'
      };

      const result = await (testTask as any).execute({ data: 'test' }, context);

      // Verify context was passed and used
      expect(taskImplementation).toHaveBeenCalledWith({ data: 'test' }, context);
      expect(result.receivedContext).toEqual({
        tenant: { id: 'tenant-123', name: 'Acme Inc' },
        user: { id: 'user-456', role: 'admin' },
        requestId: 'req-789'
      });
    });
  });

  describe('Task Event Integration', () => {
    it('should emit events defined in the task', async () => {
      // Setup event bus
      const eventBus = {
        emit: vi.fn(),
        on: vi.fn()
      };
      (dsl as any).events = eventBus;

      // Define task that produces events
      const orderTask = dsl.component('CreateOrder', {
        type: ComponentType.TASK,
        description: 'Create a new order',
        version: '1.0.0',
        input: { ref: 'CreateOrderInput' },
        output: { ref: 'Order' },
        produces: [
          { event: 'OrderCreated', description: 'Order was created' },
          { event: 'InventoryUpdated', description: 'Inventory was updated after order' }
        ]
      });

      // Implement task
      const createOrderImpl = vi.fn().mockImplementation((input, context) => {
        const order = {
          id: `order-${Date.now()}`,
          items: input.items,
          total: input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        };
        
        // Return events to be emitted alongside the result
        context.events = [
          { 
            type: 'OrderCreated', 
            payload: order 
          },
          { 
            type: 'InventoryUpdated', 
            payload: { 
              items: input.items.map(item => ({ 
                productId: item.productId, 
                quantity: -item.quantity 
              }))
            } 
          }
        ];
        
        return order;
      });

      dsl.implement('CreateOrder', createOrderImpl);

      // Execute task
      const input = {
        items: [
          { productId: 'prod-1', quantity: 2, price: 10 },
          { productId: 'prod-2', quantity: 1, price: 20 }
        ]
      };

      const result = await (orderTask as any).execute(input, {});

      // Verify result
      expect(result).toMatchObject({
        id: expect.stringContaining('order-'),
        items: input.items,
        total: 40
      });

      // Verify events were emitted
      expect(eventBus.emit).toHaveBeenCalledTimes(2);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'event:OrderCreated',
        expect.objectContaining({
          type: 'OrderCreated',
          payload: result
        })
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'event:InventoryUpdated',
        expect.objectContaining({
          type: 'InventoryUpdated',
          payload: expect.objectContaining({
            items: expect.arrayContaining([
              { productId: 'prod-1', quantity: -2 },
              { productId: 'prod-2', quantity: -1 }
            ])
          })
        })
      );
    });
  });

  describe('Task Validation', () => {
    it('should validate output against schema', async () => {
      // Define schemas
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] }
        },
        required: ['id', 'name', 'email', 'role']
      });

      // Define task
      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create a user',
        version: '1.0.0',
        input: { type: 'object' },
        output: { ref: 'User' }
      });

      // Mock validation functions
      (createUserTask as any).validateOutput = vi.fn().mockImplementation((output) => {
        if (!output.role) {
          return { valid: false, errors: ['Role is required'] };
        }
        return { valid: true };
      });

      // Valid implementation
      const validImpl = vi.fn().mockImplementation(() => {
        return {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'user'
        };
      });

      // Invalid implementation
      const invalidImpl = vi.fn().mockImplementation(() => {
        return {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com'
          // Missing role
        };
      });

      // Test valid case
      dsl.implement('CreateUser', validImpl);
      await (createUserTask as any).execute({}, {});
      expect(validImpl).toHaveBeenCalled();
      expect((createUserTask as any).validateOutput).toHaveBeenCalled();

      // Test invalid case
      dsl.implement('CreateUser', invalidImpl);
      await expect((createUserTask as any).execute({}, {}))
        .rejects.toThrow(/validation/i);
    });
  });

  describe('Task Chaining', () => {
    it('should support task chaining through pipeline execution', async () => {
      // Define tasks
      const validateUserTask = dsl.component('ValidateUser', {
        type: ComponentType.TASK,
        description: 'Validate user data',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'ValidatedUserData' },
        isReadOnly: true
      });

      const createUserTask = dsl.component('CreateUser', {
        type: ComponentType.TASK,
        description: 'Create user',
        version: '1.0.0',
        input: { ref: 'ValidatedUserData' },
        output: { ref: 'User' }
      });

      const notifyUserTask = dsl.component('NotifyUser', {
        type: ComponentType.TASK,
        description: 'Send notification to user',
        version: '1.0.0',
        input: { ref: 'User' },
        output: { ref: 'NotificationResult' }
      });

      // Implement tasks
      const validateUserImpl = vi.fn().mockImplementation((input) => {
        return { 
          ...input, 
          validated: true, 
          validatedAt: new Date().toISOString() 
        };
      });

      const createUserImpl = vi.fn().mockImplementation((input) => {
        return { 
          id: `user-${Date.now()}`,
          name: input.name,
          email: input.email,
          validated: input.validated,
          validatedAt: input.validatedAt
        };
      });

      const notifyUserImpl = vi.fn().mockImplementation((user) => {
        return { 
          success: true, 
          sentTo: user.email,
          message: `Welcome, ${user.name}!`
        };
      });

      dsl.implement('ValidateUser', validateUserImpl);
      dsl.implement('CreateUser', createUserImpl);
      dsl.implement('NotifyUser', notifyUserImpl);

      // Create a pipeline (using the pipeline feature that should be provided by the extension)
      const userOnboardingPipeline = (dsl as any).createTaskPipeline([
        { task: 'ValidateUser' },
        { task: 'CreateUser' },
        { task: 'NotifyUser' }
      ]);

      // Execute the pipeline
      const input = { name: 'John Doe', email: 'john@example.com' };
      const result = await userOnboardingPipeline.execute(input, {});

      // Verify task execution order and data flow
      expect(validateUserImpl).toHaveBeenCalledWith(input, expect.any(Object));
      
      expect(createUserImpl).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          validated: true,
          validatedAt: expect.any(String)
        }),
        expect.any(Object)
      );
      
      expect(notifyUserImpl).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining('user-'),
          name: 'John Doe',
          email: 'john@example.com'
        }),
        expect.any(Object)
      );
      
      // Verify final result
      expect(result).toMatchObject({
        success: true,
        sentTo: 'john@example.com',
        message: 'Welcome, John Doe!'
      });
    });
  });
}); 