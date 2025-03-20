/**
 * Tests for the ReactiveRuntime implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveRuntime, createRuntime } from '../src/implementations/runtime.js';
import {
  ProcessDefinition,
  ProcessInstance,
  TaskDefinition,
  Event,
  TaskExecution,
  TaskContext,
} from '../src/models/index.js';

// Test process definition
const testProcessDefinition: ProcessDefinition = {
  id: 'test-process',
  name: 'Test Process',
  description: 'A test process for unit tests',
  initialState: 'initial',
  transitions: [
    { from: 'initial', to: 'processing', on: 'START' },
    { from: 'processing', to: 'completed', on: 'COMPLETE' },
    { from: '*', to: 'error', on: 'ERROR' }
  ],
  tasks: []
};

// Workflow process definition
const workflowProcessDefinition: ProcessDefinition = {
  id: 'workflow-process',
  name: 'Workflow Process',
  description: 'A process for testing workflow scenarios',
  initialState: 'initial',
  transitions: [
    { from: 'initial', to: 'processing', on: 'START' },
    { from: 'processing', to: 'completed', on: 'TASK_COMPLETED' },
    { from: 'processing', to: 'error', on: 'TASK_FAILED' },
    { from: 'error', to: 'processing', on: 'START' },
    { from: 'completed', to: 'processing', on: 'START' }
  ],
  tasks: []
};

// Wildcard process definition
const wildcardProcessDefinition: ProcessDefinition = {
  id: 'wildcard-process',
  name: 'Wildcard Process',
  description: 'Process with wildcard transitions',
  initialState: 'initial',
  transitions: [
    { from: '*', to: 'error', on: 'ERROR' }
  ],
  tasks: []
};

// Test task definition
const testTaskDefinition: TaskDefinition = {
  id: 'test-task',
  name: 'Test Task',
  description: 'A test task for unit tests',
  handler: async (context) => {
    context.logger.info('Executing test task', { input: context.input });
    return { result: 'success', input: context.input };
  },
};

describe('ReactiveRuntime', () => {
  let runtime: ReactiveRuntime;

  beforeEach(() => {
    // Create a fresh runtime for each test with process and task definitions as records
    const processDefinitions: Record<string, ProcessDefinition> = {
      [testProcessDefinition.id]: testProcessDefinition,
      [workflowProcessDefinition.id]: workflowProcessDefinition,
      [wildcardProcessDefinition.id]: wildcardProcessDefinition,
    };

    const taskDefinitions: Record<string, TaskDefinition> = {
      [testTaskDefinition.id]: testTaskDefinition,
    };

    runtime = createRuntime(processDefinitions, taskDefinitions) as ReactiveRuntime;
  });

  describe('constructor', () => {
    it('should initialize with default logger when not provided', () => {
      const runtime = new ReactiveRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [testTaskDefinition.id]: testTaskDefinition }
      );
      expect(runtime).toBeDefined();
    });

    it('should initialize with custom logger when provided', () => {
      const customLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      const runtime = new ReactiveRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [testTaskDefinition.id]: testTaskDefinition },
        { logger: customLogger }
      );
      expect(runtime).toBeDefined();
    });
  });

  describe('Process Management', () => {
    it('should create a process instance', () => {
      // When creating a process
      const processData = { key: 'value' };
      const process = runtime.createProcess('test-process', processData);

      // Then the process should be created with the correct properties
      expect(process).toBeDefined();
      expect(process.definitionId).toBe('test-process');
      expect(process.currentState).toBe('initial');
      expect(process.data).toEqual(processData);
      expect(process.history).toHaveLength(1);
      expect(process.history[0].state).toBe('initial');
    });

    it('should retrieve a process by id', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', {});

      // When retrieving the process
      const retrieved = runtime.getProcess(process.id);

      // Then it should return the same process
      expect(retrieved).toEqual(process);
    });

    it('should transition a process based on events', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', {});

      // When transitioning the process
      const transitioned = runtime.transitionProcess(process.id, 'START');

      // Then the process should be in the new state
      expect(transitioned.currentState).toBe('processing');
      expect(transitioned.history).toHaveLength(2);
      expect(transitioned.history[1].state).toBe('processing');

      // And when transitioning again
      const completed = runtime.transitionProcess(transitioned.id, 'COMPLETE');

      // Then the process should be in the final state
      expect(completed.currentState).toBe('completed');
      expect(completed.history).toHaveLength(3);
      expect(completed.history[2].state).toBe('completed');
    });

    it('should throw an error for invalid transitions', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', {});

      // When attempting an invalid transition
      // Then it should throw an error
      expect(() => {
        runtime.transitionProcess(process.id, 'INVALID_EVENT');
      }).toThrow();
    });

    it('should update process data during transition', () => {
      const instance = runtime.createProcess('test-process', {});
      const payload = { newData: 'value' };
      const updated = runtime.transitionProcess(instance.id, 'START', payload);

      expect(updated.data).toEqual(payload);
    });

    it('should handle error transitions in default process', () => {
      const instance = runtime.createProcess('test-process', {});
      const updated = runtime.transitionProcess(instance.id, 'ERROR');

      expect(updated.currentState).toBe('error');
      expect(updated.history).toHaveLength(2);
      expect(updated.history[1].state).toBe('error');
      expect(updated.history[1].transition).toBe('ERROR');
    });

    it('should emit state changed event', () => {
      const handler = vi.fn();
      runtime.subscribe('process:stateChanged', handler);

      const instance = runtime.createProcess('test-process', {});
      runtime.transitionProcess(instance.id, 'START');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'process:stateChanged',
        payload: expect.objectContaining({
          processId: instance.id,
          definitionId: 'test-process',
          previousState: 'initial',
          currentState: 'processing',
          transition: 'START'
        })
      }));
    });

    it('should handle process instance not found during transition', () => {
      // When transitioning a non-existent process
      // Then it should throw an error
      expect(() => {
        runtime.transitionProcess('non-existent-id', 'START');
      }).toThrow('Process instance not found: non-existent-id');
    });

    it('should handle process definition not found during transition', () => {
      // Given a process with invalid definition ID
      const invalidProcess = runtime.createProcess('test-process', {});
      (invalidProcess as any).definitionId = 'non-existent-definition';

      // When transitioning the process
      // Then it should throw an error
      expect(() => {
        runtime.transitionProcess(invalidProcess.id, 'START');
      }).toThrow('Process definition not found: non-existent-definition');
    });

    it('should handle process definition not found error', () => {
      // When creating a process with non-existent definition
      // Then it should throw an error
      expect(() => {
        runtime.createProcess('non-existent-definition', {});
      }).toThrow('Process definition not found: non-existent-definition');
    });

    it('should handle COMPLETE event edge cases', () => {
      // Given a custom logger and runtime
      const customLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      const runtimeWithLogger = new ReactiveRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [testTaskDefinition.id]: testTaskDefinition },
        { logger: customLogger }
      );

      // And a spy on transitionProcess
      const transitionProcessSpy = vi.spyOn(runtimeWithLogger as any, 'transitionProcess');

      // When publishing COMPLETE event without processId
      runtimeWithLogger.publish('COMPLETE', {});

      // Then transitionProcess should not be called
      expect(transitionProcessSpy).not.toHaveBeenCalled();

      // When publishing COMPLETE event with undefined processId
      runtimeWithLogger.publish('COMPLETE', { processId: undefined });

      // Then transitionProcess should not be called
      expect(transitionProcessSpy).not.toHaveBeenCalled();

      // When publishing COMPLETE event with null processId
      runtimeWithLogger.publish('COMPLETE', { processId: null });

      // Then transitionProcess should not be called
      expect(transitionProcessSpy).not.toHaveBeenCalled();

      // Reset the spy
      transitionProcessSpy.mockClear();

      // When publishing COMPLETE event with invalid processId
      runtimeWithLogger.publish('COMPLETE', { processId: 'invalid-id' });

      // Then transitionProcess should have been called
      expect(transitionProcessSpy).toHaveBeenCalledWith('invalid-id', 'COMPLETE');

      // And the error should be handled gracefully (no throw)
      expect(() => {
        runtimeWithLogger.publish('COMPLETE', { processId: 'invalid-id' });
      }).not.toThrow();
    });
  });

  describe('Task Execution', () => {
    it('should execute a task', async () => {
      // Given a task input
      const taskInput = { data: 'test' };

      // When executing the task
      const result = await runtime.executeTask('test-task', taskInput);

      // Then it should return the expected result
      expect(result).toEqual({ result: 'success', input: taskInput });
    });

    it('should throw an error for unknown tasks', async () => {
      // When executing an unknown task
      // Then it should throw an error
      await expect(runtime.executeTask('unknown-task', {})).rejects.toThrow();
    });

    it('should retrieve task execution by id', async () => {
      // Given an executed task
      const taskInput = { data: 'test' };
      await runtime.executeTask('test-task', taskInput);

      // When retrieving task executions
      const executions = Object.values((runtime as any).taskExecutions) as TaskExecution[];

      // Then there should be one execution
      expect(executions).toHaveLength(1);

      // And when retrieving by id
      const execution = runtime.getTaskExecution(executions[0].id);

      // Then it should return the correct execution
      expect(execution).toBeDefined();
      expect(execution?.taskId).toBe('test-task');
      expect(execution?.status).toBe('completed');
      expect(execution?.result).toEqual({ result: 'success', input: taskInput });
    });

    it('should handle basic task failure', async () => {
      const failingTask: TaskDefinition = {
        id: 'failing-task',
        name: 'Failing Task',
        description: 'Task that fails',
        handler: async () => {
          throw new Error('Task failed');
        }
      };

      const runtime = new ReactiveRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [testTaskDefinition.id]: testTaskDefinition, [failingTask.id]: failingTask }
      );

      await expect(runtime.executeTask('failing-task', {})).rejects.toThrow('Task failed');

      // Verify task execution record
      const executions = Object.values((runtime as any).taskExecutions) as TaskExecution[];
      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe('failed');
      expect(executions[0].error).toBe('Task failed');
    });

    it('should handle task execution with and without existing process', async () => {
      // Given a task definition
      const taskDef: TaskDefinition = {
        id: 'process-task',
        name: 'Process Task',
        description: 'Task that works with processes',
        handler: async (context) => ({ result: 'success' })
      };

      const runtime = new ReactiveRuntime({}, { [taskDef.id]: taskDef });

      // When executing task without process
      await runtime.executeTask('process-task', {});

      // Then it should create a process
      const processes = Object.values((runtime as any).processInstances || {});
      expect(processes.length).toBeGreaterThan(0);

      // When executing task with existing process
      const process = runtime.createProcess('process-task', {});
      await runtime.executeTask('process-task', { processId: process.id });

      // Then it should reuse the process
      const updatedProcesses = Object.values((runtime as any).processInstances || {});
      expect(updatedProcesses.length).toBeGreaterThan(processes.length);
    });
  });

  describe('Event Handling', () => {
    it('should publish and subscribe to events', () => {
      // Given a subscription to an event
      const handler = vi.fn();
      const unsubscribe = runtime.subscribe('TEST_EVENT', handler);

      // When publishing an event
      const payload = { test: true };
      runtime.publish('TEST_EVENT', payload);

      // Then the handler should be called with the event
      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as Event;
      expect(event.type).toBe('TEST_EVENT');
      expect(event.payload).toEqual(payload);

      // And when unsubscribing
      unsubscribe();

      // And publishing again
      runtime.publish('TEST_EVENT', payload);

      // Then the handler should not be called again
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle process transitions via events', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', {});

      // When subscribing to state changes
      const stateChangeHandler = vi.fn();
      runtime.subscribe('process:stateChanged', stateChangeHandler);

      // And publishing an event that triggers a transition
      runtime.publish('START', { processId: process.id });

      // Then the process should be transitioned
      const transitioned = runtime.getProcess(process.id);
      expect(transitioned?.currentState).toBe('processing');

      // And the state change event should be emitted
      expect(stateChangeHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'process:stateChanged',
        payload: expect.objectContaining({
          processId: process.id,
          previousState: 'initial',
          currentState: 'processing',
          transition: 'START'
        })
      }));
    });

    it('should handle multiple subscribers for the same event', () => {
      // Given multiple subscribers
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      runtime.subscribe('TEST_EVENT', handler1);
      runtime.subscribe('TEST_EVENT', handler2);

      // When publishing an event
      const payload = { test: true };
      runtime.publish('TEST_EVENT', payload);

      // Then both handlers should be called
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle event publishing with no subscribers', () => {
      // When publishing an event with no subscribers
      const payload = { test: true };
      expect(() => runtime.publish('TEST_EVENT', payload)).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should support a complete workflow', async () => {
      // Given a process and task that work together
      const processWithTask: ProcessDefinition = {
        id: 'workflow-process',
        name: 'Workflow Process',
        description: 'A workflow process',
        initialState: 'initial',
        transitions: [
          { from: 'initial', to: 'processing', on: 'START' },
          { from: 'processing', to: 'completed', on: 'TASK_COMPLETED' },
        ],
        tasks: []
      };

      const workflowTask: TaskDefinition = {
        id: 'workflow-task',
        name: 'Workflow Task',
        description: 'A workflow task',
        handler: async (context) => {
          // Emit an event that will transition the process
          context.emitEvent('TASK_COMPLETED', { processId: context.input.processId });
          return { completed: true };
        },
      };

      // Create a runtime with these definitions as records
      const processDefinitions: Record<string, ProcessDefinition> = {
        [processWithTask.id]: processWithTask,
      };

      const taskDefinitions: Record<string, TaskDefinition> = {
        [workflowTask.id]: workflowTask,
      };

      const workflowRuntime = createRuntime(processDefinitions, taskDefinitions);

      // When creating a process
      const process = workflowRuntime.createProcess('workflow-process', {});

      // And transitioning to processing
      const processing = workflowRuntime.transitionProcess(process.id, 'START');
      expect(processing.currentState).toBe('processing');

      // And executing the task with the process id
      await workflowRuntime.executeTask('workflow-task', { processId: process.id });

      // Then the process should be transitioned to completed by the task
      const completed = workflowRuntime.getProcess(process.id);
      expect(completed?.currentState).toBe('completed');

      // And the task execution should be recorded
      const executions = Object.values((workflowRuntime as any).taskExecutions) as TaskExecution[];
      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe('completed');
      expect(executions[0].result).toEqual({ completed: true });
    }, 10000);

    it('should handle task failures in workflow', async () => {
      // Given a process and failing task
      const processWithTask: ProcessDefinition = {
        id: 'workflow-process',
        name: 'Workflow Process',
        description: 'A workflow process',
        initialState: 'initial',
        transitions: [
          { from: 'initial', to: 'processing', on: 'START' },
          { from: 'processing', to: 'error', on: 'TASK_FAILED' },
        ],
        tasks: []
      };

      const failingTask: TaskDefinition = {
        id: 'failing-task',
        name: 'Failing Task',
        description: 'A task that fails',
        handler: async () => {
          throw new Error('Task failed');
        },
      };

      const workflowRuntime = createRuntime(
        { [processWithTask.id]: processWithTask },
        { [failingTask.id]: failingTask }
      );

      // When creating a process
      const process = workflowRuntime.createProcess('workflow-process', {});

      // And transitioning to processing
      const processing = workflowRuntime.transitionProcess(process.id, 'START');
      expect(processing.currentState).toBe('processing');

      // And executing the failing task
      await expect(workflowRuntime.executeTask('failing-task', { processId: process.id }))
        .rejects.toThrow('Task failed');

      // Then the process should be in error state
      const errorState = workflowRuntime.getProcess(process.id);
      expect(errorState?.currentState).toBe('error');

      // And the task execution should be recorded as failed
      const executions = Object.values((workflowRuntime as any).taskExecutions) as TaskExecution[];
      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe('failed');
      expect(executions[0].error).toBe('Task failed');
    }, 10000);
  });

  describe('Edge Cases', () => {
    it('should handle process data updates during transitions', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', { initial: 'data' });

      // When transitioning with new data
      const updated = runtime.transitionProcess(process.id, 'START', { new: 'data' });

      // Then the process data should be merged
      expect(updated.data).toEqual({
        initial: 'data',
        new: 'data'
      });
    });

    it('should handle wildcard transitions in dedicated process', () => {
      // Given a process with wildcard transition
      const wildcardProcess: ProcessDefinition = {
        id: 'wildcard-process',
        name: 'Wildcard Process',
        description: 'Process with wildcard transitions',
        initialState: 'initial',
        transitions: [
          { from: '*', to: 'error', on: 'ERROR' }
        ],
        tasks: []
      };

      const runtime = createRuntime(
        { [wildcardProcess.id]: wildcardProcess },
        {}
      );

      // When creating a process
      const process = runtime.createProcess('wildcard-process', {});

      // Then it should transition to error from any state
      const errorState = runtime.transitionProcess(process.id, 'ERROR');
      expect(errorState.currentState).toBe('error');
    });

    it('should handle concurrent transitions', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', {});

      // When transitioning multiple times
      const transitioned1 = runtime.transitionProcess(process.id, 'START');
      const transitioned2 = runtime.transitionProcess(transitioned1.id, 'COMPLETE');

      // Then the process should maintain correct history
      expect(transitioned2.history).toHaveLength(3);
      expect(transitioned2.history[0].state).toBe('initial');
      expect(transitioned2.history[1].state).toBe('processing');
      expect(transitioned2.history[2].state).toBe('completed');
    });

    it('should handle task dependencies', async () => {
      // Given tasks with dependencies
      const task1: TaskDefinition = {
        id: 'task1',
        name: 'Task 1',
        description: 'First task',
        handler: async (context) => ({ result: 'task1' })
      };

      const task2: TaskDefinition = {
        id: 'task2',
        name: 'Task 2',
        description: 'Second task',
        dependencies: ['task1'],
        handler: async (context) => {
          const result = await context.getTaskResult('task1');
          return { result: 'task2', dependsOn: result };
        }
      };

      const runtime = createRuntime({}, { task1, task2 });

      // When executing the dependent task
      const result = await runtime.executeTask('task2', {});

      // Then it should have access to the dependency result
      expect(result).toEqual({
        result: 'task2',
        dependsOn: { result: 'task1' }
      });
    });

    it('should handle task cancellation', async () => {
      const longTask: TaskDefinition = {
        id: 'long-task',
        name: 'Long Task',
        description: 'A task that takes time',
        handler: async (context) => {
          if (context.isCancelled()) {
            throw new Error('Task was cancelled');
          }
          for (let i = 0; i < 100; i++) {
            if (context.isCancelled()) {
              throw new Error('Task was cancelled');
            }
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          if (context.isCancelled()) {
            throw new Error('Task was cancelled');
          }
          return 'Task completed';
        }
      };

      const runtime = createRuntime({}, { [longTask.id]: longTask });

      let executionId: string | undefined;
      runtime.subscribe('TASK_STARTED', (event: Event) => {
        if (event.payload.taskId === 'long-task') {
          executionId = event.payload.executionId;
        }
      });

      const taskPromise = runtime.executeTask('long-task', {});
      await new Promise(resolve => setTimeout(resolve, 10));

      if (executionId) {
        runtime.cancelTask(executionId);
      }

      await expect(taskPromise).rejects.toThrow('Task was cancelled');
      expect(runtime.getTaskExecution(executionId!)?.status).toBe('cancelled');
    });

    it('should handle task retries', async () => {
      // Given a task that fails initially
      let attempts = 0;
      const retryTask: TaskDefinition = {
        id: 'retry-task',
        name: 'Retry Task',
        description: 'A task that succeeds after retries',
        handler: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { result: 'success', attempts };
        }
      };

      const runtime = createRuntime({}, { [retryTask.id]: retryTask });

      // When executing the task
      const result = await runtime.executeTask('retry-task', {});

      // Then it should succeed after retries
      expect(result).toEqual({ result: 'success', attempts: 3 });
    }, 10000);

    it('should handle event propagation errors', () => {
      // Given a subscriber that throws
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      runtime.subscribe('TEST_EVENT', errorHandler);

      // When publishing an event
      // Then it should not throw
      expect(() => runtime.publish('TEST_EVENT', {})).not.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle event handler cleanup', () => {
      // Given multiple subscribers
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsubscribe1 = runtime.subscribe('TEST_EVENT', handler1);
      const unsubscribe2 = runtime.subscribe('TEST_EVENT', handler2);

      // When publishing an event
      runtime.publish('TEST_EVENT', {});

      // Then both handlers should be called
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // And when unsubscribing one handler
      unsubscribe1();

      // And publishing again
      runtime.publish('TEST_EVENT', {});

      // Then only the remaining handler should be called
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(2);
    });

    it('should handle event payload validation', () => {
      // Given a subscriber
      const handler = vi.fn();
      runtime.subscribe('TEST_EVENT', handler);

      // When publishing with invalid payload
      expect(() => runtime.publish('TEST_EVENT', undefined)).not.toThrow();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TEST_EVENT',
        payload: undefined
      }));
    });
  });

  describe('Task Dependencies', () => {
    it('should handle circular dependencies', async () => {
      const runtime = createRuntime(
        {
          testProcess: {
            id: 'testProcess',
            name: 'Test Process',
            description: 'Test process with circular dependencies',
            initialState: 'initial',
            transitions: [
              { from: 'initial', to: 'processing', on: 'START' },
              { from: 'processing', to: 'completed', on: 'TASK_COMPLETED' },
              { from: 'processing', to: 'error', on: 'TASK_FAILED' }
            ],
            tasks: []
          }
        },
        {
          taskA: {
            id: 'taskA',
            name: 'Task A',
            description: 'Task A that depends on Task B',
            dependencies: ['taskB'],
            handler: async (context) => {
              const result = await context.getTaskResult('taskB');
              return `Task A result using ${result}`;
            }
          },
          taskB: {
            id: 'taskB',
            name: 'Task B',
            description: 'Task B that depends on Task A',
            dependencies: ['taskA'],
            handler: async (context) => {
              const result = await context.getTaskResult('taskA');
              return `Task B result using ${result}`;
            }
          }
        }
      );

      await expect(runtime.executeTask('taskA', {})).rejects.toThrow('Circular dependency detected');
    });

    it('should cache dependency results', async () => {
      let taskBCalls = 0;
      const runtime = createRuntime(
        {
          testProcess: {
            id: 'testProcess',
            name: 'Test Process',
            description: 'Test process with dependency caching',
            initialState: 'initial',
            transitions: [
              { from: 'initial', to: 'processing', on: 'START' },
              { from: 'processing', to: 'completed', on: 'TASK_COMPLETED' },
              { from: 'processing', to: 'error', on: 'TASK_FAILED' }
            ],
            tasks: []
          }
        },
        {
          taskA: {
            id: 'taskA',
            name: 'Task A',
            description: 'Task A that depends on Task B',
            dependencies: ['taskB'],
            handler: async (context) => {
              const result = await context.getTaskResult('taskB');
              return `Task A result using ${result}`;
            }
          },
          taskB: {
            id: 'taskB',
            name: 'Task B',
            description: 'Task B that is called multiple times',
            handler: async () => {
              taskBCalls++;
              return 'Task B result';
            }
          }
        }
      );

      await runtime.executeTask('taskA', {});
      expect(taskBCalls).toBe(1); // Task B should only be called once
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel dependent tasks when parent is cancelled', async () => {
      const taskDefinitions: Record<string, TaskDefinition> = {
        'parent-task': {
          id: 'parent-task',
          name: 'Parent Task',
          description: 'Parent task that depends on child task',
          dependencies: ['child-task'],
          handler: async (context: TaskContext) => {
            // Wait for task execution to start
            await new Promise(resolve => setTimeout(resolve, 100));
            if (context.isCancelled()) {
              throw new Error('Task was cancelled');
            }
            const childResult = await context.getTaskResult('child-task');
            return { message: 'Parent task completed', childResult };
          }
        },
        'child-task': {
          id: 'child-task',
          name: 'Child Task',
          description: 'Child task that will be cancelled',
          handler: async (context: TaskContext) => {
            // Wait for task execution to start
            await new Promise(resolve => setTimeout(resolve, 100));
            if (context.isCancelled()) {
              throw new Error('Task was cancelled');
            }
            // Wait for cancellation
            await new Promise(resolve => setTimeout(resolve, 200));
            if (context.isCancelled()) {
              throw new Error('Task was cancelled');
            }
            return { message: 'Child task completed' };
          }
        }
      };

      const runtime = createRuntime({}, taskDefinitions);
      let parentExecutionId: string | undefined;
      let childExecutionId: string | undefined;

      // Set up event subscription before starting execution
      const taskStartedPromise = new Promise<void>((resolve) => {
        runtime.subscribe('TASK_STARTED', (event: Event<{ taskId: string; executionId: string }>) => {
          if (event.payload.taskId === 'parent-task') {
            parentExecutionId = event.payload.executionId;
          } else if (event.payload.taskId === 'child-task') {
            childExecutionId = event.payload.executionId;
          }
          // Resolve when we have both IDs
          if (parentExecutionId && childExecutionId) {
            resolve();
          }
        });
      });

      // Start task execution
      const executionPromise = runtime.executeTask('parent-task', {});

      // Wait for both tasks to start
      await taskStartedPromise;

      // Ensure we have both execution IDs
      expect(parentExecutionId).toBeDefined();
      expect(childExecutionId).toBeDefined();

      // Cancel the parent task
      await runtime.cancelTask(parentExecutionId!);

      // Wait for cancellation to propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get final task statuses
      const parentExecution = await runtime.getTaskExecution(parentExecutionId!);
      const childExecution = await runtime.getTaskExecution(childExecutionId!);

      // Both tasks should be cancelled
      expect(parentExecution?.status).toBe('cancelled');
      expect(childExecution?.status).toBe('cancelled');

      // Verify the execution promise rejects with cancellation error
      await expect(executionPromise).rejects.toThrow('Task was cancelled');
    });
  });
});

describe('createRuntime', () => {
  it('should create a runtime instance', () => {
    const runtime = createRuntime(
      { [testProcessDefinition.id]: testProcessDefinition },
      { [testTaskDefinition.id]: testTaskDefinition }
    );
    expect(runtime).toBeInstanceOf(ReactiveRuntime);
  });
});
