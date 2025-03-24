import { TestRuntime } from './test-runtime';
import { createRuntime } from '../../src/implementations/factory';
import { v4 as uuidv4 } from 'uuid';
import { createInMemoryEventBus } from '../../src/implementations/event-bus';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { InMemoryTaskRegistry } from '../../src/implementations/task-registry';
import { InMemoryProcessRegistry } from '../../src/implementations/process-registry';
import { Runtime } from '../../src/models/runtime';

/**
 * Creates a mock runtime instance for testing 
 */
export function mockRuntime(): Runtime {
  // Create extension system first
  const extensionSystem = createExtensionSystem();
  
  // Create event bus with extension system
  const eventBus = createInMemoryEventBus(extensionSystem);
  
  // Create registries
  const taskRegistry = new InMemoryTaskRegistry();
  const processRegistry = new InMemoryProcessRegistry();
  
  // Create a runtime with all required components
  return createRuntime({
    runtimeOptions: {
      version: '1.0.0',
      namespace: `test-runtime-${uuidv4()}`,
      metadata: {
        name: 'Test Runtime',
        testing: true
      }
    },
    // Provide all core components explicitly
    components: {
      extensionSystem,
      eventBus,
      taskRegistry,
      processRegistry
    }
  });
} 