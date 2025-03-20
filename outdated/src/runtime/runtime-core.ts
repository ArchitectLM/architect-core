/**
 * Reactive System Runtime Core
 * 
 * This module provides the core runtime for executing reactive systems
 * defined using the DSL. It handles:
 * - Loading system definitions
 * - Managing process state
 * - Executing tasks
 * - Handling events
 */

import type { ReactiveSystem, Process, Task } from '../schema/types';

/**
 * Type for task implementation functions
 */
export type TaskImplementation = (input: any) => Promise<any>;

/**
 * Type for event handlers
 */
export type EventHandler = (payload: any) => void;

/**
 * Reactive System Runtime
 * 
 * Core runtime for executing reactive systems
 */
export class ReactiveSystemRuntime {
  private system: ReactiveSystem;
  private processStates: Map<string, string> = new Map();
  private taskImplementations: Map<string, TaskImplementation> = new Map();
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Creates a new ReactiveSystemRuntime
   * @param system System definition
   */
  constructor(system: ReactiveSystem) {
    this.system = system;
    this.initialize();
  }

  /**
   * Initializes the runtime with the system definition
   */
  private initialize(): void {
    // Initialize process states
    if (this.system.processes) {
      Object.entries(this.system.processes).forEach(([processId, process]) => {
        // Set initial state to the first state in the list
        if (process.states && process.states.length > 0) {
          this.processStates.set(processId, process.states[0]);
        }
      });
    }
  }

  /**
   * Gets the system ID
   * @returns System ID
   */
  getSystemId(): string {
    return this.system.id;
  }

  /**
   * Gets the system version
   * @returns System version
   */
  getSystemVersion(): string {
    return this.system.version;
  }

  /**
   * Checks if a process exists
   * @param processId Process ID
   * @returns Whether the process exists
   */
  hasProcess(processId: string): boolean {
    return !!this.system.processes && !!this.system.processes[processId];
  }

  /**
   * Checks if a task exists
   * @param taskId Task ID
   * @returns Whether the task exists
   */
  hasTask(taskId: string): boolean {
    return !!this.system.tasks && !!this.system.tasks[taskId];
  }

  /**
   * Gets the current state of a process
   * @param processId Process ID
   * @returns Current state
   * @throws Error if the process doesn't exist
   */
  getProcessState(processId: string): string {
    if (!this.hasProcess(processId)) {
      throw new Error(`Process ${processId} not found`);
    }

    return this.processStates.get(processId) || '';
  }

  /**
   * Registers a task implementation
   * @param taskId Task ID
   * @param implementation Task implementation function
   * @throws Error if the task doesn't exist
   */
  registerTaskImplementation(taskId: string, implementation: TaskImplementation): void {
    if (!this.hasTask(taskId)) {
      throw new Error(`Task ${taskId} not found`);
    }

    this.taskImplementations.set(taskId, implementation);
  }

  /**
   * Executes a task
   * @param taskId Task ID
   * @param input Task input
   * @returns Task output
   * @throws Error if the task doesn't exist or has no implementation
   */
  async executeTask(taskId: string, input: any): Promise<any> {
    if (!this.hasTask(taskId)) {
      throw new Error(`Task ${taskId} not found`);
    }

    const implementation = this.taskImplementations.get(taskId);
    if (!implementation) {
      throw new Error(`No implementation found for task ${taskId}`);
    }

    return await implementation(input);
  }

  /**
   * Registers an event handler
   * @param eventType Event type
   * @param handler Event handler function
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)?.add(handler);
  }

  /**
   * Sends an event
   * @param eventType Event type
   * @param payload Event payload
   */
  sendEvent(eventType: string, payload: any): void {
    // Handle process state transitions
    if (payload && payload.processId) {
      this.handleProcessTransition(payload.processId, eventType);
    }

    // Trigger event handlers
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(payload));
    }
  }

  /**
   * Handles a process state transition
   * @param processId Process ID
   * @param eventType Event type
   * @throws Error if the process doesn't exist
   */
  private handleProcessTransition(processId: string, eventType: string): void {
    if (!this.hasProcess(processId)) {
      throw new Error(`Process ${processId} not found`);
    }

    const process = this.system.processes![processId];
    const currentState = this.getProcessState(processId);

    // Find a transition that matches the current state and event
    const transition = process.transitions?.find(
      t => t.from === currentState && t.on === eventType
    );

    // If a transition is found, update the state
    if (transition) {
      this.processStates.set(processId, transition.to);
    }
  }
} 