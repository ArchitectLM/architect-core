/**
 * Reactive System DSL Runtime
 * 
 * This module provides a runtime for executing assembled reactive systems.
 * The runtime is responsible for managing process instances, handling state
 * transitions, executing tasks, and managing events.
 */

import { EventEmitter } from 'events';
import { 
  AssembledSystem, 
  AssembledProcess, 
  AssembledTask,
  StateMachine,
  State,
  Transition
} from './assembler';
import { TaskImplementationFn } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Process instance options
 */
export interface ProcessInstanceOptions {
  id?: string;
  initialState?: string;
  context?: Record<string, any>;
}

/**
 * Process instance
 */
export interface ProcessInstance {
  id: string;
  processId: string;
  state: string;
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  history: Array<{
    from: string;
    to: string;
    event: string;
    timestamp: Date;
  }>;
}

/**
 * Event
 */
export interface Event<T = any> {
  type: string;
  payload?: T;
  processId?: string;
  instanceId?: string;
  timestamp: Date;
}

/**
 * Task context
 */
export interface TaskContext {
  processId?: string;
  instanceId?: string;
  state: string;
  services: Record<string, any>;
  emitEvent: <T = any>(type: string, payload?: T) => void;
  executeTask: <Input = any, Output = any>(taskId: string, input: Input) => Promise<Output>;
}

/**
 * Reactive System Runtime
 */
export class ReactiveSystemRuntime {
  private system: AssembledSystem;
  private instances: Map<string, ProcessInstance> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private services: Record<string, any> = {};

