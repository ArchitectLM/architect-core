/**
 * Process Manager for ArchitectLM
 * 
 * This class is responsible for managing process instances and handling state transitions.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  ProcessDefinition, 
  ProcessInstance, 
  ProcessOptions, 
  Event 
} from '../../models';

/**
 * Process Manager class
 */
export class ProcessManager {
  private processes: Record<string, ProcessDefinition>;
  private instances: Map<string, ProcessInstance> = new Map();
  
  /**
   * Create a new ProcessManager
   */
  constructor(processes: Record<string, ProcessDefinition>) {
    this.processes = processes;
  }
  
  /**
   * Create a new process instance
   */
  createProcess<TContext = any>(
    processId: string, 
    context: TContext, 
    options: ProcessOptions = {}
  ): ProcessInstance {
    const processDefinition = this.processes[processId];
    if (!processDefinition) {
      throw new Error(`Process definition not found: ${processId}`);
    }
    
    // Validate context if schema is provided
    if (processDefinition.contextSchema) {
      const result = processDefinition.contextSchema.safeParse(context);
      if (!result.success) {
        throw new Error(`Invalid context: ${result.error.message}`);
      }
    }
    
    // Determine initial state
    const initialState = processDefinition.initialState || 
      (Array.isArray(processDefinition.states) ? 
        processDefinition.states[0]?.name : 
        Object.keys(processDefinition.states)[0]);
    
    if (!initialState) {
      throw new Error(`No initial state defined for process: ${processId}`);
    }
    
    // Create instance
    const now = new Date();
    const instance: ProcessInstance = {
      id: options.id || uuidv4(),
      processId,
      state: initialState,
      context: context as any,
      history: [],
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata || {}
    };
    
    this.instances.set(instance.id, instance);
    
    return instance;
  }
  
  /**
   * Get a process instance by ID
   */
  getProcess(instanceId: string): ProcessInstance | undefined {
    return this.instances.get(instanceId);
  }
  
  /**
   * Get all process instances
   */
  getAllProcesses(): ProcessInstance[] {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get all process instances for a specific process definition
   */
  getProcessesByDefinition(processId: string): ProcessInstance[] {
    return Array.from(this.instances.values())
      .filter(instance => instance.processId === processId);
  }
  
  /**
   * Transition a process instance to a new state
   */
  transitionProcess(
    instanceId: string, 
    eventType: string,
    payload?: any
  ): ProcessInstance {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Process instance not found: ${instanceId}`);
    }
    
    const processDefinition = this.processes[instance.processId];
    if (!processDefinition) {
      throw new Error(`Process definition not found: ${instance.processId}`);
    }
    
    // Create event
    const event: Event = {
      type: eventType,
      payload,
      timestamp: new Date()
    };
    
    // Find matching transitions
    const matchingTransitions = processDefinition.transitions?.filter(transition => {
      // Check if the transition is from the current state
      const fromMatches = 
        transition.from === '*' || 
        transition.from === instance.state || 
        (Array.isArray(transition.from) && transition.from.includes(instance.state));
      
      // Check if the transition is triggered by this event
      const eventMatches = transition.on === eventType;
      
      return fromMatches && eventMatches;
    });
    
    if (!matchingTransitions || matchingTransitions.length === 0) {
      // No matching transitions
      return instance;
    }
    
    // Find the first transition with a passing guard condition
    let validTransition = null;
    for (const transition of matchingTransitions) {
      if (!transition.guard || transition.guard(instance.context, event)) {
        validTransition = transition;
        break;
      }
    }
    
    if (!validTransition) {
      // No valid transitions (all guards failed)
      return instance;
    }
    
    // Execute the transition
    const fromState = instance.state;
    const toState = validTransition.to;
    
    // Update the instance
    instance.state = toState;
    instance.updatedAt = new Date();
    
    // Update context with new data if provided
    if (payload) {
      instance.context = { ...instance.context, ...payload };
    }
    
    instance.history.push({
      from: fromState,
      to: toState,
      event: eventType,
      timestamp: new Date()
    });
    
    // Execute the transition action if provided
    if (validTransition.action) {
      validTransition.action(instance.context, event);
    }
    
    // Update the instance in the map
    this.instances.set(instance.id, instance);
    
    return instance;
  }
  
  /**
   * Load process instances from storage
   */
  loadInstances(instances: ProcessInstance[]): void {
    for (const instance of instances) {
      this.instances.set(instance.id, instance);
    }
  }
  
  /**
   * Get all process instances for serialization
   */
  getInstancesForSerialization(): ProcessInstance[] {
    return Array.from(this.instances.values());
  }
  
  /**
   * Clear the process instances cache
   */
  clearCache(): void {
    this.instances.clear();
  }
}
