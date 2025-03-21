import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime.js';
import { ReactiveRuntime } from '../src/implementations/runtime.js';
import { Extension, ExtensionContext, ExtensionHandler } from '../src/models/index.js';
import { ExtensionSystemImpl } from '../src/implementations/extension-system.js';
import { EventBusImpl } from '../src/implementations/event-bus.js';
import { InMemoryEventStorage } from '../src/implementations/event-storage.js';

describe('Extension System', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new ReactiveRuntime({}, {}, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Extension Registration', () => {
    it('should register a valid extension', async () => {
      const extension: Extension = {
        name: 'test.extension',
        description: 'Test Extension',
        hooks: {
          'test.hook': async (context: ExtensionContext) => {
            return context;
          }
        }
      };

      extensionSystem.registerExtension(extension);
      const registered = extensionSystem.getExtensions();
      expect(registered).toContain(extension);
    });

    it('should handle invalid extension registration', async () => {
      const invalidExtensions: Extension[] = [
        // Missing required fields
        {
          name: 'test.extension',
          description: 'Test Extension',
          hooks: {}
        },
        // Invalid hooks
        {
          name: 'test.extension',
          description: 'Test Extension',
          hooks: {
            'test.hook': (async () => {}) as ExtensionHandler
          }
        }
      ];

      for (const extension of invalidExtensions) {
        expect(() => extensionSystem.registerExtension(extension)).toThrow();
      }
    });
  });

  describe('Extension Lifecycle', () => {
    let hookCalled = false;

    const testExtension: Extension = {
      name: 'test.extension',
      description: 'Test Extension',
      hooks: {
        'test.hook': async (context: ExtensionContext) => {
          hookCalled = true;
          return context;
        }
      }
    };

    beforeEach(() => {
      extensionSystem.registerExtension(testExtension);
    });

    it('should execute extension hooks', async () => {
      const context = { data: 'test' };
      await extensionSystem.executeExtensionPoint('test.hook', context);
      expect(hookCalled).toBe(true);
    });
  });

  describe('Extension Context', () => {
    it('should provide extension context with required services', async () => {
      let context: ExtensionContext | undefined;

      const testExtension: Extension = {
        name: 'test.extension',
        description: 'Test Extension',
        hooks: {
          'test.hook': async (ctx: ExtensionContext) => {
            context = ctx;
            return ctx;
          }
        }
      };

      extensionSystem.registerExtension(testExtension);
      await extensionSystem.executeExtensionPoint('test.hook', {});
      expect(context).toBeDefined();
    });
  });

  describe('Extension Dependencies', () => {
    it('should handle extension dependencies', async () => {
      const dependency: Extension = {
        name: 'dependency.extension',
        description: 'Dependency Extension',
        hooks: {
          'test.hook': async (context: ExtensionContext) => context
        }
      };

      const dependent: Extension = {
        name: 'dependent.extension',
        description: 'Dependent Extension',
        hooks: {
          'test.hook': async (context: ExtensionContext) => context
        }
      };

      extensionSystem.registerExtension(dependency);
      extensionSystem.registerExtension(dependent);

      const registered = extensionSystem.getExtensions();
      expect(registered).toContain(dependency);
      expect(registered).toContain(dependent);
    });
  });

  describe('Extension Discovery', () => {
    it('should discover installed extensions', async () => {
      const extension: Extension = {
        name: 'test.extension',
        description: 'Test Extension',
        hooks: {
          'test.hook': async (context: ExtensionContext) => context
        }
      };

      extensionSystem.registerExtension(extension);
      const extensions = extensionSystem.getExtensions();
      expect(extensions).toContain(extension);
    });

    it('should handle extension point execution', async () => {
      interface TestContext extends ExtensionContext {
        data: string;
        modified?: boolean;
      }

      const extension: Extension = {
        name: 'test.extension',
        description: 'Test Extension',
        hooks: {
          'test.hook': async (context: ExtensionContext) => {
            const testContext = context as TestContext;
            return {
              ...testContext,
              modified: true
            };
          }
        }
      };

      extensionSystem.registerExtension(extension);
      const context: TestContext = { data: 'test' };
      const result = await extensionSystem.executeExtensionPoint('test.hook', context);
      expect(result.modified).toBe(true);
    });
  });
}); 