import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, createRuntime } from '../src/implementations/runtime.js';
import { ProcessDefinition, TaskDefinition, ProcessContext, TaskContext } from '../src/models/index.js';
import { ExtensionSystem, createExtensionSystem } from '../src/implementations/extension-system.js';

describe('Extension Points', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystem;
  
  // Sample definitions for testing
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'A test process for unit tests',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  const testTaskDefinition: TaskDefinition = {
    id: 'test-task',
    name: 'Test Task',
    description: 'A test task for unit tests',
    handler: async (context: TaskContext) => {
      return { result: 'success', input: context.input };
    }
  };

  beforeEach(() => {
    extensionSystem = createExtensionSystem();
    
    const processDefinitions = { [testProcessDefinition.id]: testProcessDefinition };
    const taskDefinitions = { [testTaskDefinition.id]: testTaskDefinition };
    
    runtime = createRuntime(processDefinitions, taskDefinitions, { extensionSystem });
  });

  describe('Process Lifecycle Extensions', () => {
    it('should trigger extension point before process creation', async () => {
      // Register extension point
      extensionSystem.registerExtensionPoint({
        name: 'process:beforeCreate',
        description: 'Called before creating a process',
        handlers: []
      });
      
      // Create extension hook
      const beforeCreateHandler = vi.fn((context: ProcessContext) => {
        return {
          ...context,
          data: { ...context.data, enriched: true }
        };
      });
      
      // Register extension
      extensionSystem.registerExtension({
        name: 'test-extension',
        description: 'Test extension',
        hooks: {
          'process:beforeCreate': beforeCreateHandler
        }
      });
      
      // Create process
      const process = runtime.createProcess('test-process', { original: true });
      
      // Verify hook was called
      expect(beforeCreateHandler).toHaveBeenCalled();
      expect(process.data).toEqual({ original: true, enriched: true });
    });
  });

  describe('Task Execution Extensions', () => {
    it('should trigger extension point before task execution', async () => {
      // Register extension point
      extensionSystem.registerExtensionPoint({
        name: 'task:beforeExecution',
        description: 'Called before executing a task',
        handlers: []
      });
      
      // Create extension hook
      const beforeExecutionHandler = vi.fn((context: TaskContext) => {
        return {
          ...context,
          input: { ...context.input, enriched: true }
        };
      });
      
      // Register extension
      extensionSystem.registerExtension({
        name: 'test-extension',
        description: 'Test extension',
        hooks: {
          'task:beforeExecution': beforeExecutionHandler
        }
      });
      
      // Execute task
      const result = await runtime.executeTask('test-task', { original: true });
      
      // Verify hook was called
      expect(beforeExecutionHandler).toHaveBeenCalled();
      expect(result.input).toEqual({ original: true, enriched: true });
    });

    it('should allow skipping task execution via extension', async () => {
      // Register extension point
      extensionSystem.registerExtensionPoint({
        name: 'task:beforeExecution',
        description: 'Called before executing a task',
        handlers: []
      });
      
      // Create extension hook that skips execution
      const skipExecutionHandler = vi.fn((context: TaskContext) => {
        return {
          ...context,
          skipExecution: true,
          result: { cached: true }
        };
      });
      
      // Register extension
      extensionSystem.registerExtension({
        name: 'test-extension',
        description: 'Test extension',
        hooks: {
          'task:beforeExecution': skipExecutionHandler
        }
      });
      
      // Execute task
      const result = await runtime.executeTask('test-task', {});
      
      // Verify hook was called and execution was skipped
      expect(skipExecutionHandler).toHaveBeenCalled();
      expect(result).toEqual({ cached: true });
    });
  });

  describe('Event Interceptors', () => {
    it('should process events through interceptors', () => {
      // Register event interceptor
      const interceptor = vi.fn((event) => {
        return {
          ...event,
          payload: { ...event.payload, intercepted: true }
        };
      });
      
      extensionSystem.registerEventInterceptor(interceptor);
      
      // Set up event handler
      const handler = vi.fn();
      runtime.subscribe('TEST_EVENT', handler);
      
      // Publish event
      runtime.publish('TEST_EVENT', { original: true });
      
      // Verify interceptor was called
      expect(interceptor).toHaveBeenCalled();
      
      // Verify handler received intercepted event
      expect(handler).toHaveBeenCalled();
      const receivedEvent = handler.mock.calls[0][0];
      expect(receivedEvent.payload).toEqual({ original: true, intercepted: true });
    });
  });
}); 