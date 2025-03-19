/**
 * Workflow extension for the DSL
 * 
 * Adds workflow execution capabilities to the DSL.
 */
import { defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { 
  ComponentType, 
  WorkflowComponentDefinition, 
  SystemDefinition,
  ComponentDefinition
} from '../models/component.js';
import { RuntimeAdapter } from '../runtime/adapter.js';

// Simple EventEmitter implementation that works in both Node.js and browser environments
class EventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) {
      return;
    }
    this.events[event].forEach(listener => listener(...args));
  }

  removeListener(event: string, listener: Function): void {
    if (!this.events[event]) {
      return;
    }
    this.events[event] = this.events[event].filter(l => l !== listener);
  }
}

// Augment the DSL class with extension properties
declare module '../core/dsl.js' {
  interface DSL {
    registry: {
      getComponentsByType(type: ComponentType): ComponentDefinition[];
      getComponentById(id: string): ComponentDefinition | undefined;
    };
    events: EventEmitter;
  }
}

/**
 * Workflow extension options
 */
export interface WorkflowExtensionOptions {
  /**
   * Whether to enable runtime integration by default
   */
  enableRuntimeIntegration?: boolean;
  
  /**
   * Whether to enable workflow visualization
   */
  enableVisualization?: boolean;
  
  /**
   * Whether to automatically transition workflows based on events
   */
  enableAutoTransition?: boolean;
}

/**
 * Workflow state
 */
