import { EventBus } from '../models/event-system';
import { ExtensionSystem, Extension, ExtensionHookRegistration, ExtensionPointName, ExtensionHook } from '../models/extension-system';
import { ProcessDefinition, ProcessInstance, ProcessTransition } from '../models/index';
import { v4 as uuidv4 } from 'uuid';
import { Result } from '../models/core-types';

/**
 * ProcessManagementPlugin provides capabilities for managing process definitions and instances
 */
export interface ProcessManagementPlugin {
  /**
   * Register a process definition
   */
  registerProcessDefinition(definition: ProcessDefinition): void;
  
  /**
   * Get a process definition by type and optional version
   */
  getProcessDefinition(processType: string, version?: string): ProcessDefinition | undefined;
  
  /**
   * Get all registered process definitions
   */
  getProcessDefinitions(): ProcessDefinition[];
  
  /**
   * Create a new process instance from a definition
   */
  createProcess(processType: string, data: any, options?: { version?: string }): Promise<ProcessInstance>;
  
  /**
   * Transition a process instance to a new state
   */
  transitionProcess(instance: ProcessInstance, event: string): Promise<ProcessInstance>;
  
  /**
   * Validate if a transition is allowed
   */
  isTransitionValid(instance: ProcessInstance, event: string): boolean;
  
  /**
   * Get all valid transitions for a process in its current state
   */
  getValidTransitions(instance: ProcessInstance): ProcessTransition[];
  
  /**
   * Initialize the plugin
   */
  initialize(): void;
}

// Define context types to fix type errors
interface ProcessCreateContext {
  process: ProcessInstance;
  definition: ProcessDefinition;
  [key: string]: any;
}

interface ProcessTransitionContext {
  process: ProcessInstance;
  event: string;
  oldState?: string;
  definition: ProcessDefinition;
  transition?: ProcessTransition;
  [key: string]: any;
}

/**
 * Implementation of the ProcessManagementPlugin
 */
