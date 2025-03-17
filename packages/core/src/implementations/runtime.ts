/**
 * Runtime Implementation
 *
 * This file implements the reactive runtime that ties everything together.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Runtime,
  RuntimeOptions,
  ProcessDefinition,
  ProcessInstance,
  TaskDefinition,
  TaskExecution,
  TaskContext,
  Event,
} from '../models/index.js';
import { ReactiveEventBus } from './event-bus.js';

/**
 * Default logger implementation
 */
const DEFAULT_LOGGER = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
};

/**
 * ReactiveRuntime implementation
 */
export class ReactiveRuntime implements Runtime {
  private eventBus: ReactiveEventBus;
  private processDefinitions: Record<string, ProcessDefinition>;
  private processInstances: Record<string, ProcessInstance>;
  private taskDefinitions: Record<string, TaskDefinition>;
  private taskExecutions: Record<string, TaskExecution>;
  private logger: RuntimeOptions['logger'];

  constructor(
    processDefinitions: Record<string, ProcessDefinition>,
    taskDefinitions: Record<string, TaskDefinition>,
    options: RuntimeOptions = {}
  ) {
    this.eventBus = new ReactiveEventBus();
    this.processDefinitions = processDefinitions;
    this.taskDefinitions = taskDefinitions;
    this.processInstances = {};
    this.taskExecutions = {};
    this.logger = options.logger || DEFAULT_LOGGER;
  }

  /**
   * Create a new process instance
   */
  createProcess(definitionId: string, data: any): ProcessInstance {
    const definition = this.processDefinitions[definitionId];
    if (!definition) {
      throw new Error(`Process definition not found: ${definitionId}`);
    }

    const id = uuidv4();
    const now = Date.now();

    const instance: ProcessInstance = {
      id,
      definitionId,
      currentState: definition.initialState,
      data,
      history: [
        {
          state: definition.initialState,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.processInstances[id] = instance;

    // Publish process created event
    this.eventBus.publish('process:created', {
      processId: id,
      definitionId,
      state: instance.currentState,
      data,
    });

    return instance;
  }

  /**
   * Get a process instance by ID
   */
  getProcess(id: string): ProcessInstance | undefined {
    return this.processInstances[id];
  }

  /**
   * Transition a process to a new state based on an event
   */
  transitionProcess(id: string, event: string, payload?: any): ProcessInstance {
    const instance = this.processInstances[id];
    if (!instance) {
      throw new Error(`Process instance not found: ${id}`);
    }

    const definition = this.processDefinitions[instance.definitionId];
    if (!definition) {
      throw new Error(`Process definition not found: ${instance.definitionId}`);
    }

    // Find matching transition
    const transition = definition.transitions.find(
      t => (t.from === instance.currentState || t.from === '*') && t.on === event
    );

    if (!transition) {
      throw new Error(
        `No transition found for event '${event}' from state '${instance.currentState}'`
      );
    }

    // Update instance
    const now = Date.now();
    const newState = transition.to;

    instance.currentState = newState;
    instance.updatedAt = now;
    instance.history.push({
      state: newState,
      timestamp: now,
      transition: event,
    });

    // Update data if payload provided
    if (payload) {
      instance.data = {
        ...instance.data,
        ...payload,
      };
    }

    // Publish state changed event
    this.eventBus.publish('process:stateChanged', {
      processId: id,
      definitionId: instance.definitionId,
      previousState: instance.history[instance.history.length - 2].state,
      currentState: newState,
      transition: event,
      data: instance.data,
    });

    return instance;
  }

  /**
   * Execute a task
   */
  async executeTask(taskId: string, input: any): Promise<any> {
    const taskDefinition = this.taskDefinitions[taskId];
    if (!taskDefinition) {
      throw new Error(`Task definition not found: ${taskId}`);
    }

    // Create task execution record
    const executionId = uuidv4();
    const now = Date.now();

    const execution: TaskExecution = {
      id: executionId,
      taskId,
      input,
      status: 'pending',
      startedAt: now,
    };

    this.taskExecutions[executionId] = execution;

    // Publish task started event
    this.eventBus.publish('task:started', {
      executionId,
      taskId,
      input,
    });

    try {
      // Update status to running
      execution.status = 'running';

      // Create task context
      const context: TaskContext = {
        emitEvent: (type, payload) => this.eventBus.publish(type, payload),
        getProcess: id => this.getProcess(id),
        getTaskResult: taskId => {
          const execution = Object.values(this.taskExecutions).find(
            e => e.taskId === taskId && e.status === 'completed'
          );
          return execution?.result;
        },
        logger: this.logger || {
          info: (message: string, data?: any) => console.info(message, data),
          warn: (message: string, data?: any) => console.warn(message, data),
          error: (message: string, data?: any) => console.error(message, data)
        },
      };

      // Execute task
      const result = await taskDefinition.implementation(input, context);

      // Update execution record
      execution.status = 'completed';
      execution.result = result;
      execution.completedAt = Date.now();

      // Publish task completed event
      this.eventBus.publish('task:completed', {
        executionId,
        taskId,
        result,
      });

      return result;
    } catch (error) {
      // Update execution record
      execution.status = 'failed';
      execution.error = (error as Error).message;
      execution.completedAt = Date.now();

      // Publish task failed event
      this.eventBus.publish('task:failed', {
        executionId,
        taskId,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get a task execution by ID
   */
  getTaskExecution(id: string): TaskExecution | undefined {
    return this.taskExecutions[id];
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType: string, handler: (event: Event) => void): () => void {
    return this.eventBus.subscribe(eventType, handler);
  }

  /**
   * Publish an event
   */
  publish(eventType: string, payload: any): void {
    this.eventBus.publish(eventType, payload);
  }
}

/**
 * Create a new runtime instance
 */
export function createRuntime(
  processDefinitions: Record<string, ProcessDefinition>,
  taskDefinitions: Record<string, TaskDefinition>,
  options: RuntimeOptions = {}
): Runtime {
  return new ReactiveRuntime(processDefinitions, taskDefinitions, options);
}