export interface WorkflowState {
  id: string;
  workflowId: string;
  currentState: string;
  data: any;
  history: Array<{
    state: string;
    timestamp: number;
    transition?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

// DSL context to be used by the extension
let dslContext: DSL | null = null;

/**
 * Workflow extension setup
 */
export function setupWorkflowExtension(dsl: DSL, options: WorkflowExtensionOptions = {}): void {
  // Save DSL context
  dslContext = dsl;
  
  // Create registry and events if they don't exist
  if (!dsl.registry) {
    (dsl as any).registry = {
      getComponentsByType: (type: ComponentType): ComponentDefinition[] => {
        return Array.from((dsl as any).components.values())
          .filter((component: any) => component.type === type) as ComponentDefinition[];
      },
      getComponentById: (id: string): ComponentDefinition | undefined => {
        return (dsl as any).components.get(id) as ComponentDefinition | undefined;
      }
    };
  }
  
  if (!dsl.events) {
    (dsl as any).events = new EventEmitter();
  }
  
  // Get all workflow components from the DSL registry
  const workflowComponents = dsl.registry.getComponentsByType(ComponentType.WORKFLOW)
    .filter((comp): comp is WorkflowComponentDefinition => comp.type === ComponentType.WORKFLOW);
  
  // Extend each workflow component with additional methods
  workflowComponents.forEach(workflow => {
    extendWorkflowComponent(workflow, options, dsl);
  });
  
  // Get all system definitions and extend them with workflow capabilities
  const systems = dsl.registry.getComponentsByType(ComponentType.SYSTEM)
    .filter((comp): comp is SystemDefinition => comp.type === ComponentType.SYSTEM);
  
  systems.forEach(system => {
    extendSystemWithWorkflows(system, options, dsl);
  });
  
  // Register event listeners for auto transition if enabled
  if (options.enableAutoTransition) {
    dsl.events.on('workflow:event', (eventData: { workflowInstance: WorkflowState, event: string, data?: any }) => {
      const { workflowInstance, event, data } = eventData;
      const workflowId = workflowInstance.workflowId;
      const workflow = dsl.registry.getComponentById(workflowId) as WorkflowComponentDefinition | undefined;
      
      if (workflow && workflow.type === ComponentType.WORKFLOW && (workflow as any).canTransition(workflowInstance.currentState, event)) {
        const updatedInstance = (workflow as any).transition(workflowInstance, event, data);
        dsl.events.emit('workflow:transitioned', {
          workflowInstance: updatedInstance,
          previousState: workflowInstance.currentState,
          event
        });
      }
    });
  }
}

/**
 * Extend a workflow component with execution capabilities
 */
function extendWorkflowComponent(
  workflow: WorkflowComponentDefinition, 
  options: WorkflowExtensionOptions, 
  dsl: DSL
): void {
  // Add method to create a workflow instance
  (workflow as any).createInstance = (data: any = {}) => {
    return {
      id: `workflow-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowId: workflow.id,
      currentState: workflow.initialState,
      data,
      history: [
        {
          state: workflow.initialState,
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };
  
  // Add method to check if a transition is valid
  (workflow as any).canTransition = (state: string, event: string) => {
    const transition = workflow.transitions.find(t => 
      (t.from === state || t.from === '*') && t.on === event
    );
    return !!transition;
  };
  
  // Add method to get the next state for a transition
  (workflow as any).getNextState = (state: string, event: string) => {
    const transition = workflow.transitions.find(t => 
      (t.from === state || t.from === '*') && t.on === event
    );
    return transition ? transition.to : null;
  };
  
  // Add method to transition a workflow instance
  (workflow as any).transition = (instance: WorkflowState, event: string, data: any = {}) => {
    const nextState = (workflow as any).getNextState(instance.currentState, event);
    
    if (!nextState) {
      throw new Error(`Invalid transition: ${instance.currentState} -> ${event}`);
    }
    
    // Update the instance
    const updatedInstance = {
      ...instance,
      currentState: nextState,
      data: { ...instance.data, ...data },
      history: [
        ...instance.history,
        {
          state: nextState,
          timestamp: Date.now(),
          transition: event
        }
      ],
      updatedAt: Date.now()
    };
    
    return updatedInstance;
  };
  
  // Add method to visualize the workflow if enabled
  if (options.enableVisualization) {
    (workflow as any).visualize = () => {
      // Simple ASCII visualization
      let result = `Workflow: ${workflow.id}\n`;
      result += `Initial state: ${workflow.initialState}\n`;
      result += 'Transitions:\n';
      
      workflow.transitions.forEach(t => {
        result += `  ${t.from} --[${t.on}]--> ${t.to}\n`;
      });
      
      return result;
    };
  }
  
  // Add runtime integration if enabled
  if (options.enableRuntimeIntegration) {
    (workflow as any).executeWithRuntime = async (
      systemId: string, 
      data: any, 
      runtimeAdapter: RuntimeAdapter
    ) => {
      // Create runtime
      const runtime = await runtimeAdapter.createRuntime(systemId);
      
      // Start the workflow process
      return runtimeAdapter.startWorkflow(runtime, workflow.id, data);
    };
  }
}

/**
 * Extend a system with workflow capabilities
 */
function extendSystemWithWorkflows(
  system: SystemDefinition, 
  options: WorkflowExtensionOptions, 
  dsl: DSL
): void {
  // Add method to get all workflows in the system
  (system as any).getWorkflows = () => {
    if (!system.workflows) {
      return [];
    }
    
    return system.workflows.map(workflow => ({
      name: workflow.name,
      description: workflow.description,
      initialState: workflow.initialState,
      transitions: workflow.transitions
    }));
  };
  
  // Add method to create a runtime adapter
  (system as any).createRuntimeAdapter = () => {
    return new RuntimeAdapter(dsl);
  };
  
  // Add method to execute a workflow
  (system as any).executeWorkflow = async (
    workflowName: string, 
    data: any
  ) => {
    if (!system.workflows) {
      throw new Error(`System ${system.id} has no workflows`);
    }
    
    const workflow = system.workflows.find(w => w.name === workflowName);
    if (!workflow) {
      throw new Error(`Workflow ${workflowName} not found in system ${system.id}`);
    }
    
    const runtimeAdapter = (system as any).createRuntimeAdapter();
    const runtime = await runtimeAdapter.createRuntime(system.id);
    
    return runtimeAdapter.startWorkflow(runtime, workflowName, data);
  };
}

/**
 * Define the workflow extension
 */
export const workflowExtension = defineExtension({
  id: 'workflow',
  name: 'Workflow Extension',
  description: 'Adds workflow execution capabilities to the DSL',
  
  async setup(options?: WorkflowExtensionOptions) {
    // This will be called when the extension is initialized
    console.log('Workflow extension setup with options:', options);
    
    // Setup the workflow extension with the DSL
    if (dslContext) {
      setupWorkflowExtension(dslContext, options || {});
    } else {
      console.warn('Workflow extension setup called without DSL instance.');
    }
  }
}); 