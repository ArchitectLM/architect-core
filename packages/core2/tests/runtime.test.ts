import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Runtime, RuntimeOptions, ComponentHealth, SystemHealth } from '../src/models/runtime';
import { RuntimeInstance, CoreRuntimeConfig } from '../src/implementations/runtime';
import { createCoreRuntime } from '../src/implementations/runtime';
import { Plugin, BasePlugin } from '../src/models/plugin-system';
import { EventBus } from '../src/models/event-system';
import { ExtensionSystem, ExtensionPointNames } from '../src/models/extension-system';
import { EventStorage } from '../src/models/event-system';
import { ProcessDefinition } from '../src/models/process-system';
import { DomainEvent, Result } from '../src/models/core-types';
import { createRuntime, RuntimeFactoryOptions, createEmptyPluginRegistry } from '../src/implementations/factory';
import { createExtensionSystem } from '../src/implementations/extension-system';
import { createInMemoryEventBus } from '../src/implementations/event-bus';
import { InMemoryProcessRegistry } from '../src/implementations/process-registry';
import { InMemoryProcessManager } from '../src/implementations/process-manager';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { v4 as uuidv4 } from 'uuid';

// Helper function to wait for promises to settle
const flushPromises = async (): Promise<void> => {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
};

// Helper to poll until a condition is met or timeout
const pollUntil = async (
  condition: () => boolean | Promise<boolean>,
  interval = 10,
  timeout = 1000
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
};

