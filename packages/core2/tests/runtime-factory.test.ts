import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { createModernRuntime, ModernRuntimeOptions } from '../src/implementations/modern-factory.js';

describe('Modern Runtime Factory', () => {
  let runtime: Runtime;

  describe('Default Configuration', () => {
    beforeEach(() => {
      runtime = createModernRuntime();
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

    it('should not have event persistence by default', () => {
      expect(runtime.eventStorage).toBeUndefined();
      expect(runtime.eventSource).toBeUndefined();
    });
  });

  describe('With Event Persistence', () => {
    beforeEach(() => {
      runtime = createModernRuntime({
        persistEvents: true
      });
    });

    it('should have event persistence components initialized', () => {
      expect(runtime.eventStorage).toBeDefined();
      expect(runtime.eventSource).toBeDefined();
    });
  });

  describe('With Custom Runtime Options', () => {
    const customOptions: ModernRuntimeOptions = {
      runtimeOptions: {
        version: '2.0.0',
        namespace: 'test-namespace'
      }
    };

    beforeEach(() => {
      runtime = createModernRuntime(customOptions);
    });

    it('should apply custom version and namespace', () => {
      expect(runtime.version).toBe('2.0.0');
      expect(runtime.namespace).toBe('test-namespace');
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      runtime = createModernRuntime();
    });

    it('should be in initializing state after creation', async () => {
      const healthResult = await runtime.getHealth();
      expect(healthResult.success).toBe(true);
      if (healthResult.success) {
        expect(healthResult.value.status).toBe('degraded');
      }
    });

    it('should transition to running state after start', async () => {
      await runtime.initialize({
        version: '1.0.0',
        namespace: 'test'
      });
      
      await runtime.start();
      
      const healthResult = await runtime.getHealth();
      expect(healthResult.success).toBe(true);
      if (healthResult.success) {
        expect(healthResult.value.status).toBe('healthy');
      }
    });
  });
}); 