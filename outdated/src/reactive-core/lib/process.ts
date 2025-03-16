/**
 * Process Engine
 * 
 * This module provides an implementation of the process engine for the reactive system.
 * The process engine is responsible for managing process instances and their state transitions.
 */

import { BaseEvent, EventBus } from '../types/events';
import { Process, ProcessEngine, ProcessHandlers, ProcessTransition, TransitionResult } from '../types/processes';

/**
 * Process instance
 */
interface ProcessInstance {
  /**
   * Process instance ID
   */
  id: string;
  
  /**
   * Process ID
   */
  processId: string;
  
  /**
   * Current state
   */
  currentState: string;
  
  /**
   * Process context
   */
  context: any;
}

/**
 * Process engine implementation
 */
export class ReactiveProcessEngine implements ProcessEngine {
  /**
   * Process instances
   */
  private instances: Map<string, ProcessInstance> = new Map();
  
  /**
   * Process definitions
   */
  private processes: Map<string, Process> = new Map();
  
  /**
   * Process handlers
   */
  private handlers: Map<string, ProcessHandlers> = new Map();
  
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Constructor
   * @param eventBus Event bus
   */
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Subscribe to events
    this.eventBus.subscribe('*', this.handleEvent.bind(this));
  }
  
  /**
   * Register a process
   * @param process Process definition
   * @param handlers Process handlers
   */
  registerProcess(process: Process, handlers: ProcessHandlers): void {
    // Register the process
    this.processes.set(process.id, process);
    
    // Register the handlers
    this.handlers.set(process.id, handlers);
    
    console.log(`[ProcessEngine] Registered process: ${process.id}`);
  }
  
  /**
   * Create a process instance
   * @param processId Process ID
   * @param instanceId Process instance ID
   * @param initialState Initial state
   * @param context Process context
   * @returns The process instance ID
   */
  createInstance(processId: string, instanceId: string, initialState: string, context: any = {}): string {
    // Get the process
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }
    
    // Check if the process is stateful
    if (process.type !== 'stateful') {
      throw new Error(`Process is not stateful: ${processId}`);
    }
    
    // Check if the initial state is valid
    if (process.states && !process.states.includes(initialState)) {
      throw new Error(`Invalid initial state: ${initialState}`);
    }
    
    // Create the instance
    const instance: ProcessInstance = {
      id: instanceId,
      processId,
      currentState: initialState,
      context
    };
    
    // Store the instance
    this.instances.set(instanceId, instance);
    
    // Call the onEnterState handler
    const handlers = this.handlers.get(processId);
    if (handlers) {
      handlers.onEnterState(initialState, context);
    }
    
    // Emit an event
    this.eventBus.emit({
      type: 'PROCESS_INSTANCE_CREATED',
      payload: {
        processId,
        instanceId,
        state: initialState,
        context
      }
    });
    
    console.log(`[ProcessEngine] Created process instance: ${instanceId} (${processId})`);
    
    return instanceId;
  }
  
  /**
   * Get the current state of a process instance
   * @param instanceId Process instance ID
   * @returns The current state
   */
  getState(instanceId: string): string {
    // Get the instance
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Process instance not found: ${instanceId}`);
    }
    
    return instance.currentState;
  }
  
  /**
   * Get the context of a process instance
   * @param instanceId Process instance ID
   * @returns The context
   */
  getContext(instanceId: string): any {
    // Get the instance
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Process instance not found: ${instanceId}`);
    }
    
    return instance.context;
  }
  
  /**
   * Update the context of a process instance
   * @param instanceId Process instance ID
   * @param context Context updates
   * @returns The updated context
   */
  updateContext(instanceId: string, context: any): any {
    // Get the instance
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Process instance not found: ${instanceId}`);
    }
    
    // Update the context
    instance.context = {
      ...instance.context,
      ...context
    };
    
    // Store the instance
    this.instances.set(instanceId, instance);
    
    // Emit an event
    this.eventBus.emit({
      type: 'PROCESS_CONTEXT_UPDATED',
      payload: {
        processId: instance.processId,
        instanceId,
        context: instance.context
      }
    });
    
    return instance.context;
  }
  
  /**
   * Transition a process instance to a new state
   * @param instanceId Process instance ID
   * @param event The event that triggered the transition
   * @param context Context updates
   * @returns The transition result
   */
  async transition(instanceId: string, event: string, context: any = {}): Promise<TransitionResult> {
    // Get the instance
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        success: false,
        error: `Process instance not found: ${instanceId}`
      };
    }
    
    // Get the process
    const process = this.processes.get(instance.processId);
    if (!process) {
      return {
        success: false,
        error: `Process not found: ${instance.processId}`
      };
    }
    
    // Get the handlers
    const handlers = this.handlers.get(instance.processId);
    if (!handlers) {
      return {
        success: false,
        error: `Process handlers not found: ${instance.processId}`
      };
    }
    
    // Find the transition
    const transition = this.findTransition(process, instance.currentState, event);
    if (!transition) {
      return {
        success: false,
        fromState: instance.currentState,
        context: instance.context,
        error: `No transition found from ${instance.currentState} with event ${event}`
      };
    }
    
    // Update the context
    if (context) {
      instance.context = {
        ...instance.context,
        ...context
      };
    }
    
    // Check if the transition is allowed
    if (!handlers.canTransition(instance.currentState, transition.to, event, instance.context)) {
      return {
        success: false,
        fromState: instance.currentState,
        context: instance.context,
        error: `Transition not allowed from ${instance.currentState} to ${transition.to} with event ${event}`
      };
    }
    
    // Call the onExitState handler
    if (handlers.onExitState) {
      handlers.onExitState(instance.currentState, instance.context);
    }
    
    // Update the state
    const fromState = instance.currentState;
    instance.currentState = transition.to;
    
    // Store the instance
    this.instances.set(instanceId, instance);
    
    // Call the onEnterState handler
    handlers.onEnterState(instance.currentState, instance.context);
    
    // Call the afterTransition handler
    handlers.afterTransition(fromState, instance.currentState, event, instance.context);
    
    // Emit an event
    this.eventBus.emit({
      type: 'PROCESS_STATE_CHANGED',
      payload: {
        processId: instance.processId,
        instanceId,
        fromState,
        toState: instance.currentState,
        event,
        context: instance.context
      }
    });
    
    console.log(`[ProcessEngine] Transitioned process instance: ${instanceId} from ${fromState} to ${instance.currentState}`);
    
    return {
      success: true,
      fromState,
      toState: instance.currentState,
      context: instance.context
    };
  }
  
  /**
   * Handle an event
   * @param event The event
   * @returns The result of handling the event
   */
  async handleEvent(event: string, payload: any): Promise<any> {
    // Find process instances that can handle this event
    const results: Record<string, TransitionResult> = {};
    
    // Iterate over all instances
    for (const [instanceId, instance] of this.instances.entries()) {
      // Get the process
      const process = this.processes.get(instance.processId);
      if (!process) {
        continue;
      }
      
      // Find the transition
      const transition = this.findTransition(process, instance.currentState, event);
      if (!transition) {
        continue;
      }
      
      // Transition the instance
      results[instanceId] = await this.transition(instanceId, event, payload);
    }
    
    return results;
  }
  
  /**
   * Find a transition
   * @param process Process definition
   * @param fromState From state
   * @param event Event
   * @returns The transition or undefined if not found
   */
  private findTransition(process: Process, fromState: string, event: string): ProcessTransition | undefined {
    // Check if the process has transitions
    if (!process.transitions) {
      return undefined;
    }
    
    // Find the transition
    return process.transitions.find(transition => 
      transition.from === fromState && transition.trigger === event
    );
  }
}