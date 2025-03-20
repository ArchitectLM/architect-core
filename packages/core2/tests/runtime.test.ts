import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, createRuntime } from '../src/implementations/runtime.js';
import { ProcessDefinition, TaskDefinition, ProcessInstance, TaskExecution } from '../src/models/index.js';

describe('Runtime', () => {
  let runtime: Runtime;
  
  // Sample definitions for testing
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'A test process for unit tests',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' },
      { from: '*', to: 'error', on: 'ERROR' }
    ]
  };
  
  const testTaskDefinition: TaskDefinition = {
    id: 'test-task',
    name: 'Test Task',
    description: 'A test task for unit tests',
    handler: async (context) => {
      return { result: 'success', input: context.input };
    }
  };

  beforeEach(() => {
    const processDefinitions = { [testProcessDefinition.id]: testProcessDefinition };
    const taskDefinitions = { [testTaskDefinition.id]: testTaskDefinition };
    runtime = createRuntime(processDefinitions, taskDefinitions);
  });

  describe('Process Management', () => {
    it('should create a process instance', () => {
      const processData = { key: 'value' };
      const process = runtime.createProcess('test-process', processData);

      expect(process).toBeDefined();
      expect(process.definitionId).toBe('test-process');
      expect(process.currentState).toBe('initial');
      expect(process.data).toEqual(processData);
    });

    it('should retrieve a process by id', () => {
      const process = runtime.createProcess('test-process', {});
      const retrieved = runtime.getProcess(process.id);

      expect(retrieved).toEqual(process);
    });

    it('should transition a process based on events', () => {
      const process = runtime.createProcess('test-process', {});
      const transitioned = runtime.transitionProcess(process.id, 'START');

      expect(transitioned.currentState).toBe('processing');
      
      const completed = runtime.transitionProcess(transitioned.id, 'COMPLETE');
      expect(completed.currentState).toBe('completed');
    });

    it('should throw an error for invalid transitions', () => {
      const process = runtime.createProcess('test-process', {});
      
      expect(() => {
        runtime.transitionProcess(process.id, 'INVALID_EVENT');
      }).toThrow();
    });
  });

  describe('Task Execution', () => {
    it('should execute a task', async () => {
      const taskInput = { data: 'test' };
      const result = await runtime.executeTask('test-task', taskInput);

      expect(result).toEqual({ result: 'success', input: taskInput });
    });

    it('should throw an error for unknown tasks', async () => {
      await expect(runtime.executeTask('unknown-task', {})).rejects.toThrow();
    });

    it('should handle task failure', async () => {
      const failingTask: TaskDefinition = {
        id: 'failing-task',
        name: 'Failing Task',
        description: 'Task that fails',
        handler: async () => {
          throw new Error('Task failed');
        }
      };

      const processDefinitions = { [testProcessDefinition.id]: testProcessDefinition };
      const taskDefinitions = { 
        [testTaskDefinition.id]: testTaskDefinition,
        [failingTask.id]: failingTask
      };
      
      const runtimeWithFailingTask = createRuntime(processDefinitions, taskDefinitions);

      await expect(runtimeWithFailingTask.executeTask('failing-task', {}))
        .rejects.toThrow('Task failed');
    });
  });

  describe('Event Handling', () => {
    it('should publish and subscribe to events', () => {
      const handler = vi.fn();
      const unsubscribe = runtime.subscribe('TEST_EVENT', handler);

      const payload = { test: true };
      runtime.publish('TEST_EVENT', payload);

      expect(handler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      runtime.publish('TEST_EVENT', payload);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle process transitions via events', () => {
      const process = runtime.createProcess('test-process', {});
      
      const stateChangeHandler = vi.fn();
      runtime.subscribe('process:stateChanged', stateChangeHandler);
      
      runtime.publish('START', { processId: process.id });
      
      const transitioned = runtime.getProcess(process.id);
      expect(transitioned?.currentState).toBe('processing');
      expect(stateChangeHandler).toHaveBeenCalled();
    });
  });

  describe('Extension Points', () => {
    it('should provide extension points for process lifecycle', async () => {
      // This would be implemented with the extension system
      // Here we're just ensuring the function exists
      expect(typeof (runtime as any).executeExtensionPoint).toBe('function');
    });
  });
}); 