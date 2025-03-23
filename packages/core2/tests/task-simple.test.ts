import { describe, it, expect } from 'vitest';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { InMemoryEventBus } from '../src/index';
import { TaskContext } from '../src/models/task-system';

describe('Simple Task Execution', () => {
  it('should execute a task handler', async () => {
    const executionOrder: string[] = [];

    // Create event bus and task registry
    const eventBus = new InMemoryEventBus();
    const taskRegistry = new InMemoryTaskRegistry();
    
    // Register a simple task
    taskRegistry.registerTask({
      id: 'simple-task',
      name: 'Simple Task',
      description: 'A simple test task',
      handler: async (context: TaskContext<any, unknown>) => {
        console.log('Task handler executed with input:', context.input);
        executionOrder.push('simple-task');
        return { result: 'success' };
      }
    });
    
    // Create task executor
    const taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
    
    // Execute the task
    console.log('Executing task...');
    const result = await taskExecutor.executeTask('simple-task', { test: true });
    
    console.log('Task execution result:', result);
    console.log('Execution order:', executionOrder);
    
    // Assertions
    expect(result.success).toBe(true);
    expect(executionOrder).toEqual(['simple-task']);
  });
}); 