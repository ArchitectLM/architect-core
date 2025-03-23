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
export function createTestExtension<N extends ExtensionPointName>(
  name: string, 
  description: string, 
  pointName: N,
  hook: ExtensionHook<N, unknown>,
  dependencies: string[] = []
): Extension {
  const id = `test.extension.${name.toLowerCase().replace(/\s+/g, '.')}`;
  
  return {
    id,
    name,
    description,
    dependencies,
    
    getHooks() {
      return [
        createHookRegistration(pointName, hook, 0)
      ];
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
  private readonly extensionHooks: ExtensionHookRegistration<ExtensionPointName, unknown>[];

  constructor(
    id: string, 
    name: string, 
    description: string, 
    hooks: ExtensionHookRegistration<ExtensionPointName, unknown>[] = []
  ) {
    super({ id, name, description, dependencies: [] });
    this.extensionHooks = hooks;
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
 * Utility to add a hook to a test extension
 */
export function createTrackingExtension(pointName: ExtensionPointName): Extension {
  const spy = vi.fn().mockImplementation(async (params: unknown): Promise<Result<unknown>> => {
    return { success: true, value: params };
  });
  
  return createTestExtension(
    `Tracking Extension - ${pointName}`,
    `Extension that tracks calls to ${pointName}`,
    pointName,
    spy as ExtensionHook<typeof pointName, unknown>
  );
}

/**
 * Creates an extension that modifies the parameters
 */
export function createParamModifyingExtension<
  N extends ExtensionPointName
>(pointName: N, modifier: (params: ExtensionPointParameters[N]) => ExtensionPointParameters[N]): Extension {
  const hook: ExtensionHook<N, unknown> = async (params: ExtensionPointParameters[N]): Promise<Result<ExtensionPointParameters[N]>> => {
    return { success: true, value: modifier(params) };
  };
  
  return createTestExtension(
    `Param Modifier - ${pointName}`,
    `Extension that modifies parameters for ${pointName}`,
    pointName,
    hook
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
  handler: ExtensionHook<N, unknown>
): void {
  const extension = createTestExtension(
    `Test Extension for ${pointName}`,
    `Test extension that registers a hook for ${pointName}`,
    pointName,
    handler
  );
  
  extensionSystem.registerExtension(extension);
}

/**
 * Creates a mock extension system for testing
 */
export function createMockExtensionSystem(): ExtensionSystem {
  return {
    executeExtensionPoint: vi.fn().mockResolvedValue({ success: true, value: {} }),
    registerExtension: vi.fn().mockResolvedValue({ success: true }),
    unregisterExtension: vi.fn().mockResolvedValue({ success: true }),
    getExtension: vi.fn().mockReturnValue(null),
    getExtensions: vi.fn().mockReturnValue([]),
    hasExtension: vi.fn().mockReturnValue(false),
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