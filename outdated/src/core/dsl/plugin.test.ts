import { describe, it, expect, vi, beforeEach } from 'vitest';
import { definePlugin, PluginManager } from './plugin';
import { ReactiveSystemBuilder } from './reactive-system';

describe('Enhanced Plugin System', () => {
  let pluginManager: PluginManager;
  let runtime: any;

  beforeEach(() => {
    // Mock runtime object
    runtime = {
      registerHook: vi.fn(),
      registerService: vi.fn(),
      getTaskRegistry: vi.fn().mockReturnValue({}),
      getProcessRegistry: vi.fn().mockReturnValue({})
    };
    
    pluginManager = new PluginManager(runtime);
  });

  describe('Plugin Definition', () => {
    it('should create a plugin with basic properties', () => {
      const plugin = definePlugin({
        id: 'test-plugin',
        name: 'Test Plugin',
        description: 'A test plugin'
      });

      expect(plugin.id).toBe('test-plugin');
      expect(plugin.name).toBe('Test Plugin');
      expect(plugin.description).toBe('A test plugin');
    });

    it('should support hooks in plugin definition', () => {
      const beforeTaskFn = vi.fn();
      const afterProcessFn = vi.fn();

      const plugin = definePlugin({
        id: 'hook-plugin',
        name: 'Hook Plugin',
        hooks: {
          beforeTaskExecution: beforeTaskFn,
          afterProcessTransition: afterProcessFn
        }
      });

      expect(plugin.hooks).toBeDefined();
      expect(plugin.hooks.beforeTaskExecution).toBe(beforeTaskFn);
      expect(plugin.hooks.afterProcessTransition).toBe(afterProcessFn);
    });

    it('should support custom services in plugin definition', () => {
      const doSomethingFn = vi.fn();

      const plugin = definePlugin({
        id: 'service-plugin',
        name: 'Service Plugin',
        services: {
          myCustomService: {
            operations: {
              doSomething: doSomethingFn
            }
          }
        }
      });

      expect(plugin.services).toBeDefined();
      expect(plugin.services.myCustomService).toBeDefined();
      expect(plugin.services.myCustomService.operations.doSomething).toBe(doSomethingFn);
    });

    it('should support initialization function', () => {
      const initFn = vi.fn();

      const plugin = definePlugin({
        id: 'init-plugin',
        name: 'Init Plugin',
        initialize: initFn
      });

      expect(plugin.initialize).toBe(initFn);
    });
  });

  describe('Plugin Registration and Initialization', () => {
    it('should register plugin hooks with the runtime', () => {
      const beforeTaskFn = vi.fn();
      const afterProcessFn = vi.fn();

      const plugin = definePlugin({
        id: 'hook-plugin',
        name: 'Hook Plugin',
        hooks: {
          beforeTaskExecution: beforeTaskFn,
          afterProcessTransition: afterProcessFn
        }
      });

      pluginManager.registerPlugin(plugin);

      expect(runtime.registerHook).toHaveBeenCalledWith('beforeTaskExecution', beforeTaskFn);
      expect(runtime.registerHook).toHaveBeenCalledWith('afterProcessTransition', afterProcessFn);
    });

    it('should register plugin services with the runtime', () => {
      const doSomethingFn = vi.fn();

      const plugin = definePlugin({
        id: 'service-plugin',
        name: 'Service Plugin',
        services: {
          myCustomService: {
            operations: {
              doSomething: doSomethingFn
            }
          }
        }
      });

      pluginManager.registerPlugin(plugin);

      expect(runtime.registerService).toHaveBeenCalledWith('myCustomService', {
        operations: {
          doSomething: doSomethingFn
        }
      });
    });

    it('should call plugin initialize function with runtime', () => {
      const initFn = vi.fn();

      const plugin = definePlugin({
        id: 'init-plugin',
        name: 'Init Plugin',
        initialize: initFn
      });

      pluginManager.registerPlugin(plugin);

      expect(initFn).toHaveBeenCalledWith(runtime);
    });
  });

  describe('Plugin Integration with System', () => {
    it('should allow system to use plugins', () => {
      const system = new ReactiveSystemBuilder();
      const usePluginSpy = vi.spyOn(system, 'withPlugin');
      
      const plugin = definePlugin({
        id: 'test-plugin',
        name: 'Test Plugin'
      });

      system.withPlugin(plugin);
      
      expect(usePluginSpy).toHaveBeenCalledWith(plugin);
    });
  });
}); 