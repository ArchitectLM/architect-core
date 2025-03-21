import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionSystemImpl } from '../../src/implementations/extension-system.js';
import { Extension, ExtensionPoint, ExtensionContext } from '../../src/models/extension.js';
import { EventBus } from '../../src/models/event.js';

interface TestExtensionContext extends ExtensionContext {
  state?: {
    value?: number | string;
  };
}

describe('Plugin Lifecycle Management', () => {
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn(),
      enablePersistence: vi.fn(),
      disablePersistence: vi.fn(),
      replay: vi.fn(),
      addEventRouter: vi.fn(),
      removeEventRouter: vi.fn(),
      correlate: vi.fn(),
      getEventMetrics: vi.fn()
    } as unknown as EventBus;

    extensionSystem = new ExtensionSystemImpl();
  });

  describe('Plugin Registration', () => {
    it('should register plugins with unique names', () => {
      const plugin1: Extension = {
        name: 'test-plugin-1',
        description: 'First test plugin',
        hooks: {}
      };

      const plugin2: Extension = {
        name: 'test-plugin-2',
        description: 'Second test plugin',
        hooks: {}
      };

      extensionSystem.registerExtension(plugin1);
      extensionSystem.registerExtension(plugin2);

      const extensions = extensionSystem.getExtensions();
      expect(extensions).toContain('test-plugin-1');
      expect(extensions).toContain('test-plugin-2');
    });

    it('should prevent duplicate plugin registration', () => {
      const plugin: Extension = {
        name: 'test-plugin',
        description: 'Test plugin',
        hooks: {}
      };

      extensionSystem.registerExtension(plugin);
      
      expect(() => {
        extensionSystem.registerExtension(plugin);
      }).toThrow('Plugin with name test-plugin is already registered');
    });
  });

  describe('Plugin Initialization', () => {
    it('should initialize plugins in the correct order', () => {
      const initializationOrder: string[] = [];

      const plugin1: Extension = {
        name: 'plugin-1',
        description: 'First plugin',
        hooks: {
          'system:init': async (context) => {
            initializationOrder.push('plugin-1');
            return context;
          }
        }
      };

      const plugin2: Extension = {
        name: 'plugin-2',
        description: 'Second plugin',
        hooks: {
          'system:init': async (context) => {
            initializationOrder.push('plugin-2');
            return context;
          }
        }
      };

      extensionSystem.registerExtension(plugin1);
      extensionSystem.registerExtension(plugin2);

      // Execute initialization
      extensionSystem.executeExtensionPoint('system:init', {});

      expect(initializationOrder).toEqual(['plugin-1', 'plugin-2']);
    });

    it('should handle initialization failures gracefully', async () => {
      const plugin: Extension = {
        name: 'failing-plugin',
        description: 'Plugin that fails to initialize',
        hooks: {
          'system:init': async () => {
            throw new Error('Initialization failed');
          }
        }
      };

      extensionSystem.registerExtension(plugin);

      await expect(extensionSystem.executeExtensionPoint('system:init', {}))
        .rejects
        .toThrow('Initialization failed');
    });
  });

  describe('Plugin Dependencies', () => {
    it('should resolve plugin dependencies', () => {
      const plugin1: Extension = {
        name: 'plugin-1',
        description: 'First plugin',
        hooks: {
          'system:init': async (context) => {
            return context;
          }
        }
      };

      const plugin2: Extension = {
        name: 'plugin-2',
        description: 'Second plugin',
        hooks: {
          'system:init': async (context) => {
            return context;
          }
        }
      };

      extensionSystem.registerExtension(plugin1);
      extensionSystem.registerExtension(plugin2);

      const extensions = extensionSystem.getExtensions();
      expect(extensions.indexOf('plugin-1')).toBeLessThan(extensions.indexOf('plugin-2'));
    });

    it('should detect circular dependencies', () => {
      const plugin1: Extension = {
        name: 'plugin-1',
        description: 'First plugin',
        hooks: {
          'system:init': async (context) => {
            return context;
          }
        }
      };

      const plugin2: Extension = {
        name: 'plugin-2',
        description: 'Second plugin',
        hooks: {
          'system:init': async (context) => {
            return context;
          }
        }
      };

      extensionSystem.registerExtension(plugin1);
      
      expect(() => {
        extensionSystem.registerExtension(plugin2);
      }).toThrow('Circular dependency detected');
    });
  });

  describe('Plugin Cleanup', () => {
    it('should clean up plugin resources', async () => {
      const cleanupOrder: string[] = [];

      const plugin: Extension = {
        name: 'test-plugin',
        description: 'Test plugin',
        hooks: {
          'system:cleanup': async (context) => {
            cleanupOrder.push('test-plugin');
            return context;
          }
        }
      };

      extensionSystem.registerExtension(plugin);

      // Execute cleanup
      await extensionSystem.executeExtensionPoint('system:cleanup', {});

      expect(cleanupOrder).toEqual(['test-plugin']);
    });

    it('should handle cleanup failures gracefully', async () => {
      const plugin: Extension = {
        name: 'failing-plugin',
        description: 'Plugin that fails to cleanup',
        hooks: {
          'system:cleanup': async () => {
            throw new Error('Cleanup failed');
          }
        }
      };

      extensionSystem.registerExtension(plugin);

      await expect(extensionSystem.executeExtensionPoint('system:cleanup', {}))
        .rejects
        .toThrow('Cleanup failed');
    });
  });

  describe('Plugin State Management', () => {
    it('should maintain plugin state between hook executions', async () => {
      const plugin: Extension = {
        name: 'stateful-plugin',
        description: 'Plugin with state',
        hooks: {
          'test:hook1': async (context: TestExtensionContext) => {
            context.state = context.state || {};
            context.state.value = (context.state.value as number || 0) + 1;
            return context;
          },
          'test:hook2': async (context: TestExtensionContext) => {
            expect(context.state?.value).toBe(1);
            return context;
          }
        }
      };

      extensionSystem.registerExtension(plugin);

      const context: TestExtensionContext = {};
      await extensionSystem.executeExtensionPoint('test:hook1', context);
      await extensionSystem.executeExtensionPoint('test:hook2', context);
    });

    it('should isolate plugin state', async () => {
      const plugin1: Extension = {
        name: 'plugin-1',
        description: 'First plugin',
        hooks: {
          'test:hook': async (context: TestExtensionContext) => {
            context.state = context.state || {};
            context.state.value = 'plugin-1';
            return context;
          }
        }
      };

      const plugin2: Extension = {
        name: 'plugin-2',
        description: 'Second plugin',
        hooks: {
          'test:hook': async (context: TestExtensionContext) => {
            context.state = context.state || {};
            context.state.value = 'plugin-2';
            return context;
          }
        }
      };

      extensionSystem.registerExtension(plugin1);
      extensionSystem.registerExtension(plugin2);

      const context: TestExtensionContext = {};
      await extensionSystem.executeExtensionPoint('test:hook', context);

      expect(context.state?.value).toBe('plugin-2');
    });
  });
}); 