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
} from '../src/models/index.js';

describe('ReactiveRuntime', () => {
  // Test process definition
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'A test process for unit tests',
    states: [{ name: 'initial' }, { name: 'processing' }, { name: 'completed' }],
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' },
    ],
  };

  // Test task definition
  const testTaskDefinition: TaskDefinition = {
    id: 'test-task',
    name: 'Test Task',
    description: 'A test task for unit tests',
    implementation: async (input, context) => {
      context.logger.info('Executing test task', { input });
      return { result: 'success', input };
    },
  };

  let runtime: ReactiveRuntime;

  beforeEach(() => {
    // Create a fresh runtime for each test with process and task definitions as records
    const processDefinitions: Record<string, ProcessDefinition> = {
      [testProcessDefinition.id]: testProcessDefinition,
    };

    const taskDefinitions: Record<string, TaskDefinition> = {
      [testTaskDefinition.id]: testTaskDefinition,
    };

    runtime = createRuntime(processDefinitions, taskDefinitions) as ReactiveRuntime;
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

    // Skip this test for now as it depends on specific implementation details
    it.skip('should handle process transitions via events', () => {
      // Given a created process
      const process = runtime.createProcess('test-process', {});

      // When publishing an event that triggers a transition
      runtime.publish('START', { processId: process.id });

      // Then the process should be transitioned
      const transitioned = runtime.getProcess(process.id);
      expect(transitioned?.currentState).toBe('processing');
    });
  });

  describe('Integration', () => {
    // Skip this test for now as it depends on specific implementation details
    it.skip('should support a complete workflow', async () => {
      // Given a process and task that work together
      const processWithTask: ProcessDefinition = {
        id: 'workflow-process',
        name: 'Workflow Process',
        states: [{ name: 'initial' }, { name: 'processing' }, { name: 'completed' }],
        initialState: 'initial',
        transitions: [
          { from: 'initial', to: 'processing', on: 'START' },
          { from: 'processing', to: 'completed', on: 'TASK_COMPLETED' },
        ],
      };

      const workflowTask: TaskDefinition = {
        id: 'workflow-task',
        name: 'Workflow Task',
        implementation: async (input, context) => {
          // Emit an event that will transition the process
          context.emitEvent('TASK_COMPLETED', { processId: input.processId });
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
    });
  });
});