export class ProcessManagementPluginImpl implements ProcessManagementPlugin {
  private processDefinitions: Map<string, ProcessDefinition[]> = new Map();
  private readonly extension: Extension;
  private eventBusInstance: EventBus;

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem
  ) {
    this.eventBusInstance = eventBus;
    // Create a proper extension with bound methods
    const self = this;
    
    this.extension = {
      id: 'process-management',
      name: 'process-management',
      description: 'Provides process definition and lifecycle management',
      dependencies: [],
      
      getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
        // Use closure to capture the plugin instance
        return [
          {
            pointName: 'process:beforeCreate' as ExtensionPointName,
            hook: async (context: unknown): Promise<Result<unknown>> => {
              // We could add validation or enrichment here
              return { success: true, value: context };
            }
          },
          {
            pointName: 'process:afterCreate' as ExtensionPointName,
            hook: async (context: unknown): Promise<Result<unknown>> => {
              // Type assertion for the context
              const typedContext = context as ProcessCreateContext;
              
              // Emit process created event
              self.eventBus.publish({
                id: uuidv4(),
                type: 'process.created',
                timestamp: Date.now(),
                payload: {
                  processId: typedContext.process?.id,
                  processType: typedContext.process?.type,
                  state: typedContext.process?.state,
                  version: typedContext.process?.version
                }
              });
              return { success: true, value: context };
            }
          },
          {
            pointName: 'process:beforeTransition' as ExtensionPointName,
            hook: async (context: unknown): Promise<Result<unknown>> => {
              // Type assertion for the context
              const typedContext = context as ProcessTransitionContext;
              
              if (!typedContext.process || !typedContext.event) {
                return { 
                  success: false, 
                  error: new Error('Missing process or event in context')
                };
              }
              
              // Validate the transition
              if (!self.isTransitionValid(typedContext.process, typedContext.event)) {
                return { 
                  success: false, 
                  error: new Error(`Invalid transition: ${typedContext.event} is not allowed from state ${typedContext.process.state}`)
                };
              }
              
              return { success: true, value: context };
            }
          },
          {
            pointName: 'process:afterTransition' as ExtensionPointName,
            hook: async (context: unknown): Promise<Result<unknown>> => {
              // Type assertion for the context
              const typedContext = context as ProcessTransitionContext;
              
              if (!typedContext.process || !typedContext.oldState) {
                return { 
                  success: false, 
                  error: new Error('Missing process or oldState in context')
                };
              }
              
              // Emit process transitioned event
              self.eventBus.publish({
                id: uuidv4(),
                type: 'process.transitioned',
                timestamp: Date.now(),
                payload: {
                  processId: typedContext.process.id,
                  processType: typedContext.process.type,
                  fromState: typedContext.oldState,
                  toState: typedContext.process.state,
                  event: typedContext.event,
                }
              });
              
              return { success: true, value: context };
            }
          }
        ];
      },
      
      getVersion(): string {
        return '1.0.0';
      },
      
      getCapabilities(): string[] {
        return ['process-management'];
      }
    };
  }

  registerProcessDefinition(definition: ProcessDefinition): void {
    // Validate definition
    if (!definition.type || !definition.initialState || !definition.transitions) {
      throw new Error('Invalid process definition');
    }
    
    // Get existing definitions array or create a new one
    const definitions = this.processDefinitions.get(definition.type) || [];
    
    // Check if version already exists
    const existingIndex = definitions.findIndex(def => def.version === definition.version);
    if (existingIndex >= 0) {
      // Replace existing definition
      definitions[existingIndex] = definition;
    } else {
      // Add new definition
      definitions.push(definition);
    }
    
    // Sort by version (semantic versioning)
    definitions.sort((a, b) => {
      if (!a.version) return 1;
      if (!b.version) return -1;
      return a.version.localeCompare(b.version, undefined, { numeric: true });
    });
    
    this.processDefinitions.set(definition.type, definitions);
  }

  getProcessDefinition(processType: string, version?: string): ProcessDefinition | undefined {
    const definitions = this.processDefinitions.get(processType);
    if (!definitions || definitions.length === 0) {
      return undefined;
    }
    
    if (version) {
      // Find specific version
      return definitions.find(def => def.version === version);
    } else {
      // Return latest version
      return definitions[definitions.length - 1];
    }
  }

  getProcessDefinitions(): ProcessDefinition[] {
    return Array.from(this.processDefinitions.values())
      .flatMap(defs => defs);
  }

  async createProcess(processType: string, data: any, options: { version?: string } = {}): Promise<ProcessInstance> {
    const definition = this.getProcessDefinition(processType, options.version);
    if (!definition) {
      throw new Error(`Unknown process type: ${processType}`);
    }

    // Execute beforeCreate extension point
    const createContext = await this.extensionSystem.executeExtensionPoint('process:beforeCreate', {
      processType,
      data,
      definition,
      options
    });

    // Create process instance
    const process: ProcessInstance = {
      id: `process-${Date.now()}`,
      type: processType,
      state: definition.initialState,
      data: (createContext.value as any)?.data || data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: definition.version || '1.0.0'
    };

    // Execute afterCreate extension point
    const afterCreateContext = await this.extensionSystem.executeExtensionPoint('process:afterCreate', {
      process,
      definition
    });

    return (afterCreateContext.value as any)?.process || process;
  }

  async transitionProcess(instance: ProcessInstance, event: string): Promise<ProcessInstance> {
    const definition = this.getProcessDefinition(instance.type, instance.version);
    if (!definition) {
      throw new Error(`Unknown process type: ${instance.type}`);
    }

    // Execute beforeTransition extension point
    const transitionContext = await this.extensionSystem.executeExtensionPoint('process:beforeTransition', {
      process: instance,
      event,
      definition
    });

    const oldState = instance.state;
    const transition = this.findTransition(definition, instance.state, event);
    
    if (!transition) {
      throw new Error(`Invalid transition ${event} from state ${instance.state}`);
    }
    
    // Update process state
    instance.state = transition.to;
    instance.updatedAt = Date.now();

    // Execute afterTransition extension point
    const afterTransitionContext = await this.extensionSystem.executeExtensionPoint('process:afterTransition', {
      process: instance,
      oldState,
      event,
      definition,
      transition
    });

    return (afterTransitionContext.value as any)?.process || instance;
  }

  isTransitionValid(instance: ProcessInstance, event: string): boolean {
    const definition = this.getProcessDefinition(instance.type, instance.version);
    if (!definition) {
      return false;
    }
    
    const transition = this.findTransition(definition, instance.state, event);
    return !!transition;
  }

  getValidTransitions(instance: ProcessInstance): ProcessTransition[] {
    const definition = this.getProcessDefinition(instance.type, instance.version);
    if (!definition) {
      return [];
    }
    
    return definition.transitions.filter(t => t.from === instance.state);
  }

  private findTransition(definition: ProcessDefinition, state: string, event: string): ProcessTransition | undefined {
    return definition.transitions.find(t => t.from === state && t.event === event);
  }

  initialize(): void {
    this.extensionSystem.registerExtension(this.extension);
  }

  getExtension(): Extension {
    return this.extension;
  }
}

/**
 * Factory function to create a ProcessManagementPlugin instance
 */
export function createProcessManagementPlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  initialDefinitions: Record<string, ProcessDefinition> = {}
): ProcessManagementPlugin {
  const plugin = new ProcessManagementPluginImpl(eventBus, extensionSystem);
  
  // Register initial definitions
  Object.values(initialDefinitions).forEach(definition => {
    plugin.registerProcessDefinition(definition);
  });
  
  return plugin;
} 