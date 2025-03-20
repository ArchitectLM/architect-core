/**
 * Reactive System Runtime
 * 
 * This module provides the main runtime for the reactive system.
 * It integrates the event bus, process engine, and flow engine.
 */

import { EventBus } from '../types/events';
import { Flow, FlowExecutionOptions, FlowExecutionResult } from '../types/flows';
import { Process, ProcessHandlers } from '../types/processes';
import { TaskImplementation } from '../types/tasks';
import { ReactiveEventBus } from './events';
import { ReactiveFlowEngine } from './flow';
import { ReactiveProcessEngine } from './process';

/**
 * Runtime options
 */
export interface ReactiveRuntimeOptions {
  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

/**
 * Reactive system runtime
 */
export class ReactiveSystemRuntime {
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Process engine
   */
  private processEngine: ReactiveProcessEngine;
  
  /**
   * Flow engine
   */
  private flowEngine: ReactiveFlowEngine;
  
  /**
   * Runtime options
   */
  private options: ReactiveRuntimeOptions;
  
  /**
   * Constructor
   * @param options Runtime options
   */
  constructor(options: ReactiveRuntimeOptions = {}) {
    this.options = options;
    
    // Create the event bus
    this.eventBus = new ReactiveEventBus();
    
    // Create the process engine
    this.processEngine = new ReactiveProcessEngine(this.eventBus);
    
    // Create the flow engine
    this.flowEngine = new ReactiveFlowEngine(this.eventBus);
    
    // Set up debug logging if enabled
    if (options.debug) {
      this.setupDebugLogging();
    }
    
    // Emit system initialized event
    this.eventBus.emit({
      type: 'SYSTEM_INITIALIZED',
      payload: {
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('[ReactiveSystemRuntime] Initialized');
  }
  
  /**
   * Get the event bus
   * @returns The event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
  
  /**
   * Get the process engine
   * @returns The process engine
   */
  getProcessEngine(): ReactiveProcessEngine {
    return this.processEngine;
  }
  
  /**
   * Get the flow engine
   * @returns The flow engine
   */
  getFlowEngine(): ReactiveFlowEngine {
    return this.flowEngine;
  }
  
  /**
   * Register a process
   * @param process Process definition
   * @param handlers Process handlers
   */
  registerProcess(process: Process, handlers: ProcessHandlers): void {
    this.processEngine.registerProcess(process, handlers);
  }
  
  /**
   * Register a flow
   * @param flow Flow definition
   */
  registerFlow(flow: Flow): void {
    this.flowEngine.registerFlow(flow);
  }
  
  /**
   * Register a task implementation
   * @param taskImpl Task implementation
   */
  registerTaskImplementation(taskImpl: TaskImplementation): void {
    this.flowEngine.registerTaskImplementation(taskImpl);
  }
  
  /**
   * Create a process instance
   * @param processId Process ID
   * @param instanceId Process instance ID
   * @param initialState Initial state
   * @param context Process context
   * @returns The process instance ID
   */
  createProcessInstance(processId: string, instanceId: string, initialState: string, context: any = {}): string {
    return this.processEngine.createInstance(processId, instanceId, initialState, context);
  }
  
  /**
   * Get the current state of a process instance
   * @param instanceId Process instance ID
   * @returns The current state
   */
  getProcessState(instanceId: string): string {
    return this.processEngine.getState(instanceId);
  }
  
  /**
   * Get the context of a process instance
   * @param instanceId Process instance ID
   * @returns The context
   */
  getProcessContext(instanceId: string): any {
    return this.processEngine.getContext(instanceId);
  }
  
  /**
   * Update the context of a process instance
   * @param instanceId Process instance ID
   * @param context Context updates
   * @returns The updated context
   */
  updateProcessContext(instanceId: string, context: any): any {
    return this.processEngine.updateContext(instanceId, context);
  }
  
  /**
   * Transition a process instance to a new state
   * @param instanceId Process instance ID
   * @param event The event that triggered the transition
   * @param context Context updates
   * @returns The transition result
   */
  async transitionProcess(instanceId: string, event: string, context: any = {}): Promise<any> {
    return this.processEngine.transition(instanceId, event, context);
  }
  
  /**
   * Execute a flow
   * @param flowId Flow ID
   * @param input Flow input
   * @param options Flow execution options
   * @returns Flow execution result
   */
  async executeFlow<TInput = any, TOutput = any>(
    flowId: string,
    input: TInput,
    options?: Partial<FlowExecutionOptions>
  ): Promise<FlowExecutionResult<TOutput>> {
    return this.flowEngine.executeFlow(flowId, input, options);
  }
  
  /**
   * Emit an event
   * @param eventType Event type
   * @param payload Event payload
   */
  emitEvent(eventType: string, payload: any): void {
    this.eventBus.emit({
      type: eventType,
      payload
    });
  }
  
  /**
   * Shutdown the runtime
   * @param reason Shutdown reason
   */
  shutdown(reason: string = 'normal'): void {
    // Emit system shutdown event
    this.eventBus.emit({
      type: 'SYSTEM_SHUTDOWN',
      payload: {
        reason,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`[ReactiveSystemRuntime] Shutdown: ${reason}`);
  }
  
  /**
   * Set up debug logging
   */
  private setupDebugLogging(): void {
    this.eventBus.subscribeToAll(event => {
      console.debug(`[DEBUG] Event: ${event.type}`, event.payload);
    });
  }
}