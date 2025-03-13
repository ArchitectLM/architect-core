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
      const service = context.getService('database');
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
}); 