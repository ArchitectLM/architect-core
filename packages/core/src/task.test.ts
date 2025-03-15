import { describe, it, expect, vi } from 'vitest';
import { defineTask } from './task';
import { TaskDefinition, TaskContext } from './types';

describe('defineTask', () => {
  it('should create a valid task definition', () => {
    // Arrange
    const taskImplementation = async (input: any, context: TaskContext) => {
      return { result: input.value * 2 };
    };
    
    const taskConfig: TaskDefinition = {
      id: 'test-task',
      input: ['value'],
      output: ['result'],
      implementation: taskImplementation,
      description: 'A test task that doubles the input value'
    };
    
    // Act
    const task = defineTask(taskConfig);
    
    // Assert
    expect(task).toEqual({
      id: 'test-task',
      input: ['value'],
      output: ['result'],
      implementation: taskImplementation,
      description: 'A test task that doubles the input value'
    });
  });

  it('should throw an error if id is missing', () => {
    // Arrange
    const taskConfig = {
      implementation: async () => ({})
    } as unknown as TaskDefinition;
    
    // Act & Assert
    expect(() => defineTask(taskConfig)).toThrow('Task ID is required');
  });

  it('should throw an error if implementation is missing', () => {
    // Arrange
    const taskConfig = {
      id: 'test-task'
    } as unknown as TaskDefinition;
    
    // Act & Assert
    expect(() => defineTask(taskConfig)).toThrow('Task implementation is required');
  });

  it('should accept a task with minimal configuration', () => {
    // Arrange
    const taskImplementation = async () => ({});
    const taskConfig: TaskDefinition = {
      id: 'minimal-task',
      implementation: taskImplementation
    };
    
    // Act
    const task = defineTask(taskConfig);
    
    // Assert
    expect(task).toEqual({
      id: 'minimal-task',
      implementation: taskImplementation
    });
  });

  // New tests for task execution context and error handling
  it('should execute task with provided context', async () => {
    // Arrange
    const mockContext: TaskContext = {
      processId: 'test-process',
      instanceId: 'test-instance',
      getService: vi.fn().mockReturnValue({ getData: vi.fn() }),
      emitEvent: vi.fn(),
      executeTask: vi.fn().mockResolvedValue({ result: 'subtask-result' }),
      getContext: vi.fn().mockReturnValue({ state: 'processing' }),
      updateContext: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      // Safely check if getService exists before calling it
      const service = context.getService ? context.getService('database') : null;
      const subtaskResult = await context.executeTask('subtask', { data: 'test' });
      context.emitEvent('TASK_PROGRESS', { progress: 50 });
      return { 
        result: 'success',
        processId: context.processId,
        instanceId: context.instanceId,
        subtaskResult
      };
    };
    
    const task = defineTask({
      id: 'context-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({ data: 'input' }, mockContext);
    
    // Assert
    expect(result.processId).toBe('test-process');
    expect(result.instanceId).toBe('test-instance');
    expect(result.subtaskResult).toEqual({ result: 'subtask-result' });
    expect(mockContext.getService).toHaveBeenCalledWith('database');
    expect(mockContext.executeTask).toHaveBeenCalledWith('subtask', { data: 'test' });
    expect(mockContext.emitEvent).toHaveBeenCalledWith('TASK_PROGRESS', { progress: 50 });
  });

  it('should handle errors during task execution', async () => {
    // Arrange
    const mockContext: TaskContext = {
      processId: 'test-process',
      instanceId: 'test-instance',
      getService: vi.fn(),
      emitEvent: vi.fn(),
      executeTask: vi.fn().mockRejectedValue(new Error('Subtask failed')),
      getContext: vi.fn(),
      updateContext: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      try {
        await context.executeTask('failing-subtask', { data: 'test' });
        return { success: true };
      } catch (error) {
        context.emitEvent('TASK_ERROR', { error: (error as Error).message });
        return { success: false, error: (error as Error).message };
      }
    };
    
    const task = defineTask({
      id: 'error-handling-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({ data: 'input' }, mockContext);
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Subtask failed');
    expect(mockContext.executeTask).toHaveBeenCalledWith('failing-subtask', { data: 'test' });
    expect(mockContext.emitEvent).toHaveBeenCalledWith('TASK_ERROR', { error: 'Subtask failed' });
  });

  it('should validate task input parameters', async () => {
    // Arrange
    const mockContext: TaskContext = {
      getService: vi.fn(),
      emitEvent: vi.fn(),
      executeTask: vi.fn(),
      getContext: vi.fn(),
      updateContext: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      if (!input.orderId) throw new Error('Order ID is required');
      if (!input.userId) throw new Error('User ID is required');
      return { success: true, orderId: input.orderId, userId: input.userId };
    };
    
    const task = defineTask({
      id: 'validated-task',
      input: ['orderId', 'userId'],
      implementation: taskImplementation
    });
    
    // Act & Assert
    await expect(task.implementation({}, mockContext))
      .rejects.toThrow('Order ID is required');
      
    await expect(task.implementation({ orderId: '12345' }, mockContext))
      .rejects.toThrow('User ID is required');
      
    const result = await task.implementation({ orderId: '12345', userId: 'user1' }, mockContext);
    expect(result.success).toBe(true);
    expect(result.orderId).toBe('12345');
    expect(result.userId).toBe('user1');
  });

  it('should support task with output schema validation', async () => {
    // Arrange
    const mockContext: TaskContext = {
      getService: vi.fn(),
      emitEvent: vi.fn(),
      executeTask: vi.fn(),
      getContext: vi.fn(),
      updateContext: vi.fn()
    };
    
    const validateOutput = (output: any) => {
      if (!output.result) throw new Error('Result is required in output');
      if (typeof output.result !== 'number') throw new Error('Result must be a number');
      return true;
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      const result = { result: input.value * 2 };
      // Simulate output validation
      validateOutput(result);
      return result;
    };
    
    const task = defineTask({
      id: 'output-validated-task',
      input: ['value'],
      output: ['result'],
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({ value: 5 }, mockContext);
    
    // Assert
    expect(result.result).toBe(10);
  });

  // Additional edge case tests

  it('should handle task with empty input', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      return { received: input, isEmpty: Object.keys(input).length === 0 };
    };
    
    const task = defineTask({
      id: 'empty-input-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({}, mockContext);
    
    // Assert
    expect(result.isEmpty).toBe(true);
    expect(Object.keys(result.received).length).toBe(0);
  });

  it('should handle task with null or undefined input', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      return { 
        inputType: typeof input,
        isNull: input === null,
        isUndefined: input === undefined
      };
    };
    
    const task = defineTask({
      id: 'null-input-task',
      implementation: taskImplementation
    });
    
    // Act
    const resultWithNull = await task.implementation(null, mockContext);
    const resultWithUndefined = await task.implementation(undefined, mockContext);
    
    // Assert
    expect(resultWithNull.isNull).toBe(true);
    expect(resultWithNull.inputType).toBe('object');
    
    expect(resultWithUndefined.isUndefined).toBe(true);
    expect(resultWithUndefined.inputType).toBe('undefined');
  });

  it('should handle task with missing context methods', async () => {
    // Arrange
    // Create a minimal context with only required methods
    const minimalContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      // Check for optional methods
      const hasGetService = typeof context.getService === 'function';
      const hasGetProcess = typeof context.getProcess === 'function';
      const hasGetContext = typeof context.getContext === 'function';
      const hasUpdateContext = typeof context.updateContext === 'function';
      
      return { 
        hasGetService,
        hasGetProcess,
        hasGetContext,
        hasUpdateContext,
        // Required methods should always be present
        hasEmitEvent: typeof context.emitEvent === 'function',
        hasExecuteTask: typeof context.executeTask === 'function'
      };
    };
    
    const task = defineTask({
      id: 'minimal-context-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({ test: true }, minimalContext);
    
    // Assert
    expect(result.hasEmitEvent).toBe(true);
    expect(result.hasExecuteTask).toBe(true);
    expect(result.hasGetService).toBe(false);
    expect(result.hasGetProcess).toBe(false);
    expect(result.hasGetContext).toBe(false);
    expect(result.hasUpdateContext).toBe(false);
  });

  it('should handle task with very large input', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    // Create a large input object
    const largeInput = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        description: `This is a description for item ${i}`,
        properties: {
          color: i % 3 === 0 ? 'red' : i % 3 === 1 ? 'green' : 'blue',
          size: i % 5,
          tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`)
        }
      }))
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      return { 
        itemCount: input.items.length,
        firstItem: input.items[0],
        lastItem: input.items[input.items.length - 1]
      };
    };
    
    const task = defineTask({
      id: 'large-input-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation(largeInput, mockContext);
    
    // Assert
    expect(result.itemCount).toBe(1000);
    expect(result.firstItem.id).toBe('item-0');
    expect(result.lastItem.id).toBe('item-999');
  });

  it('should handle task with circular references in input', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    // Create an object with circular reference
    const circularInput: any = {
      name: 'circular-object',
      value: 42
    };
    circularInput.self = circularInput;
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      // Just access properties without traversing the circular reference
      return { 
        name: input.name,
        value: input.value,
        hasSelf: input.self === input
      };
    };
    
    const task = defineTask({
      id: 'circular-input-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation(circularInput, mockContext);
    
    // Assert
    expect(result.name).toBe('circular-object');
    expect(result.value).toBe(42);
    expect(result.hasSelf).toBe(true);
  });

  it('should handle task with long-running asynchronous operations', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      // Simulate a long-running operation
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      const endTime = Date.now();
      
      return { 
        success: true,
        duration: endTime - startTime
      };
    };
    
    const task = defineTask({
      id: 'long-running-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({}, mockContext);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(90); // Allow for small timing variations
  });

  it('should handle task with metadata', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    const taskMetadata = {
      author: 'Test Author',
      version: '1.0.0',
      tags: ['test', 'example'],
      timeout: 5000
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      return { success: true };
    };
    
    const task = defineTask({
      id: 'metadata-task',
      implementation: taskImplementation,
      metadata: taskMetadata
    });
    
    // Act
    const result = await task.implementation({}, mockContext);
    
    // Assert
    expect(result.success).toBe(true);
    expect(task.metadata).toEqual(taskMetadata);
  });

  it('should handle task with very long ID', () => {
    // Arrange
    const veryLongId = 'a'.repeat(1000);
    const taskImplementation = async () => ({ success: true });
    
    // Act
    const task = defineTask({
      id: veryLongId,
      implementation: taskImplementation
    });
    
    // Assert
    expect(task.id).toBe(veryLongId);
    expect(task.id.length).toBe(1000);
  });

  it('should handle task that returns undefined', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn()
    };
    
    const taskImplementation = async () => {
      // Explicitly return undefined
      return undefined;
    };
    
    const task = defineTask({
      id: 'undefined-result-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({}, mockContext);
    
    // Assert
    expect(result).toBeUndefined();
  });

  it('should handle task with nested async operations', async () => {
    // Arrange
    const mockContext: TaskContext = {
      emitEvent: vi.fn(),
      executeTask: vi.fn().mockImplementation(async (taskId, input) => {
        // Simulate different subtasks
        if (taskId === 'subtask1') return { result: 'subtask1-result' };
        if (taskId === 'subtask2') return { result: 'subtask2-result' };
        if (taskId === 'subtask3') return { result: 'subtask3-result' };
        return { result: 'unknown-subtask' };
      })
    };
    
    const taskImplementation = async (input: any, context: TaskContext) => {
      // Execute multiple nested async operations
      const result1 = await context.executeTask('subtask1', {});
      const result2 = await context.executeTask('subtask2', {});
      
      // Parallel execution
      const [result3a, result3b] = await Promise.all([
        context.executeTask('subtask3', { param: 'a' }),
        context.executeTask('subtask3', { param: 'b' })
      ]);
      
      return { 
        result1,
        result2,
        result3a,
        result3b,
        allCompleted: true
      };
    };
    
    const task = defineTask({
      id: 'nested-async-task',
      implementation: taskImplementation
    });
    
    // Act
    const result = await task.implementation({}, mockContext);
    
    // Assert
    expect(result.allCompleted).toBe(true);
    expect(result.result1).toEqual({ result: 'subtask1-result' });
    expect(result.result2).toEqual({ result: 'subtask2-result' });
    expect(result.result3a).toEqual({ result: 'subtask3-result' });
    expect(result.result3b).toEqual({ result: 'subtask3-result' });
    expect(mockContext.executeTask).toHaveBeenCalledTimes(4);
  });
}); 