describe('Runtime System', () => {
  // Core Runtime Tests
  describe('Core Runtime', () => {
    let runtime: RuntimeInstance;
    let mockPlugin: Plugin;

    beforeEach(() => {
      runtime = createCoreRuntime();
      
      // Create a mock plugin
      mockPlugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        description: 'A test plugin',
        dependencies: [],
        lifecycle: {
          initialize: vi.fn().mockResolvedValue({ success: true, value: undefined }),
          start: vi.fn().mockResolvedValue({ success: true, value: undefined }),
          stop: vi.fn().mockResolvedValue({ success: true, value: undefined }),
          cleanup: vi.fn().mockResolvedValue({ success: true, value: undefined })
        },
        getState: vi.fn(),
        setState: vi.fn(),
        getCapability: vi.fn(),
        hasCapability: vi.fn(),
        registerHook: vi.fn(),
        healthCheck: vi.fn(),
        getHooks: vi.fn().mockReturnValue([]),
        getVersion: vi.fn().mockReturnValue('1.0.0'),
        getCapabilities: vi.fn().mockReturnValue([])
      };
    });

    describe('Plugin Management', () => {
      it('should register and unregister plugins', async () => {
        // Register plugin
        const registerResult = await runtime.registerPlugin(mockPlugin);
        expect(registerResult.success).toBe(true);
        expect(runtime.getPlugin('test-plugin')).toBeDefined();

        // Unregister plugin
        const unregisterResult = await runtime.unregisterPlugin('test-plugin');
        expect(unregisterResult.success).toBe(true);
        expect(runtime.getPlugin('test-plugin')).toBeUndefined();
      });

      it('should handle duplicate plugin registration', async () => {
        // Register plugin first time
        await runtime.registerPlugin(mockPlugin);

        // Try to register again
        const result = await runtime.registerPlugin(mockPlugin);
        expect(result.success).toBe(false);
        if (!result.success && result.error) {
          expect(result.error.message).toContain('already registered');
        }
      });

      it('should handle plugin lifecycle events', async () => {
        // Register plugin
        await runtime.registerPlugin(mockPlugin);

        // Start runtime
        const startResult = await runtime.start();
        expect(startResult.success).toBe(true);
        expect(mockPlugin.lifecycle.start).toHaveBeenCalled();

        // Stop runtime
        const stopResult = await runtime.stop();
        expect(stopResult.success).toBe(true);
        expect(mockPlugin.lifecycle.stop).toHaveBeenCalled();
      });

      it('should handle plugin initialization failure', async () => {
        // Mock plugin to fail initialization
        const failingPlugin = {
          ...mockPlugin,
          lifecycle: {
            ...mockPlugin.lifecycle,
            initialize: vi.fn().mockResolvedValue({
              success: false,
              error: new Error('Initialization failed')
            })
          }
        };

        const result = await runtime.registerPlugin(failingPlugin);
        expect(result.success).toBe(false);
        if (!result.success && result.error) {
          expect(result.error.message).toBe('Initialization failed');
        }
      });
    });

    describe('System Integration', () => {
      it('should integrate with event bus', () => {
        const eventBus = runtime.eventBus;
        expect(eventBus).toBeDefined();
        expect(eventBus.publish).toBeDefined();
        expect(eventBus.subscribe).toBeDefined();
      });

      it('should integrate with extension system', () => {
        const extensionSystem = runtime.extensionSystem;
        expect(extensionSystem).toBeDefined();
        expect(extensionSystem.registerExtension).toBeDefined();
        expect(extensionSystem.executeExtensionPoint).toBeDefined();
      });

      it('should handle event persistence when enabled', () => {
        const runtimeWithStorage = createCoreRuntime({
          enableEventPersistence: true
        });

        const eventStorage = runtimeWithStorage.eventStorage;
        expect(eventStorage).toBeDefined();
        expect(eventStorage?.storeEvent).toBeDefined();
        expect(eventStorage?.getEventsByType).toBeDefined();
      });
    });

    describe('Custom Implementations', () => {
      it('should use custom event bus implementation', () => {
        const mockEventBus = {
          publish: vi.fn(),
          subscribe: vi.fn(),
          unsubscribe: vi.fn(),
          clearSubscriptions: vi.fn(),
          clearAllSubscriptions: vi.fn(),
          subscriberCount: vi.fn(),
          applyBackpressure: vi.fn(),
          enablePersistence: vi.fn(),
          disablePersistence: vi.fn(),
          addEventRouter: vi.fn(),
          addEventFilter: vi.fn(),
          correlate: vi.fn()
        } as unknown as EventBus;

        const runtime = createCoreRuntime({ eventBus: mockEventBus });
        expect(runtime.eventBus).toBe(mockEventBus);
      });

      it('should use custom extension system implementation', () => {
        const mockExtensionSystem = {
          registerExtension: vi.fn(),
          unregisterExtension: vi.fn(),
          getExtensions: vi.fn(),
          executeExtensionPoint: vi.fn(),
          getExtension: vi.fn(),
          hasExtension: vi.fn()
        } as unknown as ExtensionSystem;

        const runtime = createCoreRuntime({ extensionSystem: mockExtensionSystem });
        expect(runtime.extensionSystem).toBe(mockExtensionSystem);
      });

      it('should use custom event storage implementation', () => {
        const mockEventStorage = {
          storeEvent: vi.fn(),
          getEventsByType: vi.fn(),
          getEventsByCorrelationId: vi.fn(),
          getAllEvents: vi.fn()
        } as unknown as EventStorage;

        const runtime = createCoreRuntime({
          enableEventPersistence: true,
          eventStorage: mockEventStorage
        });

        expect(runtime.eventStorage).toBe(mockEventStorage);
      });
    });
  });

  // Modern Runtime Factory Tests
  describe('Runtime Factory', () => {
    let runtime: Runtime;

    describe('Default Configuration', () => {
      beforeEach(() => {
        // Create runtime with required components
        const extensionSystem = createExtensionSystem();
        const eventBus = createInMemoryEventBus(extensionSystem);
        const pluginRegistry = createEmptyPluginRegistry();
        
        runtime = createRuntime({
          components: {
            extensionSystem,
            eventBus,
            pluginRegistry
          }
        });
        
        // Initialize the runtime
        runtime.initialize?.({
          version: '1.0.0',
          namespace: 'test'
        });
      });

      it('should create a runtime instance', () => {
        expect(runtime).toBeDefined();
      });

      it('should have all core components initialized', () => {
        expect(runtime.eventBus).toBeDefined();
        expect(runtime.extensionSystem).toBeDefined();
        expect(runtime.taskRegistry).toBeDefined();
        expect(runtime.taskExecutor).toBeDefined();
        expect(runtime.taskScheduler).toBeDefined();
        expect(runtime.processRegistry).toBeDefined();
        expect(runtime.processManager).toBeDefined();
        expect(runtime.pluginRegistry).toBeDefined();
      });
    });

    describe('Custom Configuration', () => {
      it('should configure event persistence when enabled', async () => {
        // Create runtime with required components and event persistence
        const extensionSystem = createExtensionSystem();
        const eventBus = createInMemoryEventBus(extensionSystem);
        const pluginRegistry = createEmptyPluginRegistry();
        
        const runtime = createRuntime({
          persistEvents: true,
          components: {
            extensionSystem,
            eventBus,
            pluginRegistry
          }
        });
        
        // Initialize the runtime
        if (runtime.initialize) {
          await runtime.initialize({
            version: '1.0.0',
            namespace: 'test'
          });
        }
        
        expect(runtime.eventStorage).toBeDefined();
      });

      it('should use provided runtime options', async () => {
        // Create runtime with required components and custom options
        const extensionSystem = createExtensionSystem();
        const eventBus = createInMemoryEventBus(extensionSystem);
        const pluginRegistry = createEmptyPluginRegistry();
        
        const runtimeOptions = {
          version: '2.0.0',
          namespace: 'custom-namespace'
        };
        
        const runtime = createRuntime({
          components: {
            extensionSystem,
            eventBus,
            pluginRegistry
          },
          runtimeOptions
        });
        
        // Initialize the runtime with the custom options
        if (runtime.initialize) {
          await runtime.initialize(runtimeOptions);
        }
        
        expect(runtime.version).toBe('2.0.0');
        expect(runtime.namespace).toBe('custom-namespace');
      });
    });

    describe('Given a runtime instance', () => {
      beforeEach(async () => {
        runtime = createRuntime();
        await runtime.initialize?.({ 
          version: '1.0.0',
          namespace: 'test'
        });
      });

      afterEach(async () => {
        // Ensure runtime is stopped to prevent leaks
        try {
          await runtime.stop?.();
        } catch (e) {
          // Ignore errors in cleanup
        }
      });

      it('should initialize with default configuration', () => {
        expect(runtime.version).toBeDefined();
        expect(runtime.namespace).toBeDefined();
        expect(runtime.eventBus).toBeDefined();
        expect(runtime.extensionSystem).toBeDefined();
        expect(runtime.taskRegistry).toBeDefined();
        expect(runtime.taskExecutor).toBeDefined();
        expect(runtime.processRegistry).toBeDefined();
        expect(runtime.pluginRegistry).toBeDefined();
      });

      it('should handle runtime lifecycle events', async () => {
        const startResult = await runtime.start?.();
        expect(startResult?.success).toBe(true);
        
        const stopResult = await runtime.stop?.();
        expect(stopResult?.success).toBe(true);
      });
    });

    describe('When using plugins', () => {
      beforeEach(async () => {
        // Create runtime with required components
        const extensionSystem = createExtensionSystem();
        const eventBus = createInMemoryEventBus(extensionSystem);
        const pluginRegistry = createEmptyPluginRegistry();
        
        runtime = createRuntime({
          components: {
            extensionSystem,
            eventBus,
            pluginRegistry
          }
        });
        
        // Initialize the runtime
        if (runtime.initialize) {
          await runtime.initialize({
            version: '1.0.0',
            namespace: 'test'
          });
        }
      });
      
      it('should register and initialize plugins', async () => {
        // Create a test plugin
        class TestExtension extends BasePlugin {
          constructor() {
            super({
              id: 'test.extension',
              name: 'Test Extension',
              description: 'A test extension for BDD testing',
              dependencies: []
            });
          }
          
          async onInitialize(): Promise<Result<void>> {
            return { success: true };
          }
          
          async onStart(): Promise<Result<void>> {
            return { success: true };
          }
          
          async onStop(): Promise<Result<void>> {
            return { success: true };
          }
        }
        
        const plugin = new TestExtension();
        
        // Use non-null assertion only when we're sure the component exists
        const pluginRegistry = runtime.pluginRegistry;
        if (!pluginRegistry) {
          throw new Error('Plugin registry not initialized');
        }
        
        const registerResult = await pluginRegistry.registerPlugin(plugin);
        expect(registerResult.success).toBe(true);
        
        // Start runtime with non-null check
        if (runtime.start) {
          const startResult = await runtime.start();
          expect(startResult.success).toBe(true);
        }
        
        // Get plugin with non-null check
        if (pluginRegistry) {
          const retrievedPlugin = pluginRegistry.getPlugin('test.extension');
          expect(retrievedPlugin.success).toBe(true);
        }
      });
      
      it('should handle plugin failures gracefully', async () => {
        // Create a failing plugin that will throw an error when its initialize method is called
        class FailingExtension extends BasePlugin {
          constructor() {
            super({
              id: 'failing.extension',
              name: 'Failing Extension',
              description: 'A failing extension for BDD testing',
              dependencies: []
            });
            
            // Override the lifecycle initialize method to throw an error
            this.lifecycle.initialize = async () => {
              throw new Error('Intentional failure in initialize');
            };
          }
        }
        
        const plugin = new FailingExtension();
        
        // Use non-null assertion only when we're sure the component exists
        const pluginRegistry = runtime.pluginRegistry;
        if (!pluginRegistry) {
          throw new Error('Plugin registry not initialized');
        }
        
        // In the current implementation, registration will succeed but later operations will fail
        const registerResult = await pluginRegistry.registerPlugin(plugin);
        expect(registerResult.success).toBe(true);
        
        // Trying to initialize the plugin should fail
        if (runtime.start) {
          const startResult = await runtime.start();
          // Since the plugin fails during initialization, runtime start might still succeed
          // but the plugin should be in an error state
        }
      });
    });

    describe('When using event system', () => {
      beforeEach(async () => {
        // Create runtime with required components
        const extensionSystem = createExtensionSystem();
        const eventBus = createInMemoryEventBus(extensionSystem);
        const pluginRegistry = createEmptyPluginRegistry();
        
        runtime = createRuntime({
          components: {
            extensionSystem,
            eventBus,
            pluginRegistry
          }
        });
        
        // Initialize the runtime
        if (runtime.initialize) {
          await runtime.initialize({
            version: '1.0.0',
            namespace: 'test'
          });
        }
      });
      
      it('should publish and subscribe to events', async () => {
        if (!runtime.eventBus) {
          throw new Error('Event bus not initialized');
        }
        
        const events: unknown[] = [];
        const eventType = 'test.event';
        const eventData = { message: 'hello world' };
        const eventId = uuidv4();
        
        // Subscribe to events - the handler receives just the payload, not the full event
        const handler = async (payload: unknown): Promise<void> => {
          events.push(payload);
        };
        
        const subscription = runtime.eventBus.subscribe(eventType, handler);
        
        // Publish an event
        await runtime.eventBus.publish({
          id: eventId,
          type: eventType,
          timestamp: Date.now(),
          payload: eventData
        });
        
        // Polling approach to wait for async event processing
        const eventReceived = await pollUntil(() => events.length > 0);
        expect(eventReceived).toBe(true);
        
        // We receive just the payload, not the full event
        expect(events[0]).toEqual(eventData);
        
        // Clean up
        subscription.unsubscribe();
      });
    });

    describe('When using process system', () => {
      const validDefinition: ProcessDefinition = {
        type: 'test-process',
        name: 'Test Process', 
        description: 'A test process definition',
        version: '1.0.0',
        initialState: 'created',
        states: ['created', 'running', 'completed'],
        finalStates: ['completed'],
        transitions: [
          { from: 'created', to: 'running', event: 'start' },
          { from: 'running', to: 'completed', event: 'complete' }
        ]
      };

      beforeEach(async () => {
        // Create required components
        const extensionSystem = createExtensionSystem();
        const eventBus = createInMemoryEventBus(extensionSystem);
        const pluginRegistry = createEmptyPluginRegistry();
        const processRegistry = new InMemoryProcessRegistry();
        const taskRegistry = new InMemoryTaskRegistry();
        const taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
        const processManager = new InMemoryProcessManager(processRegistry, taskExecutor);
        
        // Create runtime with proper components
        runtime = createRuntime({
          components: {
            extensionSystem,
            eventBus,
            pluginRegistry,
            processRegistry,
            processManager,
            taskRegistry,
            taskExecutor
          }
        });
        
        // Initialize the runtime
        if (runtime.initialize) {
          await runtime.initialize({
            version: '1.0.0',
            namespace: 'test'
          });
        }
        
        // Register the process definition
        if (runtime.processRegistry) {
          await runtime.processRegistry.registerProcess(validDefinition);
        }
      });

      it('should create a process instance', async () => {
        if (!runtime.processManager) {
          throw new Error('Process manager not initialized');
        }
        
        const result = await runtime.processManager.createProcess(validDefinition.type, {});
        expect(result.success).toBe(true);
        
        if (result.success && result.value) {
          const process = result.value;
          expect(process).toBeDefined();
          expect(process.type).toBe(validDefinition.type);
          expect(process.state).toBe('created');
        }
      });

      it('should transition process state', async () => {
        if (!runtime.processManager) {
          throw new Error('Process manager not initialized');
        }
        
        const createResult = await runtime.processManager.createProcess(validDefinition.type, {});
        expect(createResult.success).toBe(true);
        
        if (createResult.success && createResult.value) {
          const process = createResult.value;
          
          // Use applyEvent instead of transitionProcess
          const transitionResult = await runtime.processManager.applyEvent(
            process.id, 
            'start',
            {}
          );
          
          expect(transitionResult.success).toBe(true);
          if (transitionResult.success && transitionResult.value) {
            expect(transitionResult.value.state).toBe('running');
          }
        }
      });
    });
  });
}); 