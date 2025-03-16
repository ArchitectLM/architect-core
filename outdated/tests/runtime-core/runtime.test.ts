/**
 * Runtime Core Tests
 * 
 * This module tests the runtime core functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveSystemRuntime } from '../../src/runtime-core/lib/runtime';
import { FlowStepType } from '../../src/runtime-core/types';
import { ReactiveSystem, Process, Task } from '../../src/schema/types';

// Mock system for testing
const mockSystem: ReactiveSystem = {
  id: 'test-system',
  name: 'Test System',
  version: '1.0.0',
  processes: {
    'process1': {
      id: 'process1',
      name: 'Process 1',
      contextId: 'context1',
      type: 'stateful' as const,
      triggers: [],
      tasks: ['task1', 'task2'],
      states: ['initial', 'processing', 'completed'],
      transitions: [
        { from: 'initial', to: 'processing', on: 'start' },
        { from: 'processing', to: 'completed', on: 'complete' }
      ]
    } as Process
  },
  tasks: {
    'task1': {
      id: 'task1',
      type: 'operation' as const,
      label: 'Task 1',
      description: 'Test task 1'
    } as Task,
    'task2': {
      id: 'task2',
      type: 'operation' as const,
      label: 'Task 2',
      description: 'Test task 2'
    } as Task
  }
};

describe('ReactiveSystemRuntime', () => {
  let runtime: ReactiveSystemRuntime;
  
  beforeEach(() => {
    runtime = new ReactiveSystemRuntime(mockSystem);
  });
  
  describe('System Information', () => {
    it('should return the system ID', () => {
      expect(runtime.getSystemId()).toBe('test-system');
    });
    
    it('should return the system version', () => {
      expect(runtime.getSystemVersion()).toBe('1.0.0');
    });
  });
  
  describe('Process Management', () => {
    it('should check if a process exists', () => {
      expect(runtime.hasProcess('process1')).toBe(true);
      expect(runtime.hasProcess('nonexistent')).toBe(false);
    });
    
    it('should get the process state', () => {
      expect(runtime.getProcessState('process1')).toBe('initial');
    });
    
    it('should throw an error when getting state of nonexistent process', () => {
      expect(() => runtime.getProcessState('nonexistent')).toThrow();
    });
    
    it('should handle process state transitions', () => {
      runtime.sendEvent('start', { processId: 'process1' });
      expect(runtime.getProcessState('process1')).toBe('processing');
      
      runtime.sendEvent('complete', { processId: 'process1' });
      expect(runtime.getProcessState('process1')).toBe('completed');
    });
  });
  
  describe('Task Management', () => {
    it('should check if a task exists', () => {
      expect(runtime.hasTask('task1')).toBe(true);
      expect(runtime.hasTask('nonexistent')).toBe(false);
    });
    
    it('should register a task implementation', () => {
      const taskImpl = vi.fn().mockResolvedValue({ result: 'success' });
      runtime.registerTaskImplementation('task1', taskImpl);
      
      // This is an indirect test since we can't access private properties
      expect(() => runtime.registerTaskImplementation('task1', taskImpl)).not.toThrow();
    });
    
    it('should throw an error when registering implementation for nonexistent task', () => {
      const taskImpl = vi.fn();
      expect(() => runtime.registerTaskImplementation('nonexistent', taskImpl)).toThrow();
    });
    
    it('should execute a task', async () => {
      const taskImpl = vi.fn().mockResolvedValue({ result: 'success' });
      runtime.registerTaskImplementation('task1', taskImpl);
      
      const result = await runtime.executeTask('task1', { data: 'test' });
      
      expect(taskImpl).toHaveBeenCalledWith({ data: 'test' });
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'success' });
    });
    
    it('should throw an error when executing nonexistent task', async () => {
      await expect(runtime.executeTask('nonexistent', {})).rejects.toThrow();
    });
    
    it('should throw an error when executing task without implementation', async () => {
      await expect(runtime.executeTask('task1', {})).rejects.toThrow();
    });
  });
  
  describe('Flow Execution', () => {
    it('should register and execute a flow', async () => {
      // Register task implementations
      const task1Impl = vi.fn().mockResolvedValue({ result: 'task1' });
      const task2Impl = vi.fn().mockResolvedValue({ result: 'task2' });
      
      runtime.registerTaskImplementation('task1', task1Impl);
      runtime.registerTaskImplementation('task2', task2Impl);
      
      // Register a flow
      const flow = {
        id: 'test-flow',
        name: 'Test Flow',
        description: 'A test flow',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: FlowStepType.TASK,
            taskId: 'task1'
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: FlowStepType.TASK,
            taskId: 'task2',
            inputMapping: (flowInput: any, previousOutputs: Record<string, any>) => {
              return { 
                data: flowInput.data,
                previousResult: previousOutputs.step1.result
              };
            }
          }
        ]
      };
      
      runtime.registerFlow(flow);
      
      // Execute the flow
      const result = await runtime.executeFlow('test-flow', { data: 'test' });
      
      // Verify the flow execution
      expect(result.success).toBe(true);
      expect(task1Impl).toHaveBeenCalledWith({ data: 'test' });
      expect(task2Impl).toHaveBeenCalledWith({ 
        data: 'test',
        previousResult: 'task1'
      });
      expect(result.output).toEqual({ result: 'task2' });
    });
    
    it('should execute a conditional flow', async () => {
      // Register task implementations
      const task1Impl = vi.fn().mockResolvedValue({ result: 'task1' });
      const task2Impl = vi.fn().mockResolvedValue({ result: 'task2' });
      
      runtime.registerTaskImplementation('task1', task1Impl);
      runtime.registerTaskImplementation('task2', task2Impl);
      
      // Register a flow with a condition
      const flow = {
        id: 'conditional-flow',
        name: 'Conditional Flow',
        description: 'A flow with a condition',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: FlowStepType.TASK,
            taskId: 'task1'
          },
          {
            id: 'condition',
            name: 'Condition',
            type: FlowStepType.CONDITION,
            condition: (flowInput: any, previousOutputs: Record<string, any>) => {
              return previousOutputs.step1.result === 'task1';
            },
            thenSteps: [
              {
                id: 'step2',
                name: 'Step 2',
                type: FlowStepType.TASK,
                taskId: 'task2'
              }
            ],
            elseSteps: []
          }
        ]
      };
      
      runtime.registerFlow(flow);
      
      // Execute the flow
      const result = await runtime.executeFlow('conditional-flow', { data: 'test' });
      
      // Verify the flow execution
      expect(result.success).toBe(true);
      expect(task1Impl).toHaveBeenCalledWith({ data: 'test' });
      expect(task2Impl).toHaveBeenCalled();
      expect(result.output).toEqual({ result: 'task2' });
    });
    
    it('should execute a parallel flow', async () => {
      // Register task implementations
      const task1Impl = vi.fn().mockResolvedValue({ result: 'task1' });
      const task2Impl = vi.fn().mockResolvedValue({ result: 'task2' });
      
      runtime.registerTaskImplementation('task1', task1Impl);
      runtime.registerTaskImplementation('task2', task2Impl);
      
      // Register a flow with parallel steps
      const flow = {
        id: 'parallel-flow',
        name: 'Parallel Flow',
        description: 'A flow with parallel steps',
        steps: [
          {
            id: 'parallel',
            name: 'Parallel Steps',
            type: FlowStepType.PARALLEL,
            parallelSteps: [
              {
                id: 'step1',
                name: 'Step 1',
                type: FlowStepType.TASK,
                taskId: 'task1'
              },
              {
                id: 'step2',
                name: 'Step 2',
                type: FlowStepType.TASK,
                taskId: 'task2'
              }
            ]
          }
        ]
      };
      
      runtime.registerFlow(flow);
      
      // Execute the flow
      const result = await runtime.executeFlow('parallel-flow', { data: 'test' });
      
      // Verify the flow execution
      expect(result.success).toBe(true);
      expect(task1Impl).toHaveBeenCalledWith({ data: 'test' });
      expect(task2Impl).toHaveBeenCalledWith({ data: 'test' });
      expect(result.output).toEqual([{ result: 'task1' }, { result: 'task2' }]);
    });
    
    // Increase timeout for this test
    it('should handle errors in flow execution', async () => {
      // Register task implementations
      const task1Impl = vi.fn().mockResolvedValue({ result: 'task1' });
      const task2Impl = vi.fn().mockRejectedValue(new Error('Task 2 failed'));
      
      runtime.registerTaskImplementation('task1', task1Impl);
      runtime.registerTaskImplementation('task2', task2Impl);
      
      // Register a flow
      const flow = {
        id: 'error-flow',
        name: 'Error Flow',
        description: 'A flow that will fail',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: FlowStepType.TASK,
            taskId: 'task1'
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: FlowStepType.TASK,
            taskId: 'task2'
          }
        ]
      };
      
      runtime.registerFlow(flow);
      
      // Execute the flow
      const result = await runtime.executeFlow('error-flow', { data: 'test' }, {
        taskExecutionOptions: {
          timeout: 1000, // Reduce timeout to speed up the test
          maxRetries: 0  // Disable retries to speed up the test
        }
      });
      
      // Verify the flow execution
      expect(result.success).toBe(false);
      expect(task1Impl).toHaveBeenCalledWith({ data: 'test' });
      expect(task2Impl).toHaveBeenCalled();
      expect(result.error).toContain('Task 2 failed');
    }, 10000); // Increase timeout to 10 seconds
    
    // Increase timeout for this test
    it('should continue execution on error if configured', async () => {
      // Register task implementations
      const task1Impl = vi.fn().mockResolvedValue({ result: 'task1' });
      const task2Impl = vi.fn().mockRejectedValue(new Error('Task 2 failed'));
      
      runtime.registerTaskImplementation('task1', task1Impl);
      runtime.registerTaskImplementation('task2', task2Impl);
      
      // Register a flow
      const flow = {
        id: 'continue-on-error-flow',
        name: 'Continue On Error Flow',
        description: 'A flow that will continue on error',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: FlowStepType.TASK,
            taskId: 'task1'
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: FlowStepType.TASK,
            taskId: 'task2',
            executionOptions: {
              timeout: 1000, // Reduce timeout to speed up the test
              maxRetries: 0  // Disable retries to speed up the test
            }
          },
          {
            id: 'step3',
            name: 'Step 3',
            type: FlowStepType.TASK,
            taskId: 'task1'
          }
        ]
      };
      
      runtime.registerFlow(flow);
      
      // Execute the flow with continueOnError option
      const result = await runtime.executeFlow('continue-on-error-flow', { data: 'test' }, {
        continueOnError: true,
        taskExecutionOptions: {
          timeout: 1000, // Reduce timeout to speed up the test
          maxRetries: 0  // Disable retries to speed up the test
        }
      });
      
      // Verify the flow execution
      expect(result.success).toBe(true);
      expect(task1Impl).toHaveBeenCalledTimes(2);
      expect(task2Impl).toHaveBeenCalled();
      expect(result.output).toEqual({ result: 'task1' });
    }, 10000); // Increase timeout to 10 seconds
  });
  
  describe('Event Handling', () => {
    it('should register and trigger event handlers', () => {
      const handler = vi.fn();
      runtime.registerEventHandler('test-event', handler);
      
      runtime.sendEvent('test-event', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });
  });
}); 