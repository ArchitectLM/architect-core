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
    this.processDefinitions = {
      ...processDefinitions,
      default: {
        id: 'default',
        name: 'Default Process',
        description: 'Default process definition for task execution',
        initialState: 'initial',
        transitions: [
          { from: 'initial', to: 'running', on: 'START' },
          { from: 'initial', to: 'error', on: 'TASK_FAILED' },
          { from: 'initial', to: 'completed', on: 'TASK_COMPLETED' },
          { from: 'running', to: 'completed', on: 'TASK_COMPLETED' },
          { from: 'running', to: 'error', on: 'TASK_FAILED' },
          { from: 'error', to: 'running', on: 'START' },
          { from: 'error', to: 'error', on: 'TASK_FAILED' },
          { from: 'completed', to: 'running', on: 'START' },
          { from: 'completed', to: 'error', on: 'TASK_FAILED' },
          { from: '*', to: 'error', on: 'ERROR' }
        ],
        tasks: []
      }
    };
    this.taskDefinitions = taskDefinitions;
    this.processInstances = {};
    this.taskExecutions = {};
    this.logger = options.logger || DEFAULT_LOGGER;

    // Subscribe to events that trigger transitions
    this.eventBus.subscribe('START', (event) => {
      const { processId } = event.payload || {};
      if (processId) {
        try {
          this.transitionProcess(processId, 'START');
        } catch (error) {
          this.logger?.error(`Failed to transition process ${processId} on START event`, error);
        }
      }
    });

    this.eventBus.subscribe('COMPLETE', (event) => {
      const { processId } = event.payload || {};
      if (processId) {
        try {
          this.transitionProcess(processId, 'COMPLETE');
        } catch (error) {
          this.logger?.error(`Failed to transition process ${processId} on COMPLETE event`, error);
        }
      }
    });

    this.eventBus.subscribe('TASK_COMPLETED', (event) => {
      const { processId } = event.payload || {};
      if (processId) {
        try {
          this.transitionProcess(processId, 'TASK_COMPLETED');
        } catch (error) {
          this.logger?.error(`Failed to transition process ${processId} on TASK_COMPLETED event`, error);
        }
      }
    });

    this.eventBus.subscribe('TASK_FAILED', (event) => {
      const { processId } = event.payload || {};
      if (processId) {
        try {
          this.transitionProcess(processId, 'TASK_FAILED');
        } catch (error) {
          this.logger?.error(`Failed to transition process ${processId} on TASK_FAILED event`, error);
        }
      }
    });
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
   * Cancel a task execution
   */
  async cancelTask(executionId: string): Promise<void> {
    const taskExecution = this.taskExecutions[executionId];
    if (!taskExecution) {
      throw new Error(`Task execution ${executionId} not found`);
    }

    // Get task definition
    const taskDefinition = this.taskDefinitions[taskExecution.taskId];
    if (!taskDefinition) {
      throw new Error(`Task definition ${taskExecution.taskId} not found`);
    }

    // First, cancel any running dependencies
    if (taskDefinition.dependencies) {
      const dependencyExecutions = Object.values(this.taskExecutions).filter(
        e => taskDefinition.dependencies!.includes(e.taskId) && 
            e.status === 'running' &&
            e.id !== executionId
      );

      // Cancel all dependencies first
      await Promise.all(dependencyExecutions.map(dep => this.cancelTask(dep.id)));
    }

    // Now cancel the task itself
    if (taskExecution.status === 'running' || taskExecution.status === 'pending') {
      taskExecution.status = 'cancelled';
      taskExecution.endTime = new Date();
      taskExecution.error = 'Task was cancelled';
      this.taskExecutions[taskExecution.id] = taskExecution;

      // Publish task cancelled event
      this.eventBus.publish('TASK_CANCELLED', {
        executionId: taskExecution.id,
        taskId: taskExecution.taskId,
        processId: taskExecution.processId,
        error: 'Task was cancelled'
      });

      // Transition process to cancelled state if it exists
      if (taskExecution.processId) {
        try {
          this.transitionProcess(taskExecution.processId, 'TASK_CANCELLED');
        } catch (error) {
          this.logger?.error(`Failed to transition process ${taskExecution.processId} to cancelled state`, error);
        }
      }
    }
  }

  /**
   * Execute a task with dependency tracking and cancellation support
   */
  async executeTask(taskId: string, input: Record<string, any>, executionPath: string[] = []): Promise<any> {
    const taskDefinition = this.taskDefinitions[taskId];
    if (!taskDefinition) {
      throw new Error(`Task definition not found: ${taskId}`);
    }

    // Check for circular dependencies
    if (executionPath.includes(taskId)) {
      const cycle = [...executionPath, taskId];
      throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }

    // Add current task to execution path
    executionPath.push(taskId);

    // Get or create process instance
    let processId: string;
    if (input.processId) {
      processId = input.processId;
    } else {
      // Create a process definition for this task if it doesn't exist
      if (!this.processDefinitions[taskId]) {
        this.processDefinitions[taskId] = {
          id: taskId,
          name: `Process for ${taskId}`,
          description: `Process for executing task ${taskId}`,
          initialState: 'initial',
          transitions: [
            { from: 'initial', to: 'processing', on: 'START' },
            { from: 'processing', to: 'completed', on: 'TASK_COMPLETED' },
            { from: 'processing', to: 'error', on: 'TASK_FAILED' },
            { from: '*', to: 'cancelled', on: 'TASK_CANCELLED' }
          ],
          tasks: [taskDefinition]
        };
      }
      const process = this.createProcess(taskId, input);
      processId = process.id;
      this.transitionProcess(processId, 'START');
    }

    // Create task execution record
    const executionId = uuidv4();
    const taskExecution: TaskExecution = {
      id: executionId,
      taskId,
      processId,
      status: 'pending',
      startTime: new Date(),
      input,
      result: undefined,
      error: undefined,
      retryCount: 0
    };

    // Store task execution
    this.taskExecutions[taskExecution.id] = taskExecution;

    // Create task context
    const context: TaskContext = {
      taskId,
      processId,
      input,
      eventBus: this.eventBus,
      logger: this.logger || {
        info: (message: string) => console.log(`[INFO] ${message}`),
        warn: (message: string) => console.warn(`[WARN] ${message}`),
        error: (message: string) => console.error(`[ERROR] ${message}`)
      },
      emitEvent: (type: string, payload: any) => this.eventBus.publish(type, payload),
      isCancelled: () => this.taskExecutions[taskExecution.id]?.status === 'cancelled',
      getTaskResult: async (depTaskId: string) => {
        // Check if task is cancelled before getting dependency result
        if (context.isCancelled()) {
          throw new Error('Task was cancelled');
        }

        // Check for circular dependencies
        if (executionPath.includes(depTaskId)) {
          const cycle = [...executionPath, depTaskId];
          throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
        }

        // Execute dependency if not already executed
        const depExecution = await this.executeTask(depTaskId, { ...input, processId }, [...executionPath, taskId]);
        
        // Wait for the dependency to complete and return its result
        if (depExecution.status === 'completed' && depExecution.result) {
          return depExecution.result;
        } else if (depExecution.status === 'cancelled') {
          throw new Error('Dependency task was cancelled');
        } else if (depExecution.status === 'failed') {
          throw new Error('Dependency task failed');
        } else if (depExecution.status === 'running' || depExecution.status === 'pending') {
          // Wait for the dependency to complete
          return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
              const updatedExecution = this.taskExecutions[depExecution.id];
              if (!updatedExecution) {
                clearInterval(checkInterval);
                reject(new Error('Dependency task execution not found'));
                return;
              }

              if (updatedExecution.status === 'completed' && updatedExecution.result) {
                clearInterval(checkInterval);
                resolve(updatedExecution.result);
              } else if (updatedExecution.status === 'cancelled') {
                clearInterval(checkInterval);
                reject(new Error('Dependency task was cancelled'));
              } else if (updatedExecution.status === 'failed') {
                clearInterval(checkInterval);
                reject(new Error('Dependency task failed'));
              }
            }, 1); // Check every 1ms for maximum responsiveness
          });
        } else {
          throw new Error(`Unexpected dependency task status: ${depExecution.status}`);
        }
      }
    };

    let lastError: Error | null = null;
    const maxRetries = taskDefinition.maxRetries || 3;
    const retryDelay = taskDefinition.retryDelay || 1000;

    try {
      while (taskExecution.retryCount < maxRetries) {
        try {
          // Check if task is cancelled before starting execution
          if (context.isCancelled()) {
            taskExecution.status = 'cancelled';
            taskExecution.endTime = new Date();
            taskExecution.error = 'Task was cancelled';
            this.taskExecutions[taskExecution.id] = taskExecution;

            // Publish task cancelled event
            this.eventBus.publish('TASK_CANCELLED', {
              executionId: taskExecution.id,
              taskId,
              processId,
              error: 'Task was cancelled'
            });

            // Transition process to cancelled state
            if (processId) {
              try {
                this.transitionProcess(processId, 'TASK_CANCELLED');
              } catch (error) {
                this.logger?.error(`Failed to transition process ${processId} to cancelled state`, error);
              }
            }

            throw new Error('Task was cancelled');
          }

          // Update status to running before starting execution
          taskExecution.status = 'running';
          this.taskExecutions[taskExecution.id] = taskExecution;

          // Execute task handler with cancellation check
          const handlerPromise = taskDefinition.handler(context);
          
          // Create a cancellation check promise that resolves when cancelled
          const cancellationPromise = new Promise((_, reject) => {
            // Check immediately if already cancelled
            if (context.isCancelled()) {
              reject(new Error('Task was cancelled'));
              return;
            }

            // Set up cancellation watcher
            const checkInterval = setInterval(() => {
              if (context.isCancelled()) {
                clearInterval(checkInterval);
                reject(new Error('Task was cancelled'));
              }
            }, 1); // Check every 1ms for maximum responsiveness

            // Clean up interval when handler completes
            handlerPromise.finally(() => clearInterval(checkInterval));
          });

          try {
            // Race between handler and cancellation
            const result = await Promise.race([
              handlerPromise,
              cancellationPromise
            ]);

            // Final cancellation check before completing
            if (context.isCancelled()) {
              taskExecution.status = 'cancelled';
              taskExecution.endTime = new Date();
              taskExecution.error = 'Task was cancelled';
              this.taskExecutions[taskExecution.id] = taskExecution;

              // Publish task cancelled event
              this.eventBus.publish('TASK_CANCELLED', {
                executionId: taskExecution.id,
                taskId,
                processId,
                error: 'Task was cancelled'
              });

              // Transition process to cancelled state
              if (processId) {
                try {
                  this.transitionProcess(processId, 'TASK_CANCELLED');
                } catch (error) {
                  this.logger?.error(`Failed to transition process ${processId} to cancelled state`, error);
                }
              }

              throw new Error('Task was cancelled');
            }

            // Update execution record with success
            taskExecution.status = 'completed';
            taskExecution.endTime = new Date();
            taskExecution.result = result;
            this.taskExecutions[taskExecution.id] = taskExecution;

            // Only transition process if it's not already in completed state
            const process = this.processInstances[processId];
            if (process && process.currentState !== 'completed') {
              this.transitionProcess(processId, 'TASK_COMPLETED');
            }

            // Return just the result
            return result;
          } catch (error) {
            if (error instanceof Error && error.message === 'Task was cancelled') {
              taskExecution.status = 'cancelled';
              taskExecution.endTime = new Date();
              taskExecution.error = error.message;
              this.taskExecutions[taskExecution.id] = taskExecution;

              // Publish task cancelled event
              this.eventBus.publish('TASK_CANCELLED', {
                executionId: taskExecution.id,
                taskId,
                processId,
                error: error.message
              });

              // Transition process to cancelled state
              if (processId) {
                try {
                  this.transitionProcess(processId, 'TASK_CANCELLED');
                } catch (error) {
                  this.logger?.error(`Failed to transition process ${processId} to cancelled state`, error);
                }
              }

              throw error;
            }
            throw error;
          }
        } catch (error) {
          lastError = error as Error;
          taskExecution.retryCount++;
          taskExecution.error = lastError.message;

          if (error instanceof Error && (error.message === 'Task was cancelled' || error.message.includes('Circular dependency'))) {
            throw error; // Don't retry cancelled tasks or circular dependencies
          }

          if (taskExecution.retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }

          // Update execution record with failure
          taskExecution.status = 'failed';
          taskExecution.endTime = new Date();
          this.taskExecutions[taskExecution.id] = taskExecution;

          // Publish task failed event
          this.eventBus.publish('TASK_FAILED', {
            executionId: taskExecution.id,
            taskId,
            processId,
            error: lastError.message
          });

          // Transition process to error state
          if (processId) {
            try {
              this.transitionProcess(processId, 'TASK_FAILED');
            } catch (error) {
              this.logger?.error(`Failed to transition process ${processId} to error state`, error);
            }
          }

          throw lastError;
        }
      }

      throw lastError || new Error('Task failed after retries');
    } finally {
      // Remove task from execution path
      executionPath.pop();
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
  options?: RuntimeOptions
): Runtime {
  return new ReactiveRuntime(processDefinitions, taskDefinitions, options);
}
