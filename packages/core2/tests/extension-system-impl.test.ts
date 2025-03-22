import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { InMemoryExtensionSystem } from '../src/implementations/extension-system';
import { 
  Extension, 
  ExtensionHook, 
  ExtensionPointName,
  ExtensionPointNames
} from '../src/models/extension-system';
import { Result } from '../src/models/core-types';

// Test extension factory
function createTestExtension(
  name: string, 
  description: string, 
  dependencies: string[] = [],
  hooks: Partial<Record<ExtensionPointName, ExtensionHook<any, any>>> = {}
): Extension {
  const id = `test.extension.${name}`;
  
  return {
    id,
    name,
    description,
    dependencies,
    
    getHooks() {
      return Object.entries(hooks).map(([pointName, hook]) => ({
        pointName: pointName as ExtensionPointName,
        hook: hook as ExtensionHook<any, any>,
        priority: 0
      }));
    },
    
    getVersion() {
      return '1.0.0';
    },
    
    getCapabilities() {
      return [];
    }
  };
}

describe('InMemoryExtensionSystem', () => {
  let extensionSystem: InMemoryExtensionSystem;

  beforeEach(() => {
    extensionSystem = new InMemoryExtensionSystem();
  });

  describe('Given an extension system with no extensions', () => {
    it('should return an empty array of extensions', () => {
      expect(extensionSystem.getExtensions()).toEqual([]);
    });

    it('should return undefined when getting a non-existent extension', () => {
      expect(extensionSystem.getExtension('non-existent')).toBeUndefined();
    });

    it('should return false when checking if a non-existent extension exists', () => {
      expect(extensionSystem.hasExtension('non-existent')).toBe(false);
    });
  });

  describe('Given an extension system with a registered extension', () => {
    let extension: Extension;

    beforeEach(() => {
      extension = createTestExtension('test1', 'Test Extension 1');
      const result = extensionSystem.registerExtension(extension);
      expect(result.success).toBe(true);
    });

    it('should return the extension when getting it by ID', () => {
      expect(extensionSystem.getExtension(extension.id)).toBe(extension);
    });

    it('should return true when checking if the extension exists', () => {
      expect(extensionSystem.hasExtension(extension.id)).toBe(true);
    });

    it('should list the extension in getExtensions', () => {
      expect(extensionSystem.getExtensions()).toEqual([extension]);
    });

    describe('when registering the same extension again', () => {
      it('should fail with an error', () => {
        const result = extensionSystem.registerExtension(extension);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('already registered');
        }
      });
    });

    describe('when unregistering the extension', () => {
      beforeEach(() => {
        const result = extensionSystem.unregisterExtension(extension.id);
        expect(result.success).toBe(true);
      });

      it('should not return the extension when getting it by ID', () => {
        expect(extensionSystem.getExtension(extension.id)).toBeUndefined();
      });

      it('should return false when checking if the extension exists', () => {
        expect(extensionSystem.hasExtension(extension.id)).toBe(false);
      });

      it('should not list the extension in getExtensions', () => {
        expect(extensionSystem.getExtensions()).toEqual([]);
      });
    });
  });

  describe('Given extensions with dependencies', () => {
    let extensionA: Extension;
    let extensionB: Extension;
    let extensionC: Extension;

    beforeEach(() => {
      extensionA = createTestExtension('A', 'Extension A');
      extensionB = createTestExtension('B', 'Extension B', [extensionA.id]);
      extensionC = createTestExtension('C', 'Extension C', [extensionB.id]);
    });

    describe('when registering in dependency order', () => {
      it('should successfully register all extensions', () => {
        let result = extensionSystem.registerExtension(extensionA);
        expect(result.success).toBe(true);

        result = extensionSystem.registerExtension(extensionB);
        expect(result.success).toBe(true);

        result = extensionSystem.registerExtension(extensionC);
        expect(result.success).toBe(true);
      });
    });

    describe('when registering out of dependency order', () => {
      it('should fail when dependencies are missing', () => {
        let result = extensionSystem.registerExtension(extensionC);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Dependencies not found');
        }
      });
    });

    describe('when unregistering an extension that others depend on', () => {
      beforeEach(() => {
        extensionSystem.registerExtension(extensionA);
        extensionSystem.registerExtension(extensionB);
      });

      it('should fail with an appropriate error', () => {
        const result = extensionSystem.unregisterExtension(extensionA.id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('depended on by other extensions');
        }
      });
    });
  });

  describe('Given extensions with circular dependencies', () => {
    let extensionA: Extension;
    let extensionB: Extension;

    beforeEach(() => {
      extensionA = createTestExtension('A', 'Extension A', ['test.extension.B']);
      extensionB = createTestExtension('B', 'Extension B', ['test.extension.A']);
    });

    it('should fail to register the circular dependency', () => {
      extensionSystem.registerExtension(extensionA);
      const result = extensionSystem.registerExtension(extensionB);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Circular dependency');
      }
    });
  });

  describe('Given extensions with hooks for the same extension point', () => {
    const executionOrder: string[] = [];
    let extensionA: Extension;
    let extensionB: Extension;
    
    const hookA: ExtensionHook<typeof ExtensionPointNames.SYSTEM_INIT, unknown> = 
      async (params, context) => {
        executionOrder.push('A');
        return { success: true, value: params };
      };
    
    const hookB: ExtensionHook<typeof ExtensionPointNames.SYSTEM_INIT, unknown> = 
      async (params, context) => {
        executionOrder.push('B');
        return { success: true, value: params };
      };

    beforeEach(() => {
      executionOrder.length = 0;
      
      extensionA = createTestExtension('A', 'Extension A', [], {
        [ExtensionPointNames.SYSTEM_INIT]: hookA
      });
      
      extensionB = createTestExtension('B', 'Extension B', [extensionA.id], {
        [ExtensionPointNames.SYSTEM_INIT]: hookB
      });
      
      extensionSystem.registerExtension(extensionA);
      extensionSystem.registerExtension(extensionB);
    });

    describe('when executing the extension point', () => {
      it('should execute hooks in dependency order', async () => {
        const params = { version: '1.0', config: {} };
        const result = await extensionSystem.executeExtensionPoint(
          ExtensionPointNames.SYSTEM_INIT, 
          params
        );
        
        expect(result.success).toBe(true);
        expect(executionOrder).toEqual(['A', 'B']);
      });
    });
    
    describe('when a hook fails', () => {
      beforeEach(() => {
        // Re-register extension A with a failing hook
        extensionSystem.unregisterExtension(extensionB.id);
        extensionSystem.unregisterExtension(extensionA.id);
        
        const failingHook: ExtensionHook<typeof ExtensionPointNames.SYSTEM_INIT, unknown> = 
          async (params, context) => {
            executionOrder.push('A');
            return { success: false, error: new Error('Hook failed') };
          };
        
        extensionA = createTestExtension('A', 'Extension A', [], {
          [ExtensionPointNames.SYSTEM_INIT]: failingHook
        });
        
        extensionB = createTestExtension('B', 'Extension B', [extensionA.id], {
          [ExtensionPointNames.SYSTEM_INIT]: hookB
        });
        
        extensionSystem.registerExtension(extensionA);
        extensionSystem.registerExtension(extensionB);
      });
      
      it('should stop executing and return the error', async () => {
        const params = { version: '1.0', config: {} };
        const result = await extensionSystem.executeExtensionPoint(
          ExtensionPointNames.SYSTEM_INIT, 
          params
        );
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Hook failed');
        }
        expect(executionOrder).toEqual(['A']);
      });
    });
  });
}); 