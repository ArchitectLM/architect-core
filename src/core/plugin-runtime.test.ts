import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPluginRuntime, PluginRuntime } from './plugin-runtime';
import { definePlugin } from './dsl/plugin';

describe('Plugin Runtime', () => {
  let mockSystem: any;

  beforeEach(() => {
    mockSystem = {
      id: 'test-system',
      tasks: {
        'task1': { id: 'task1', name: 'Task 1', implementation: vi.fn() },
        'task2': { id: 'task2', name: 'Task 2', implementation: vi.fn() }
      },
      processes: {
        'process1': { 
          id: 'process1', 
          name: 'Process 1',
          states: [{ name: 'initial' }, { name: 'completed' }],
          transitions: [{ from: 'initial', to: 'completed', on: 'COMPLETE' }]
        },
        'process2': { 
          id: 'process2', 
          name: 'Process 2',
          states: [{ name: 'initial' }, { name: 'completed' }],
          transitions: [{ from: 'initial', to: 'completed', on: 'COMPLETE' }]
        }
      }
    };
  });

  describe('Plugin Integration', () => {
    it('should create a runtime with plugin support', () => {
      const runtime = createPluginRuntime(mockSystem);
      expect(runtime).toBeInstanceOf(PluginRuntime);
      expect(runtime.registerHook).toBeDefined();
      expect(runtime.triggerHook).toBeDefined();
      expect(runtime.registerService).toBeDefined();
      expect(runtime.registerPlugin).toBeDefined();
      expect(runtime.shutdown).toBeDefined();
    });

    it('should register and trigger hooks', async () => {
      const runtime = createPluginRuntime(mockSystem);
      const hookFn = vi.fn();
      
      runtime.registerHook('testHook', hookFn);
      await runtime.triggerHook('testHook', 'arg1', 'arg2');
      
      expect(hookFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should register plugins with hooks', async () => {
      const startupHook = vi.fn();
      const plugin = definePlugin({
        id: 'startup-plugin',
        name: 'Startup Plugin',
        hooks: {
          onSystemStartup: startupHook
        }
      });

      const runtime = createPluginRuntime(mockSystem, undefined, [plugin]);
      
      // The onSystemStartup hook should have been called during initialization
      expect(startupHook).toHaveBeenCalled();
    });

    it('should register services from plugins', () => {
      const doSomethingFn = vi.fn().mockReturnValue('plugin result');
      const plugin = definePlugin({
        id: 'service-plugin',
        name: 'Service Plugin',
        services: {
          pluginService: {
            operations: {
              doSomething: doSomethingFn
            }
          }
        }
      });

      const runtime = createPluginRuntime(mockSystem, undefined, [plugin]);
      
      // The service should be registered and accessible
      expect(() => runtime.getService('pluginService')).not.toThrow();
      expect(runtime.getService<any>('pluginService').operations.doSomething()).toBe('plugin result');
    });

    it('should call plugin initialize function', () => {
      const initFn = vi.fn();
      const plugin = definePlugin({
        id: 'init-plugin',
        name: 'Init Plugin',
        initialize: initFn
      });

      const runtime = createPluginRuntime(mockSystem, undefined, [plugin]);
      
      expect(initFn).toHaveBeenCalled();
    });

    it('should trigger shutdown hook', async () => {
      const shutdownHook = vi.fn();
      const plugin = definePlugin({
        id: 'shutdown-plugin',
        name: 'Shutdown Plugin',
        hooks: {
          onSystemShutdown: shutdownHook
        }
      });

      const runtime = createPluginRuntime(mockSystem, undefined, [plugin]);
      
      await runtime.shutdown();
      expect(shutdownHook).toHaveBeenCalled();
    });
  });
}); 