  constructor(system: AssembledSystem) {
    this.system = system;
    
    // Set up default services
    this.services.logger = {
      debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
      info: (message: string, ...args: any[]) => console.info(`[INFO] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
    };
  }

  /**
   * Register a service
   */
  registerService(name: string, service: any): void {
    this.services[name] = service;
  }

  /**
   * Get a service
   */
  getService<T = any>(name: string): T {
    return this.services[name] as T;
  }

  /**
   * Create a process instance
   */
  createProcessInstance(
    processId: string, 
    options: ProcessInstanceOptions = {}
  ): ProcessInstance {
    const process = this.system.processes[processId];
    
    if (!process) {
      throw new Error(`Process '${processId}' not found`);
    }
    
    const id = options.id || uuidv4();
    const initialState = options.initialState || process.stateMachine.getInitialState().name;
    const context = options.context || {};
    
    const instance: ProcessInstance = {
      id,
      processId,
      state: initialState,
      context,
      createdAt: new Date(),
      updatedAt: new Date(),
      history: []
    };
    
    this.instances.set(id, instance);
    
    // Emit process created event
    this.emitEvent('process.created', {
      processId,
      instanceId: id,
      state: initialState
    });
    
    return instance;
  }

  /**
   * Get a process instance
   */
  getProcessInstance(instanceId: string): ProcessInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all process instances
   */
  getAllProcessInstances(): ProcessInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get process instances by process ID
   */
  getProcessInstancesByProcessId(processId: string): ProcessInstance[] {
    return this.getAllProcessInstances().filter(instance => instance.processId === processId);
  }

  /**
   * Send an event to a process instance
   */
  async sendEvent<T = any>(
    instanceId: string, 
    eventType: string, 
    payload?: T
  ): Promise<ProcessInstance> {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      throw new Error(`Process instance '${instanceId}' not found`);
    }
    
    const process = this.system.processes[instance.processId];
    
    if (!process) {
      throw new Error(`Process '${instance.processId}' not found`);
    }
    
    // Get the current state
    const currentState = process.stateMachine.getState(instance.state);
    
    if (!currentState) {
      throw new Error(`State '${instance.state}' not found in process '${instance.processId}'`);
    }
    
    // Get the transition for the event
    const transition = currentState.getTransition(eventType);
    
    if (!transition) {
      throw new Error(`No transition found for event '${eventType}' in state '${instance.state}'`);
    }
    
    // Check if the transition has a condition
    if (transition.condition) {
      const conditionResult = await transition.condition(instance.context, {});
      
      if (!conditionResult) {
        throw new Error(`Transition condition failed for event '${eventType}' in state '${instance.state}'`);
      }
    }
    
    // Get the target state
    const targetState = transition.target;
    
    // Update the instance
    const previousState = instance.state;
    instance.state = targetState;
    instance.updatedAt = new Date();
    instance.history.push({
      from: previousState,
      to: targetState,
      event: eventType,
      timestamp: new Date()
    });
    
    // Emit state transition event
    this.emitEvent('process.transitioned', {
      processId: instance.processId,
      instanceId,
      from: previousState,
      to: targetState,
      event: eventType
    });
    
    // Execute tasks in the new state
    const newState = process.stateMachine.getState(targetState);
    
    if (newState) {
      const tasks = newState.getTasks();
      
      for (const taskId of tasks) {
        try {
          await this.executeTask(taskId, payload || {}, {
            processId: instance.processId,
            instanceId,
            state: targetState
          });
        } catch (error) {
          this.services.logger.error(`Error executing task '${taskId}':`, error);
          
          // Emit task error event
          this.emitEvent('task.error', {
            processId: instance.processId,
            instanceId,
            taskId,
            error
          });
        }
      }
    }
    
    return instance;
  }

  /**
   * Execute a task
   */
  async executeTask<Input = any, Output = any>(
    taskId: string, 
    input: Input, 
    context?: Partial<TaskContext>,
    retryAttempt: number = 0
  ): Promise<Output> {
    const task = this.system.tasks[taskId];
    
    if (!task) {
      throw new Error(`Task '${taskId}' not found`);
    }
    
    // Create task context
    const taskContext: TaskContext = {
      processId: context?.processId,
      instanceId: context?.instanceId,
      state: context?.state || '',
      services: this.services,
      emitEvent: (type, payload) => {
        this.emitEvent(type, payload, {
          processId: context?.processId,
          instanceId: context?.instanceId
        });
      },
      executeTask: (taskId, input) => this.executeTask(taskId, input, context)
    };
    
    // Emit task started event (only on first attempt)
    if (retryAttempt === 0) {
      this.emitEvent('task.started', {
        taskId,
        input,
        processId: context?.processId,
        instanceId: context?.instanceId
      });
    } else {
      this.emitEvent('task.retry', {
        taskId,
        input,
        attempt: retryAttempt,
        processId: context?.processId,
        instanceId: context?.instanceId
      });
    }
    
    try {
      // Execute the task
      const result = await task.implementation(input, taskContext);
      
      // Emit task completed event
      this.emitEvent('task.completed', {
        taskId,
        result,
        processId: context?.processId,
        instanceId: context?.instanceId,
        attempts: retryAttempt + 1
      });
      
      return result as Output;
    } catch (error) {
      // Check if we should retry
      if (task.retryPolicy && retryAttempt < task.retryPolicy.maxAttempts) {
        // Check retry condition if provided
        const shouldRetry = !task.retryPolicy.retryCondition || 
                            task.retryPolicy.retryCondition(error as Error);
        
        if (shouldRetry) {
          // Emit retry attempt event
          this.emitEvent('task.retry.attempt', {
            taskId,
            error,
            attempt: retryAttempt + 1,
            maxAttempts: task.retryPolicy.maxAttempts,
            processId: context?.processId,
            instanceId: context?.instanceId
          });
          
          // Calculate delay
          const delay = typeof task.retryPolicy.delay === 'function' 
            ? task.retryPolicy.delay(retryAttempt + 1) 
            : task.retryPolicy.delay;
          
          // Wait for the delay
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the task with the same context
          return this.executeTask(taskId, input, context, retryAttempt + 1);
        }
      }
      
      // Emit task error event
      this.emitEvent('task.error', {
        taskId,
        error,
        attempts: retryAttempt + 1,
        processId: context?.processId,
        instanceId: context?.instanceId
      });
      
      throw error;
    }
  }

  /**
   * Emit an event
   */
  emitEvent<T = any>(
    type: string, 
    payload?: T, 
    context?: {
      processId?: string;
      instanceId?: string;
    }
  ): void {
    const event: Event<T> = {
      type,
      payload,
      processId: context?.processId,
      instanceId: context?.instanceId,
      timestamp: new Date()
    };
    
    this.eventEmitter.emit(type, event);
    this.eventEmitter.emit('*', event);
    
    // If this event is for a specific process instance, send it to that instance
    if (context?.instanceId && typeof context.instanceId === "string") {
      // Check if the instance exists and get its current state
      const instance = this.getProcessInstance(context.instanceId);
      if (instance) {
        // Use setTimeout to avoid blocking the current execution
        setTimeout(() => {
          // Check if the instance still exists (it might have been removed)
          if (context.instanceId) {
            const currentInstance = this.getProcessInstance(context.instanceId);
            if (currentInstance) {
              // Get the process definition
              const process = this.system.processes[currentInstance.processId];
              if (process) {
                // Get the current state
                const currentState = process.stateMachine.getState(currentInstance.state);
                if (currentState) {
                  // Check if there's a transition for this event
                  const transition = currentState.getTransition(type);
                  if (transition) {
                    // Send the event to the instance
                    this.sendEvent(context.instanceId as string, type, payload)
                      .catch(error => {
                        this.services.logger.error(`Error sending event '${type}' to instance '${context.instanceId}':`, error);
                      });
                  }
                }
              }
            }
          }
        }, 0);
      }
    }
  }

  /**
   * Subscribe to events
   */
  on<T = any>(
    type: string, 
    handler: (event: Event<T>) => void
  ): () => void {
    this.eventEmitter.on(type, handler);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off(type, handler);
    };
  }

  /**
   * Run a process from start to finish
   * This is a convenience method for testing
   */
  async runProcess(
    processId: string, 
    events: Array<{ type: string; payload?: any }>,
    options?: ProcessInstanceOptions
  ): Promise<ProcessInstance> {
    // Create a process instance
    const instance = this.createProcessInstance(processId, options);
    
    // Send events in sequence
    for (const event of events) {
      await this.sendEvent(instance.id, event.type, event.payload);
    }
    
    return instance;
  }
}

/**
 * Create a reactive system runtime
 */
export function createRuntime(system: AssembledSystem): ReactiveSystemRuntime {
  return new ReactiveSystemRuntime(system);
} 