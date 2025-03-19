import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the command extension module to test
vi.mock('../../src/extensions/command.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/command.extension.js');
  return {
    ...actual,
    setupCommandExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupCommandExtension, 
  CommandExtensionOptions
} from '../../src/extensions/command.extension.js';

describe('Command Extension', () => {
  let dsl: DSL;
  let commandOptions: CommandExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    commandOptions = {
      defaultTimeout: 5000,
      autoValidateInput: true,
      autoValidateOutput: true
    };
    
    // Setup extension
    setupCommandExtension(dsl, commandOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command Execution', () => {
    it('should add execute method to command components', async () => {
      // Define schemas for input and output
      dsl.component('OrderInput', {
        type: ComponentType.SCHEMA,
        description: 'Order input schema',
        version: '1.0.0',
        properties: {
          customerId: { type: 'string' },
          items: { 
            type: 'array', 
            items: { 
              type: 'object', 
              properties: { 
                productId: { type: 'string' }, 
                quantity: { type: 'number' } 
              } 
            } 
          }
        }
      });
      
      dsl.component('OrderOutput', {
        type: ComponentType.SCHEMA,
        description: 'Order output schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          total: { type: 'number' }
        }
      });
      
      // Define a command component
      const createOrderCommand = dsl.component('CreateOrder', {
        type: ComponentType.COMMAND,
        description: 'Create a new order',
        version: '1.0.0',
        input: { ref: 'OrderInput' },
        output: { ref: 'OrderOutput' }
      });
      
      // Create a mock implementation
      const createOrderMock = vi.fn().mockResolvedValue({
        id: 'order-123',
        status: 'created',
        total: 99.99
      });
      
      // Implement the command
      dsl.implement('CreateOrder', createOrderMock);
      
      // The extension should add an execute method to the command
      expect(typeof (createOrderCommand as any).execute).toBe('function');
      
      // Execute the command
      const input = {
        customerId: 'customer-123',
        items: [
          { productId: 'product-1', quantity: 2 }
        ]
      };
      
      const result = await (createOrderCommand as any).execute(input);
      
      // Verify the mock was called with the right input
      expect(createOrderMock).toHaveBeenCalledWith(input, expect.any(Object));
      
      // Verify the result
      expect(result).toEqual({
        id: 'order-123',
        status: 'created',
        total: 99.99
      });
    });
    
    it('should handle command execution timeouts', async () => {
      // Define a command with a slow implementation
      const slowCommand = dsl.component('SlowCommand', {
        type: ComponentType.COMMAND,
        description: 'A slow command that may timeout',
        version: '1.0.0',
        input: { ref: 'GenericInput' },
        output: { ref: 'GenericOutput' }
      });
      
      // Create a mock implementation that takes a long time
      const slowImplementation = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ result: 'done' });
          }, 1000); // Simulate a delay
        });
      });
      
      // Implement the command
      dsl.implement('SlowCommand', slowImplementation);
      
      // Set a very short timeout for testing
      const contextWithShortTimeout = {
        timeout: 50 // 50ms timeout
      };
      
      // Executing with a short timeout should fail
      await expect(
        (slowCommand as any).execute({}, contextWithShortTimeout)
      ).rejects.toThrow(/timeout/i);
      
      // Executing with a longer timeout or no specified timeout should succeed
      const contextWithLongTimeout = {
        timeout: 2000 // 2000ms timeout
      };
      
      await expect(
        (slowCommand as any).execute({}, contextWithLongTimeout)
      ).resolves.toEqual({ result: 'done' });
    });
  });

  describe('Input Validation', () => {
    it('should validate command input against schema when enabled', async () => {
      // Define input schema with validation
      dsl.component('UserInput', {
        type: ComponentType.SCHEMA,
        description: 'User input schema',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 18 }
        },
        required: ['name', 'email']
      });
      
      dsl.component('UserOutput', {
        type: ComponentType.SCHEMA,
        description: 'User output schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      });
      
      // Define a command with a schema
      const createUserCommand = dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create a user',
        version: '1.0.0',
        input: { ref: 'UserInput' },
        output: { ref: 'UserOutput' }
      });
      
      // Mock implementation
      const createUserMock = vi.fn().mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      });
      
      dsl.implement('CreateUser', createUserMock);
      
      // Extension should add automatic validation based on setup options
      // Valid input should pass validation
      const validInput = {
        name: 'Test User',
        email: 'test@example.com',
        age: 25
      };
      
      await expect(
        (createUserCommand as any).execute(validInput)
      ).resolves.toBeDefined();
      
      // Invalid input should fail validation
      const invalidInput = {
        name: 'Test User', 
        // Missing required email field
        age: 15 // Below minimum age
      };
      
      await expect(
        (createUserCommand as any).execute(invalidInput)
      ).rejects.toThrow(/invalid input/i);
      
      // Should be able to disable validation
      const contextWithDisabledValidation = {
        validateInput: false
      };
      
      await expect(
        (createUserCommand as any).execute(invalidInput, contextWithDisabledValidation)
      ).resolves.toBeDefined();
    });
  });

  describe('Output Validation', () => {
    it('should validate command output against schema when enabled', async () => {
      // Define output schema with validation
      dsl.component('ProductOutput', {
        type: ComponentType.SCHEMA,
        description: 'Product output schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 }
        },
        required: ['id', 'name', 'price']
      });
      
      // Define a command with an output schema
      const getProductCommand = dsl.component('GetProduct', {
        type: ComponentType.COMMAND,
        description: 'Get a product',
        version: '1.0.0',
        input: { ref: 'ProductInput' },
        output: { ref: 'ProductOutput' }
      });
      
      // Mock implementation that returns valid output
      const validImplementation = vi.fn().mockResolvedValue({
        id: 'product-123',
        name: 'Test Product',
        price: 29.99
      });
      
      // Mock implementation that returns invalid output
      const invalidImplementation = vi.fn().mockResolvedValue({
        id: 'product-123',
        name: 'Test Product'
        // Missing required price field
      });
      
      // Test with valid implementation
      dsl.implement('GetProduct', validImplementation);
      
      await expect(
        (getProductCommand as any).execute({ id: 'product-123' })
      ).resolves.toBeDefined();
      
      // Test with invalid implementation
      dsl.implement('GetProduct', invalidImplementation);
      
      await expect(
        (getProductCommand as any).execute({ id: 'product-123' })
      ).rejects.toThrow(/invalid output/i);
      
      // Should be able to disable output validation
      const contextWithDisabledValidation = {
        validateOutput: false
      };
      
      await expect(
        (getProductCommand as any).execute(
          { id: 'product-123' },
          contextWithDisabledValidation
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Command Extension Points', () => {
    it('should support extension points for commands', async () => {
      // Define a command with extension points
      const extensibleCommand = dsl.component('ExtensibleCommand', {
        type: ComponentType.COMMAND,
        description: 'A command with extension points',
        version: '1.0.0',
        input: { ref: 'GenericInput' },
        output: { ref: 'GenericOutput' },
        extensionPoints: {
          'beforeExecution': {
            description: 'Called before the command executes',
            parameters: ['input', 'context']
          },
          'afterExecution': {
            description: 'Called after the command executes',
            parameters: ['result', 'context']
          },
          'onError': {
            description: 'Called when an error occurs',
            parameters: ['error', 'context']
          }
        }
      });
      
      // Create mock handlers for extension points
      const beforeExecutionMock = vi.fn((input, context) => {
        // Modify input or context
        return { input: { ...input, modified: true }, context };
      });
      
      const afterExecutionMock = vi.fn((result, context) => {
        // Modify result
        return { ...result, enhanced: true };
      });
      
      const onErrorMock = vi.fn((error, context) => {
        // Handle error or transform it
        return { handled: true, originalError: error };
      });
      
      // Register extension point handlers
      (extensibleCommand as any).registerExtensionPoint('beforeExecution', beforeExecutionMock);
      (extensibleCommand as any).registerExtensionPoint('afterExecution', afterExecutionMock);
      (extensibleCommand as any).registerExtensionPoint('onError', onErrorMock);
      
      // Mock command implementation
      const commandImpl = vi.fn().mockResolvedValue({ result: 'success' });
      dsl.implement('ExtensibleCommand', commandImpl);
      
      // Execute the command and verify extension points were called
      const input = { value: 'test' };
      await (extensibleCommand as any).execute(input);
      
      // Verify before execution was called
      expect(beforeExecutionMock).toHaveBeenCalledWith(
        input,
        expect.any(Object)
      );
      
      // Verify input was modified
      expect(commandImpl).toHaveBeenCalledWith(
        expect.objectContaining({ modified: true }),
        expect.any(Object)
      );
      
      // Verify after execution was called
      expect(afterExecutionMock).toHaveBeenCalledWith(
        { result: 'success' },
        expect.any(Object)
      );
      
      // Test error handling
      const errorImpl = vi.fn().mockRejectedValue(new Error('Command failed'));
      dsl.implement('ExtensibleCommand', errorImpl);
      
      // Execute with error and verify onError was called
      try {
        await (extensibleCommand as any).execute(input);
      } catch (error) {
        expect(onErrorMock).toHaveBeenCalledWith(
          expect.any(Error),
          expect.any(Object)
        );
        expect(error).toHaveProperty('handled', true);
      }
    });
  });

  describe('Command Metadata', () => {
    it('should track command execution metrics', async () => {
      // Define a command
      const metricCommand = dsl.component('MetricCommand', {
        type: ComponentType.COMMAND,
        description: 'A command with metrics',
        version: '1.0.0',
        input: { ref: 'GenericInput' },
        output: { ref: 'GenericOutput' }
      });
      
      // Mock implementation
      const implementation = vi.fn().mockImplementation(async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50));
        return { result: 'success' };
      });
      
      dsl.implement('MetricCommand', implementation);
      
      // Execute the command
      await (metricCommand as any).execute({ test: true });
      
      // Get metrics
      const metrics = (metricCommand as any).getMetrics();
      
      // Verify metrics are tracked
      expect(metrics).toBeDefined();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.lastExecutionTime).toBeGreaterThan(0);
      
      // Execute again and verify metrics are updated
      await (metricCommand as any).execute({ test: true });
      
      const updatedMetrics = (metricCommand as any).getMetrics();
      expect(updatedMetrics.executionCount).toBe(2);
    });
  });

  describe('System Integration', () => {
    it('should integrate commands with system definitions', () => {
      // Define some commands
      dsl.component('Command1', {
        type: ComponentType.COMMAND,
        description: 'Command 1',
        version: '1.0.0',
        input: { ref: 'Input1' },
        output: { ref: 'Output1' }
      });
      
      dsl.component('Command2', {
        type: ComponentType.COMMAND,
        description: 'Command 2',
        version: '1.0.0',
        input: { ref: 'Input2' },
        output: { ref: 'Output2' }
      });
      
      // Define a system that uses these commands
      const system = dsl.system('TestSystem', {
        description: 'Test system',
        version: '1.0.0',
        components: {
          commands: [
            { ref: 'Command1' },
            { ref: 'Command2' }
          ]
        }
      });
      
      // Extension should add methods to access and execute commands
      expect(typeof (system as any).getCommands).toBe('function');
      expect(typeof (system as any).executeCommand).toBe('function');
      
      // Get commands from the system
      const commands = (system as any).getCommands();
      expect(commands).toHaveLength(2);
      expect(commands[0].id).toBe('Command1');
      expect(commands[1].id).toBe('Command2');
    });
  });
}); 