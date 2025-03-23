import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { ProcessDefinition, TaskDefinition } from '../src/models/index';
import { ExtensionSystem, ExtensionContext, ExtensionPointName, ExtensionPointNames, ExtensionPointParameters, ExtensionHook } from '../src/models/extension-system';
import { EventBus } from '../src/models/event-system';
import { createRuntime } from '../src/implementations/factory';
import { v4 as uuidv4 } from 'uuid';
import { BasePlugin } from '../src/models/plugin-system';
import { RuntimeInstance } from '../src/implementations/runtime';
import { DomainEvent } from '../src/models/core-types';
import { InMemoryProcessRegistry } from '../src/implementations/process-registry';
import { InMemoryProcessManager } from '../src/implementations/process-manager';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { createExtensionSystem } from '../src/implementations/extension-system';
import { ExtensionEventBusImpl } from '../src/implementations/event-bus';
import { createEmptyPluginRegistry } from '../src/implementations/factory';

describe('Extension Points', () => {
  let runtime: RuntimeInstance;
  let extensionSystem: ExtensionSystem;
  let eventBus: ExtensionEventBusImpl;
  let processRegistry: InMemoryProcessRegistry;
  let taskRegistry: InMemoryTaskRegistry;
  let taskExecutor: InMemoryTaskExecutor;
  let processManager: InMemoryProcessManager;
  
  // Sample definitions for testing
  const testProcessDefinition: ProcessDefinition = {
    type: 'test-process',
    name: 'Test Process',
    description: 'A test process for unit tests',
    initialState: 'initial',
    states: ['initial', 'processing', 'completed'],
    finalStates: ['completed'],
    version: '1.0.0',
    transitions: [
      { from: 'initial', to: 'processing', event: 'START' },
      { from: 'processing', to: 'completed', event: 'COMPLETE' }
    ]
  };
  
  const testTaskDefinition: TaskDefinition = {
    type: 'test-task',
    handler: async (input: unknown) => {
      return { result: 'success', input };
    }
  };

  beforeEach(async () => {
    // Create components
    extensionSystem = createExtensionSystem();
    
    // Explicitly register all the extension points we need for tests
    extensionSystem.registerExtensionPoint(ExtensionPointNames.PROCESS_CREATED);
    extensionSystem.registerExtensionPoint(ExtensionPointNames.TASK_BEFORE_EXECUTE);
    extensionSystem.registerExtensionPoint(ExtensionPointNames.EVENT_BEFORE_PUBLISH);
    
    eventBus = new ExtensionEventBusImpl(extensionSystem);
    const pluginRegistry = createEmptyPluginRegistry();
    
    processRegistry = new InMemoryProcessRegistry();
    taskRegistry = new InMemoryTaskRegistry();
    taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus, extensionSystem);
    processManager = new InMemoryProcessManager(processRegistry, taskExecutor, extensionSystem);
    
    // Create runtime with all required components
    runtime = createRuntime({
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test-extension-points'
      },
      components: {
        extensionSystem,
        eventBus,
        pluginRegistry,
        processRegistry,
        processManager,
        taskRegistry,
        taskExecutor
      }
    }) as RuntimeInstance;
    
    // Initialize runtime
    if (runtime.initialize) {
      await runtime.initialize({
        version: '1.0.0',
        namespace: 'test-extension-points'
      });
    }

    // Register process and task definitions
    await processRegistry.registerProcess(testProcessDefinition);
    await taskRegistry.registerTask(testTaskDefinition);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Process Lifecycle Extensions', () => {
    it('should trigger extension point before process creation', async () => {
      // Create extension hook
      const beforeCreateHandler = vi.fn().mockImplementation(async (params: ExtensionPointParameters[typeof ExtensionPointNames.PROCESS_CREATED]) => {
        return {
          success: true,
          value: {
            ...params,
            data: { ...params.data as Record<string, unknown>, modified: true }
          }
        };
      });

      // Register extension with hook
      const extension = {
        id: `test-extension-${uuidv4()}`,
        name: 'Test Process Extension',
        description: 'A test extension for process creation',
        dependencies: [],
        
        getHooks() {
          return [{
            pointName: ExtensionPointNames.PROCESS_CREATED,
            hook: beforeCreateHandler,
            priority: 0
          }];
        },
        
        getVersion() {
          return '1.0.0';
        },
        
        getCapabilities() {
          return [];
        }
      };
      
      // Register extension
      const result = extensionSystem.registerExtension(extension);
      expect(result.success).toBe(true);
      
      // Create process - this should trigger the extension point
      const process = await processManager.createProcess(testProcessDefinition.type, { original: true });
      
      // Verify handler was called with correct parameters
      expect(beforeCreateHandler).toHaveBeenCalledTimes(1);
      expect(beforeCreateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          processType: testProcessDefinition.type,
          data: expect.objectContaining({ original: true })
        }),
        expect.anything()
      );
    });
  });

  describe('Task Lifecycle Extensions', () => {
    it('should trigger extension point before task execution', async () => {
      // Create extension hook
      const beforeExecutionHandler = vi.fn().mockImplementation(async (params: ExtensionPointParameters[typeof ExtensionPointNames.TASK_BEFORE_EXECUTE]) => {
        return {
          success: true,
          value: {
            ...params,
            input: { ...params.input as Record<string, unknown>, enriched: true }
          }
        };
      });

      // Register extension with hook
      const extension = {
        id: `test-extension-${uuidv4()}`,
        name: 'Test Task Extension',
        description: 'A test extension for task execution',
        dependencies: [],
        
        getHooks() {
          return [{
            pointName: ExtensionPointNames.TASK_BEFORE_EXECUTE,
            hook: beforeExecutionHandler,
            priority: 0
          }];
        },
        
        getVersion() {
          return '1.0.0';
        },
        
        getCapabilities() {
          return [];
        }
      };
      
      // Register extension
      const result = extensionSystem.registerExtension(extension);
      expect(result.success).toBe(true);
      
      // Execute task - this should trigger the extension point
      const taskResult = await taskExecutor.executeTask('test-task', { original: true });
      
      // Verify hook was called with correct parameters
      expect(beforeExecutionHandler).toHaveBeenCalledTimes(1);
      expect(beforeExecutionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'test-task',
          input: expect.objectContaining({ original: true })
        }),
        expect.anything()
      );
      
      // Additionally check that the modified input was used in the actual task execution
      expect(taskResult.success).toBe(true);
      if (taskResult.success && taskResult.value) {
        expect(taskResult.value.input).toHaveProperty('enriched', true);
      }
    });
  });

  describe('Event Interceptors', () => {
    it('should process events through interceptors', async () => {
      // Create extension hook for event interception
      const eventInterceptor = vi.fn().mockImplementation(async (params: ExtensionPointParameters[typeof ExtensionPointNames.EVENT_BEFORE_PUBLISH]) => {
        return {
          success: true,
          value: {
            ...params,
            payload: { ...params.payload as Record<string, unknown>, intercepted: true }
          }
        };
      });
      
      // Register extension with hook
      const extension = {
        id: `test-extension-${uuidv4()}`,
        name: 'Test Event Extension',
        description: 'A test extension for event interception',
        dependencies: [],
        
        getHooks() {
          return [{
            pointName: ExtensionPointNames.EVENT_BEFORE_PUBLISH,
            hook: eventInterceptor,
            priority: 0
          }];
        },
        
        getVersion() {
          return '1.0.0';
        },
        
        getCapabilities() {
          return [];
        }
      };
      
      // Register extension
      const result = extensionSystem.registerExtension(extension);
      expect(result.success).toBe(true);
      
      // Set up event handler
      const handler = vi.fn();
      eventBus.subscribe('test-event', handler);
      
      // Publish event
      const testEvent: DomainEvent<{ original: boolean }> = {
        id: uuidv4(),
        type: 'test-event',
        timestamp: Date.now(),
        payload: { original: true }
      };
      
      await eventBus.publish(testEvent);
      
      // Verify hook was called
      expect(eventInterceptor).toHaveBeenCalledTimes(1);
      expect(eventInterceptor).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'test-event',
          payload: expect.objectContaining({ original: true })
        }),
        expect.anything()
      );
      
      // Verify handler received intercepted event
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Check the structure of what the handler received
      const receivedPayload = handler.mock.calls[0][0];
      expect(receivedPayload).toEqual(
        expect.objectContaining({ 
          original: true,
          intercepted: true 
        })
      );
    });
  });
}); 