import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Extension, ExtensionContext, ExtensionHookRegistration, ExtensionPointName, ExtensionPointNames, ExtensionPointParameters, ExtensionSystem, ExtensionSystemImpl, ExtensionHook } from '../src/models/extension-system';
import { Result, Identifier } from '../src/models/core-types';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { Runtime } from '../src/models/runtime';
import { BasePlugin } from '../src/models/plugin-system';

// Define extended task params type
type ExtendedTaskParams = ExtensionPointParameters[typeof ExtensionPointNames.TASK_BEFORE_EXECUTION] & {
  processed?: boolean;
};

// Mock extension for testing
class TestExtension implements Extension {
  id: Identifier;
  name: string;
  description: string;
  dependencies: Identifier[];
  private hooks: ExtensionHookRegistration<ExtensionPointName, unknown>[] = [];
  
  constructor(name: string, dependencies: Identifier[] = []) {
    this.id = name;
    this.name = name;
    this.description = `Test extension ${name}`;
    this.dependencies = dependencies;
  }

  getHooks(): ExtensionHookRegistration<ExtensionPointName, unknown>[] {
    return this.hooks;
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): string[] {
    return ['test'];
  }

  // Helper method to add hooks for testing
  addHook<N extends ExtensionPointName>(
    pointName: N,
    hook: (params: ExtensionPointParameters[N], context: ExtensionContext<unknown>) => Promise<Result<ExtensionPointParameters[N]>>,
    priority: number = 0
  ): void {
    this.hooks.push({
      pointName,
      hook: hook as unknown as ExtensionHook<ExtensionPointName, unknown>,
      priority
    });
  }
}

describe('Extension System', () => {
  let extensionSystem: ExtensionSystemImpl;
  let runtime: Runtime;

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    runtime = createModernRuntime();
  });

  describe('Extension Registration', () => {
    it('should register a valid extension', () => {
      const extension = new TestExtension('test-extension');
      const result = extensionSystem.registerExtension(extension);
      
      expect(result.success).toBe(true);
      expect(extensionSystem.hasExtension('test-extension')).toBe(true);
    });

    it('should reject duplicate extension registration', () => {
      const extension = new TestExtension('test-extension');
      extensionSystem.registerExtension(extension);
      
      const result = extensionSystem.registerExtension(extension);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already registered');
      }
    });

    it('should retrieve registered extension', () => {
      const extension = new TestExtension('test-extension');
      extensionSystem.registerExtension(extension);
      
      const retrieved = extensionSystem.getExtension('test-extension');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-extension');
    });

    it('should return undefined for non-existent extension', () => {
      const retrieved = extensionSystem.getExtension('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Extension Point Execution', () => {
    it('should execute extension point with single hook', async () => {
      const extension = new TestExtension('test-extension');
      extension.addHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
        const extendedParams = { ...params, processed: true } as ExtendedTaskParams;
        return { success: true, value: extendedParams };
      });
      
      extensionSystem.registerExtension(extension);
      
      const result = await extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        const value = result.value as ExtendedTaskParams;
        expect(value.processed).toBe(true);
      }
    });

    it('should execute hooks in priority order', async () => {
      const extension = new TestExtension('test-extension');
      const executionOrder: number[] = [];
      
      // Add hooks with different priorities
      extension.addHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
        executionOrder.push(2);
        return { success: true, value: params };
      }, 2);
      
      extension.addHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
        executionOrder.push(1);
        return { success: true, value: params };
      }, 1);
      
      extension.addHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
        executionOrder.push(3);
        return { success: true, value: params };
      }, 3);
      
      extensionSystem.registerExtension(extension);
      
      await extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      expect(executionOrder).toEqual([3, 2, 1]);
    });

    it('should handle hook execution failure', async () => {
      const extension = new TestExtension('test-extension');
      extension.addHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async () => ({
        success: false,
        error: new Error('Hook execution failed')
      }));
      
      extensionSystem.registerExtension(extension);
      
      const result = await extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Hook execution failed');
      }
    });
  });

  describe('Extension Dependencies', () => {
    it('should handle extension dependencies', async () => {
      const dependency = new TestExtension('dependency-extension');
      const dependent = new TestExtension('dependent-extension', ['dependency-extension']);
      
      // Register dependent first (should fail)
      const result1 = extensionSystem.registerExtension(dependent);
      expect(result1.success).toBe(false);
      if (!result1.success) {
        expect(result1.error.message).toContain('dependencies');
      }
      
      // Register dependency first
      const result2 = extensionSystem.registerExtension(dependency);
      expect(result2.success).toBe(true);
      
      // Now register dependent (should succeed)
      const result3 = extensionSystem.registerExtension(dependent);
      expect(result3.success).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const extension1 = new TestExtension('extension-1', ['extension-2']);
      const extension2 = new TestExtension('extension-2', ['extension-1']);
      
      // Try to register either one (should fail)
      const result = extensionSystem.registerExtension(extension1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('circular');
      }
    });
  });

  describe('Extension Context', () => {
    it('should maintain context between hook executions', async () => {
      const extension = new TestExtension('test-extension');
      const context: ExtensionContext<{ counter: number }> = { state: { counter: 0 } };
      
      extension.addHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params, ctx) => {
        const typedContext = ctx as ExtensionContext<{ counter: number }>;
        typedContext.state.counter++;
        return { success: true, value: params };
      });
      
      extensionSystem.registerExtension(extension);
      
      // Execute hook multiple times
      await extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      await extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      expect(context.state.counter).toBe(2);
    });
  });
}); 