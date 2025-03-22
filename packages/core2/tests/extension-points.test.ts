import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { ProcessDefinition, TaskDefinition } from '../src/models/index';
import { ExtensionSystem, ExtensionContext, ExtensionPointName, ExtensionPointNames, ExtensionPointParameters, ExtensionHook } from '../src/models/extension-system';
import { EventBus } from '../src/models/event-system';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { v4 as uuidv4 } from 'uuid';
import { BasePlugin } from '../src/models/plugin-system';

describe('Extension Points', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystem;
  let eventBus: EventBus;
  
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
    handler: async (context: ExtensionContext) => {
      return { result: 'success', input: context.state };
    }
  };

  beforeEach(async () => {
    runtime = createModernRuntime({
      persistEvents: false,
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test'
      }
    });
    extensionSystem = runtime.extensionSystem;
    eventBus = runtime.eventBus;

    // Register process and task definitions
    await runtime.processRegistry.registerProcess(testProcessDefinition);
    await runtime.taskRegistry.registerTask(testTaskDefinition);
  });

  describe('Process Lifecycle Extensions', () => {
    it('should trigger extension point before process creation', async () => {
      // Create extension hook
      const beforeCreateHandler = vi.fn(async (params: ExtensionPointParameters[typeof ExtensionPointNames.PROCESS_BEFORE_CREATE], context: ExtensionContext) => {
        return {
          success: true as const,
          value: {
            processType: params.processType,
            data: { ...params.data as Record<string, unknown>, modified: true }
          }
        };
      });
      
      // Create extension
      class TestExtension<N extends ExtensionPointName> extends BasePlugin {
        constructor(
          private pointName: N,
          private hook: ExtensionHook<N>,
          options: { id: string; name: string; description: string; dependencies: string[] }
        ) {
          super(options);
          this.registerHook(pointName, hook);
        }
        
        getVersion() {
          return '1.0.0';
        }
        
        getCapabilities() {
          return ['process-modification'];
        }
      }
      
      // Register extension
      const extension = new TestExtension<typeof ExtensionPointNames.PROCESS_BEFORE_CREATE>(
        ExtensionPointNames.PROCESS_BEFORE_CREATE,
        beforeCreateHandler,
        {
          id: uuidv4(),
          name: 'test-extension',
          description: 'Test extension',
          dependencies: []
        }
      );
      
      extensionSystem.registerExtension(extension);
      
      // Create process
      const process = await runtime.processManager.createProcess(testProcessDefinition.id, { original: true });
      
      // Verify handler was called
      expect(beforeCreateHandler).toHaveBeenCalled();
      expect(process.success).toBe(true);
      if (process.success) {
        expect(process.value.data).toEqual({ original: true, modified: true });
      }
    });
  });

  describe('Task Execution Extensions', () => {
    it('should trigger extension point before task execution', async () => {
      // Create extension hook
      const beforeExecutionHandler = vi.fn(async (params: ExtensionPointParameters[typeof ExtensionPointNames.TASK_BEFORE_EXECUTION], context: ExtensionContext) => {
        return {
          success: true as const,
          value: {
            taskId: params.taskId,
            taskType: params.taskType,
            input: { ...params.input as Record<string, unknown>, enriched: true }
          }
        };
      });
      
      // Create extension
      class TestExtension<N extends ExtensionPointName> extends BasePlugin {
        constructor(
          private pointName: N,
          private hook: ExtensionHook<N>,
          options: { id: string; name: string; description: string; dependencies: string[] }
        ) {
          super(options);
          this.registerHook(pointName, hook);
        }
        
        getVersion() {
          return '1.0.0';
        }
        
        getCapabilities() {
          return ['task-modification'];
        }
      }
      
      // Register extension
      const extension = new TestExtension<typeof ExtensionPointNames.TASK_BEFORE_EXECUTION>(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        beforeExecutionHandler,
        {
          id: uuidv4(),
          name: 'test-extension',
          description: 'Test extension',
          dependencies: []
        }
      );
      
      extensionSystem.registerExtension(extension);
      
      // Execute task
      const result = await runtime.taskExecutor.executeTask('test-task', { original: true });
      
      // Verify hook was called
      expect(beforeExecutionHandler).toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.input).toEqual({ original: true, enriched: true });
      }
    });

    it('should allow skipping task execution via extension', async () => {
      // Create extension hook that skips execution
      const skipExecutionHandler = vi.fn(async (params: ExtensionPointParameters[typeof ExtensionPointNames.TASK_BEFORE_EXECUTION], context: ExtensionContext) => {
        return {
          success: true as const,
          value: {
            taskId: params.taskId,
            taskType: params.taskType,
            input: params.input,
            skipExecution: true,
            result: { cached: true }
          }
        };
      });
      
      // Create extension
      class TestExtension<N extends ExtensionPointName> extends BasePlugin {
        constructor(
          private pointName: N,
          private hook: ExtensionHook<N>,
          options: { id: string; name: string; description: string; dependencies: string[] }
        ) {
          super(options);
          this.registerHook(pointName, hook);
        }
        
        getVersion() {
          return '1.0.0';
        }
        
        getCapabilities() {
          return ['task-skipping'];
        }
      }
      
      // Register extension
      const extension = new TestExtension<typeof ExtensionPointNames.TASK_BEFORE_EXECUTION>(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        skipExecutionHandler,
        {
          id: uuidv4(),
          name: 'test-extension',
          description: 'Test extension',
          dependencies: []
        }
      );
      
      extensionSystem.registerExtension(extension);
      
      // Execute task
      const result = await runtime.taskExecutor.executeTask('test-task', {});
      
      // Verify hook was called and execution was skipped
      expect(skipExecutionHandler).toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.result).toEqual({ cached: true });
      }
    });
  });

  describe('Event Interceptors', () => {
    it('should process events through interceptors', async () => {
      // Create extension hook for event interception
      const eventInterceptor = vi.fn(async (params: ExtensionPointParameters[typeof ExtensionPointNames.EVENT_BEFORE_PUBLISH], context: ExtensionContext) => {
        return {
          success: true as const,
          value: {
            eventType: params.eventType,
            payload: { ...params.payload as Record<string, unknown>, intercepted: true }
          }
        };
      });
      
      // Create extension
      class TestExtension<N extends ExtensionPointName> extends BasePlugin {
        constructor(
          private pointName: N,
          private hook: ExtensionHook<N>,
          options: { id: string; name: string; description: string; dependencies: string[] }
        ) {
          super(options);
          this.registerHook(pointName, hook);
        }
        
        getVersion() {
          return '1.0.0';
        }
        
        getCapabilities() {
          return ['event-interception'];
        }
      }
      
      // Register extension
      const extension = new TestExtension<typeof ExtensionPointNames.EVENT_BEFORE_PUBLISH>(
        ExtensionPointNames.EVENT_BEFORE_PUBLISH,
        eventInterceptor,
        {
          id: uuidv4(),
          name: 'test-extension',
          description: 'Test extension',
          dependencies: []
        }
      );
      
      extensionSystem.registerExtension(extension);
      
      // Set up event handler
      const handler = vi.fn();
      eventBus.subscribe('test-event', handler);
      
      // Publish event
      await eventBus.publish({
        id: uuidv4(),
        type: 'test-event',
        timestamp: Date.now(),
        payload: { original: true }
      });
      
      // Verify hook was called
      expect(eventInterceptor).toHaveBeenCalled();
      
      // Verify handler received intercepted event
      expect(handler).toHaveBeenCalled();
      const receivedEvent = handler.mock.calls[0][0];
      expect(receivedEvent.payload).toEqual({ original: true, intercepted: true });
    });
  });
}); 