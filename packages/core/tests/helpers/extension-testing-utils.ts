import { vi } from 'vitest';
import { 
  Extension, 
  ExtensionContext, 
  ExtensionHookRegistration, 
  ExtensionPointName, 
  ExtensionPointNames, 
  ExtensionPointParameters, 
  ExtensionHook,
  ExtensionSystem,
  createHookRegistration
} from '../../src/models/extension-system';
import { InMemoryExtensionSystem } from '../../src/implementations/extension-system';
import { Result, Identifier, DomainEvent } from '../../src/models/core-types';
import { BasePlugin, PluginState } from '../../src/models/plugin-system';

/**
 * Creates a basic test extension with the given properties and hooks
 */
export function createTestExtension(
  name: string, 
  description: string, 
  dependencies: string[] = [],
  hooks: Partial<Record<ExtensionPointName, ExtensionHook<any, any>>> = {}
): Extension {
  const id = `test.extension.${name.toLowerCase().replace(/\s+/g, '.')}`;
  
  return {
    id,
    name,
    description,
    dependencies,
    
    getHooks() {
      const registrations: ExtensionHookRegistration<ExtensionPointName, unknown>[] = [];
      
      // Convert hooks object to array of ExtensionHookRegistration objects
      for (const [pointName, hook] of Object.entries(hooks)) {
        if (hook) {
          registrations.push({
            pointName: pointName as ExtensionPointName,
            hook,
            priority: 0
          });
        }
      }
      
      return registrations;
    },
    
    getVersion() {
      return '1.0.0';
    },
    
    getCapabilities() {
      return [];
    }
  };
}

/**
 * Creates a configurable test extension
 */
export class ConfigurableTestExtension extends BasePlugin {
  private extensionHooks: ExtensionHookRegistration<ExtensionPointName, unknown>[] = [];

  constructor(
    id: string, 
    name: string = `Configurable Test Extension ${id}`, 
    description: string = `A configurable test extension with ID ${id}`,
    hooks: ExtensionHookRegistration<ExtensionPointName, unknown>[] = []
  ) {
    super({ id, name, description, dependencies: [] });
    this.extensionHooks = hooks;
  }

  /**
   * Add a hook to this extension with specified priority
   */
  addHook<N extends ExtensionPointName>(
    pointName: N, 
    hook: ExtensionHook<N, unknown>,
    priority: number = 0
  ): void {
    this.extensionHooks.push({
      pointName,
      hook,
      priority
    });
  }

  getHooks(): ExtensionHookRegistration<ExtensionPointName, unknown>[] {
    return this.extensionHooks;
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): string[] {
    return [];
  }
}

/**
 * Helper function to flush promises for testing asynchronous code
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Creates an extension that tracks execution order
 */
export function createTrackingExtension(
  id: string,
  pointNames: ExtensionPointName[]
): { 
  extension: Extension; 
  executionOrder: ExtensionPointName[];
} {
  const executionOrder: ExtensionPointName[] = [];
  const hooks: Partial<Record<ExtensionPointName, ExtensionHook<any, any>>> = {};
  
  for (const pointName of pointNames) {
    hooks[pointName] = async (params: unknown): Promise<Result<unknown>> => {
      executionOrder.push(pointName);
      return { success: true, value: params };
    };
  }
  
  return {
    extension: createTestExtension(id, `Tracking Extension - ${id}`, [], hooks),
    executionOrder
  };
}

/**
 * Creates an extension that modifies the parameters
 */
export interface ModificationSpec {
  name: ExtensionPointName;
  modification: (params: any) => any;
}

export function createParamModifyingExtension(
  id: string,
  modifications: ModificationSpec[]
): Extension {
  const hooks: Partial<Record<ExtensionPointName, ExtensionHook<any, any>>> = {};
  
  for (const { name, modification } of modifications) {
    hooks[name] = async (params: unknown): Promise<Result<unknown>> => {
      return { success: true, value: modification(params) };
    };
  }
  
  return createTestExtension(
    id, 
    `Parameter Modifying Extension - ${id}`,
    [],
    hooks
  );
}

/**
 * Test plugin implementation
 */
export class TestPlugin extends BasePlugin {
  constructor(id: string, name: string) {
    super({ id, name, description: `Test plugin: ${name}`, dependencies: [] });
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return [];
  }
}

/**
 * Register a test hook for a specific extension point
 */
export function registerTestHook<N extends ExtensionPointName>(
  extensionSystem: ExtensionSystem,
  pointName: N,
  handler: ExtensionHook<N, unknown>,
  priority: number = 0
): void {
  const extension = createTestExtension(
    `hook-${pointName}`,
    `Test extension that registers a hook for ${pointName}`,
    [],
    { [pointName]: handler }
  );
  
  extensionSystem.registerExtension(extension);
}

/**
 * Creates a mock extension system for testing
 */
export function createMockExtensionSystem(): ExtensionSystem {
  return {
    registerExtensionPoint: vi.fn(),
    executeExtensionPoint: vi.fn().mockResolvedValue({ success: true, value: {} }),
    registerExtension: vi.fn().mockReturnValue({ success: true, value: undefined }),
    unregisterExtension: vi.fn().mockReturnValue({ success: true, value: undefined }),
    getExtensionPoints: vi.fn().mockReturnValue([]),
    getExtensions: vi.fn().mockReturnValue([]),
    getExtensionHandlers: vi.fn().mockReturnValue([]),
    setContext: vi.fn()
  };
}

/**
 * Helper to create a chain of extensions with dependencies
 */
export function createExtensionChain(
  count: number,
  baseNames: string = 'ext',
  hooks: Partial<Record<ExtensionPointName, ExtensionHook<any, any>>> = {}
): Extension[] {
  const extensions: Extension[] = [];
  
  for (let i = 0; i < count; i++) {
    const name = `${baseNames}-${i+1}`;
    const dependencies = i > 0 ? [`test.extension.${baseNames}-${i}`] : [];
    extensions.push(createTestExtension(name, `Extension ${name}`, dependencies, hooks));
  }
  
  return extensions;
}

/**
 * Creates a new extension system with pre-registered extensions
 */
export function createExtensionSystemWithExtensions(
  extensions: Extension[] = []
): InMemoryExtensionSystem {
  const system = new InMemoryExtensionSystem();
  
  // Register extensions
  extensions.forEach(ext => {
    system.registerExtension(ext);
  });
  
  return system;
} 