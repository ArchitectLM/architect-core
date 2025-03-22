import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreRuntime, createCoreRuntime } from '../src/runtime/core-runtime';
import { Plugin, BasePlugin } from '../src/models/plugin-system';
import { EventBus } from '../src/models/event-system';
import { ExtensionSystem } from '../src/models/extension-system';
import { EventStorage } from '../src/models/event-system';

describe('CoreRuntime', () => {
  let runtime: CoreRuntime;
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
      if (!result.success) {
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
      if (!result.success) {
        expect(result.error.message).toBe('Initialization failed');
      }
    });
  });

  describe('System Integration', () => {
    it('should integrate with event bus', () => {
      const eventBus = runtime.getEventBus();
      expect(eventBus).toBeDefined();
      expect(eventBus.publish).toBeDefined();
      expect(eventBus.subscribe).toBeDefined();
    });

    it('should integrate with extension system', () => {
      const extensionSystem = runtime.getExtensionSystem();
      expect(extensionSystem).toBeDefined();
      expect(extensionSystem.registerExtension).toBeDefined();
      expect(extensionSystem.executeExtensionPoint).toBeDefined();
    });

    it('should handle event persistence when enabled', () => {
      const runtimeWithStorage = createCoreRuntime({
        enableEventPersistence: true
      });

      const eventStorage = runtimeWithStorage.getEventStorage();
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
      expect(runtime.getEventBus()).toBe(mockEventBus);
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
      expect(runtime.getExtensionSystem()).toBe(mockExtensionSystem);
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

      expect(runtime.getEventStorage()).toBe(mockEventStorage);
    });
  });
}); 