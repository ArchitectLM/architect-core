import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BasePlugin } from '../src/models/plugin-system';
import { ExtensionPointNames } from '../src/models/extension-system';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { Runtime } from '../src/models/runtime';

interface TestCapability {
  test: () => string;
}

interface ExtendedTaskParams {
  taskId: string;
  taskType: string;
  input: unknown;
  processed?: boolean;
  processed1?: boolean;
  processed2?: boolean;
}

// Debug function to help track what's happening
const debugLog = (message: string, ...args: any[]) => {
  if (process.env.DEBUG === 'true') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

describe('Plugin System', () => {
  let runtime: Runtime;

  beforeEach(async () => {
    runtime = createModernRuntime();
    // Initialize runtime before tests to ensure extension system is ready
    await runtime.initialize({ version: '1.0.0', namespace: 'test' });
    await runtime.start();
  });

  describe('Plugin Lifecycle', () => {
    class TestPlugin extends BasePlugin {
      constructor() {
        super({
          id: 'test-plugin',
          name: 'Test Plugin',
          description: 'A test plugin'
        });
      }
    }

    it('should initialize plugin with default state', () => {
      const plugin = new TestPlugin();
      const state = plugin.getState();
      
      expect(state.id).toBe('test-plugin');
      expect(state.config).toEqual({});
      expect(state.data).toEqual({});
      expect(state.status.enabled).toBe(false);
    });

    it('should handle plugin initialization with config', async () => {
      const plugin = new TestPlugin();
      const config = { test: 'value' };
      
      const result = await plugin.lifecycle.initialize(config);
      expect(result.success).toBe(true);
      
      const state = plugin.getState();
      expect(state.config.test).toBe('value');
    });

    it('should handle plugin start and stop', async () => {
      const plugin = new TestPlugin();
      
      const startResult = await plugin.lifecycle.start();
      expect(startResult.success).toBe(true);
      expect(plugin.getState().status.enabled).toBe(true);
      
      const stopResult = await plugin.lifecycle.stop();
      expect(stopResult.success).toBe(true);
      expect(plugin.getState().status.enabled).toBe(false);
    });

    it('should handle plugin cleanup', async () => {
      const plugin = new TestPlugin();
      const cleanupResult = await plugin.lifecycle.cleanup();
      expect(cleanupResult.success).toBe(true);
    });
  });

  describe('Plugin Capabilities', () => {
    class CapablePlugin extends BasePlugin {
      constructor() {
        super({
          id: 'capable-plugin',
          name: 'Capable Plugin',
          description: 'A plugin with capabilities'
        });
        
        this.registerCapability<TestCapability>({
          id: 'test-capability',
          name: 'Test Capability',
          description: 'A test capability',
          implementation: {
            test: () => 'test'
          }
        });
      }

      testDuplicateCapability() {
        return this.registerCapability<TestCapability>({
          id: 'test-capability',
          name: 'Test Capability',
          description: 'A duplicate capability',
          implementation: {
            test: () => 'duplicate'
          }
        });
      }
    }

    it('should register and retrieve capabilities', () => {
      const plugin = new CapablePlugin();
      
      expect(plugin.hasCapability('test-capability')).toBe(true);
      
      const capability = plugin.getCapability<TestCapability>('test-capability');
      expect(capability.success).toBe(true);
      if (capability.success) {
        expect(capability.value.implementation.test()).toBe('test');
      }
    });

    it('should handle non-existent capabilities', () => {
      const plugin = new CapablePlugin();
      
      expect(plugin.hasCapability('non-existent')).toBe(false);
      
      const capability = plugin.getCapability('non-existent');
      expect(capability.success).toBe(false);
      if (!capability.success) {
        expect(capability.error.message).toBe('Capability non-existent not found');
      }
    });

    it('should prevent duplicate capability registration', () => {
      const plugin = new CapablePlugin();
      
      const result = plugin.testDuplicateCapability();
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Capability test-capability is already registered');
      }
    });
  });

  describe('Plugin Extension Points', () => {
    class HookPlugin extends BasePlugin {
      constructor() {
        super({
          id: 'hook-plugin',
          name: 'Hook Plugin',
          description: 'A plugin with hooks'
        });
        
        this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
          debugLog('Hook executed in HookPlugin', params);
          const processedParams = { 
            ...params, 
            processed: true 
          } as ExtendedTaskParams;
          
          return { 
            success: true, 
            value: processedParams
          };
        });
      }
    }

    it('should register and execute hooks', async () => {
      const plugin = new HookPlugin();
      const registerResult = await runtime.pluginRegistry.registerPlugin(plugin);
      expect(registerResult.success).toBe(true);
      
      // Check if extension is registered properly
      const extensionSystem = runtime.extensionSystem;
      const exts = extensionSystem.getExtensions();
      debugLog('Registered extensions:', exts);
      
      const result = await runtime.extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      debugLog('Extension point execution result:', result);
      
      expect(result.success).toBe(true);
      if (result.success) {
        const params = result.value as ExtendedTaskParams;
        expect(params.processed).toBe(true);
      }
    });

    it('should handle multiple hooks in order', async () => {
      class HookPlugin1 extends BasePlugin {
        constructor() {
          super({
            id: 'hook-plugin-1',
            name: 'Hook Plugin 1',
            description: 'First hook plugin'
          });
          
          this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
            debugLog('Hook executed in HookPlugin1', params);
            const processedParams = { 
              ...params, 
              processed1: true 
            } as ExtendedTaskParams;
            
            return { 
              success: true, 
              value: processedParams
            };
          });
        }
      }

      class HookPlugin2 extends BasePlugin {
        constructor() {
          super({
            id: 'hook-plugin-2',
            name: 'Hook Plugin 2',
            description: 'Second hook plugin',
            dependencies: ['hook-plugin-1'] // Ensure order by setting dependency
          });
          
          this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
            debugLog('Hook executed in HookPlugin2', params);
            const processedParams = { 
              ...params, 
              processed2: true 
            } as ExtendedTaskParams;
            
            return { 
              success: true, 
              value: processedParams
            };
          });
        }
      }

      const plugin1 = new HookPlugin1();
      const plugin2 = new HookPlugin2();
      
      await runtime.pluginRegistry.registerPlugin(plugin1);
      await runtime.pluginRegistry.registerPlugin(plugin2);
      
      // Manually register plugins with extension system to ensure they're available
      await runtime.extensionSystem.registerExtension(plugin1);
      await runtime.extensionSystem.registerExtension(plugin2);
      
      // Verify extensions are registered
      const extensions = runtime.extensionSystem.getExtensions();
      debugLog('Registered extensions for multiple hooks test:', extensions);
      
      const result = await runtime.extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      debugLog('Multiple hooks execution result:', result);
      
      expect(result.success).toBe(true);
      if (result.success) {
        const params = result.value as ExtendedTaskParams;
        expect(params.processed1).toBe(true);
        expect(params.processed2).toBe(true);
      }
    });
  });

  describe('Plugin Health', () => {
    class HealthyPlugin extends BasePlugin {
      constructor() {
        super({
          id: 'healthy-plugin',
          name: 'Healthy Plugin',
          description: 'A healthy plugin'
        });
      }
    }

    class UnhealthyPlugin extends BasePlugin {
      constructor() {
        super({
          id: 'unhealthy-plugin',
          name: 'Unhealthy Plugin',
          description: 'An unhealthy plugin'
        });
        
        this.setState({
          status: {
            enabled: true,
            lastError: new Error('Test error')
          }
        });
      }
    }

    it('should report healthy status', () => {
      const plugin = new HealthyPlugin();
      const health = plugin.healthCheck();
      
      expect(health.success).toBe(true);
      if (health.success) {
        expect(health.value.status).toBe('healthy');
        expect(health.value.details.enabled).toBe(false);
        expect(health.value.details.lastError).toBeUndefined();
      }
    });

    it('should report unhealthy status', () => {
      const plugin = new UnhealthyPlugin();
      const health = plugin.healthCheck();
      
      expect(health.success).toBe(true);
      if (health.success) {
        expect(health.value.status).toBe('degraded');
        expect(health.value.details.enabled).toBe(true);
        expect(health.value.details.lastError).toBe('Test error');
      }
    });
  });
}); 