import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Process, Task, System, Test } from './index';

describe('Fluent API Builders', () => {
  describe('ProcessBuilder', () => {
    it('should create a valid process definition', () => {
      // Arrange & Act
      const process = Process.create('order-process')
        .withDescription('Order processing workflow')
        .withInitialState('created')
        .addState('created', { description: 'Order has been created' })
        .addState('processing', { description: 'Order is being processed' })
        .addState('completed', { description: 'Order has been completed' })
        .addState('cancelled', { description: 'Order has been cancelled' })
        .addTransition({
          from: 'created',
          to: 'processing',
          on: 'START_PROCESSING',
          description: 'Start processing the order'
        })
        .addTransition({
          from: 'processing',
          to: 'completed',
          on: 'COMPLETE',
          description: 'Complete the order'
        })
        .addTransition({
          from: 'processing',
          to: 'cancelled',
          on: 'CANCEL',
          description: 'Cancel the order'
        })
        .addSimpleTransition('created', 'cancelled', 'CANCEL')
        .withMetadata({
          version: '1.0.0',
          owner: 'order-team'
        })
        .build();

      // Assert
      expect(process.id).toBe('order-process');
      expect(process.description).toBe('Order processing workflow');
      expect(process.initialState).toBe('created');
      expect(process.states).toHaveLength(4);
      expect(process.transitions).toHaveLength(4);
      expect(process.metadata).toEqual({
        version: '1.0.0',
        owner: 'order-team'
      });
    });

    it('should validate process definition', () => {
      // Arrange & Act & Assert
      expect(() => {
        Process.create('invalid-process')
          .build();
      }).toThrow('Process must have at least one state');

      expect(() => {
        Process.create('invalid-process')
          .addState('created')
          .build();
      }).toThrow('Process must have at least one transition');

      expect(() => {
        Process.create('invalid-process')
          .addState('created')
          .addTransition({
            from: 'created',
            to: 'processing', // 'processing' state doesn't exist
            on: 'START_PROCESSING'
          })
          .build();
      }).toThrow('Transition references undefined state: processing');
    });

    it('should support context schema validation', () => {
      // Arrange
      const orderSchema = z.object({
        orderId: z.string(),
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().positive()
        }))
      });

      // Act
      const process = Process.create('order-process')
        .withDescription('Order processing workflow')
        .addState('created')
        .addState('completed')
        .addSimpleTransition('created', 'completed', 'COMPLETE')
        .withContextSchema(orderSchema)
        .build();

      // Assert
      expect(process.contextSchema).toBe(orderSchema);
    });
  });

  describe('TaskBuilder', () => {
    it('should create a valid task definition', () => {
      // Arrange
      const taskImplementation = vi.fn().mockImplementation(async (input, context) => {
        return { processed: true, orderId: input.orderId };
      });

      // Act
      const task = Task.create('process-order')
        .withDescription('Process an order')
        .withImplementation(taskImplementation)
        .withTimeout(5000)
        .withRetry({
          maxAttempts: 3,
          backoff: 'exponential',
          delayMs: 1000
        })
        .withMetadata({
          version: '1.0.0',
          owner: 'order-team'
        })
        .build();

      // Assert
      expect(task.id).toBe('process-order');
      expect(task.description).toBe('Process an order');
      expect(task.implementation).toBe(taskImplementation);
      expect(task.timeout).toBe(5000);
      expect(task.retry).toEqual({
        maxAttempts: 3,
        backoff: 'exponential',
        delayMs: 1000
      });
      expect(task.metadata).toEqual({
        version: '1.0.0',
        owner: 'order-team'
      });
    });

    it('should validate task definition', () => {
      // Arrange & Act & Assert
      expect(() => {
        Task.create('invalid-task')
          .build();
      }).toThrow('Task implementation is required');
    });

    it('should support input and output schema validation', () => {
      // Arrange
      const inputSchema = z.object({
        orderId: z.string(),
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().positive()
        }))
      });

      const outputSchema = z.object({
        processed: z.boolean(),
        orderId: z.string()
      });

      // Act
      const task = Task.create('process-order')
        .withImplementation(async (input, context) => {
          return { processed: true, orderId: input.orderId };
        })
        .withInputSchema(inputSchema)
        .withOutputSchema(outputSchema)
        .build();

      // Assert
      expect(task.inputSchema).toBe(inputSchema);
      expect(task.outputSchema).toBe(outputSchema);
    });
  });

  describe('SystemBuilder', () => {
    it('should create a valid system configuration', () => {
      // Arrange
      const orderProcess = Process.create('order-process')
        .addState('created')
        .addState('completed')
        .addSimpleTransition('created', 'completed', 'COMPLETE')
        .build();

      const processOrderTask = Task.create('process-order')
        .withImplementation(async (input, context) => {
          return { processed: true };
        })
        .build();

      // Act
      const system = System.create('ecommerce')
        .withName('E-Commerce System')
        .withDescription('E-commerce system for order processing')
        .addProcess(orderProcess)
        .addTask(processOrderTask)
        .withMetadata({
          version: '1.0.0',
          owner: 'platform-team'
        })
        .build();

      // Assert
      expect(system.id).toBe('ecommerce');
      expect(system.name).toBe('E-Commerce System');
      expect(system.description).toBe('E-commerce system for order processing');
      expect(system.processes).toHaveProperty('order-process');
      expect(system.tasks).toHaveProperty('process-order');
      expect(system.metadata).toEqual({
        version: '1.0.0',
        owner: 'platform-team'
      });
    });

    it('should validate system configuration', () => {
      // Arrange & Act & Assert
      expect(() => {
        System.create('')
          .build();
      }).toThrow('System ID is required');
    });
  });

  describe('TestBuilder', () => {
    it('should create a valid test definition', () => {
      // Arrange & Act
      const test = Test.create('order-flow-test')
        .withDescription('Test the order flow')
        .createProcess('order-process', { orderId: '12345' })
        .transitionProcess('START_PROCESSING', { userId: 'user-1' })
        .executeTask('process-order', { orderId: '12345' })
        .verifyState('completed')
        .expectFinalState('completed')
        .expectEvents(['ORDER_PROCESSED'])
        .build();

      // Assert
      expect(test.name).toBe('order-flow-test');
      expect(test.description).toBe('Test the order flow');
      expect(test.steps).toHaveLength(4);
      expect(test.expected?.finalState).toBe('completed');
      expect(test.expected?.events).toEqual(['ORDER_PROCESSED']);
    });

    it('should validate test definition', () => {
      // Arrange & Act & Assert
      expect(() => {
        Test.create('')
          .build();
      }).toThrow('Test name is required');

      expect(() => {
        Test.create('invalid-test')
          .build();
      }).toThrow('Test must have at least one step');
    });
  });
}); 