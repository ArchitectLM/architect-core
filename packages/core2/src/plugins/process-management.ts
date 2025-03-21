import { EventBus } from '../models/event.js';
import { ExtensionSystem } from '../models/extension.js';
import { Extension } from '../models/extension.js';
import { ProcessDefinition, ProcessInstance, ProcessTransition } from '../models/index.js';

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

/**
 * Implementation of the ProcessManagementPlugin
 */
export class ProcessManagementPluginImpl implements ProcessManagementPlugin {
  private processDefinitions: Map<string, ProcessDefinition[]> = new Map();
  private readonly extension: Extension;

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem
  ) {
    this.extension = {
      name: 'process-management',
      description: 'Provides process definition and lifecycle management',
      hooks: {
        'process:beforeCreate': async (context) => {
          // We could add validation or enrichment here
          return context;
        },
        'process:afterCreate': async (context) => {
          // Emit process created event
          this.eventBus.publish('process.created', {
            processId: context.process.id,
            processType: context.process.type,
            timestamp: Date.now(),
            state: context.process.state,
            version: context.process.version
          });
          return context;
        },
        'process:beforeTransition': async (context) => {
          const { process, event } = context;
          
          // Validate the transition
          if (!this.isTransitionValid(process, event)) {
            throw new Error(`Invalid transition ${event} from state ${process.state}`);
          }
          
          return context;
        },
        'process:afterTransition': async (context) => {
          const { process, oldState, event } = context;
          
          // Emit process transitioned event
          this.eventBus.publish('process.transitioned', {
            processId: process.id,
            processType: process.type,
            fromState: oldState,
            toState: process.state,
            event,
            timestamp: Date.now()
          });
          
          return context;
        }
      }
    };
  }

  registerProcessDefinition(definition: ProcessDefinition): void {
    // Validate definition
    if (!definition.id || !definition.initialState || !definition.transitions) {
      throw new Error('Invalid process definition');
    }
    
    // Get existing definitions array or create a new one
    const definitions = this.processDefinitions.get(definition.id) || [];
    
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
    
    this.processDefinitions.set(definition.id, definitions);
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
      data: createContext.data || data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: definition.version || '1.0.0'
    };

    // Execute afterCreate extension point
    const afterCreateContext = await this.extensionSystem.executeExtensionPoint('process:afterCreate', {
      process,
      definition
    });

    return afterCreateContext.process;
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

    return afterTransitionContext.process;
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
    return definition.transitions.find(t => t.from === state && t.on === event);
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