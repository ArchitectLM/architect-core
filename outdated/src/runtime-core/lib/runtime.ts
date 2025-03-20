/**
 * Reactive System Runtime Core
 * 
 * This module provides the core functionality for executing reactive systems
 * defined using a DSL. It supports:
 * - Loading system definitions
 * - Managing process states
 * - Executing tasks with retry and timeout
 * - Handling events
 * - Executing flows with parallel and conditional steps
 * - Error handling and recovery
 */

import type { ReactiveSystem, Process, Task } from '../../schema/types';
import {
  TaskImplementation,
  EventHandler,
  TaskExecutionOptions,
  TaskExecutionResult,
  Flow,
  FlowStep,
  FlowStepType,
  FlowExecutionOptions,
  FlowExecutionResult,
  RuntimeOptions,
  RuntimeEvent
} from '../types';

/**
 * Default task execution options
 */
const DEFAULT_TASK_EXECUTION_OPTIONS: TaskExecutionOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffFactor: 2,
  timeout: 30000
};

/**
 * Default flow execution options
 */
const DEFAULT_FLOW_EXECUTION_OPTIONS: FlowExecutionOptions = {
  continueOnError: false,
  maxParallelExecutions: 5,
  taskExecutionOptions: DEFAULT_TASK_EXECUTION_OPTIONS
};

/**
 * Reactive System Runtime
 */
export class ReactiveSystemRuntime {
  private system: ReactiveSystem;
  private processStates: Record<string, string>;
  private taskImplementations: Record<string, TaskImplementation>;
  private eventHandlers: Record<string, EventHandler[]>;
  private flows: Record<string, Flow>;
  private options: RuntimeOptions;

  /**
   * Creates a new instance of the ReactiveSystemRuntime
   * 
   * @param system The reactive system definition
   * @param options Runtime options
   */
  constructor(system: ReactiveSystem, options: RuntimeOptions = {}) {
    this.system = system;
    this.processStates = {};
    this.taskImplementations = {};
    this.eventHandlers = {};
    this.flows = {};
    this.options = options;

    // Initialize process states
    if (system.processes) {
      for (const processId in system.processes) {
        const process = system.processes[processId];
        if (process.states && process.states.length > 0) {
          this.processStates[process.id] = process.states[0]; // Use first state as initial state
        }
      }
    }
  }

  /**
   * Gets the system ID
   * 
   * @returns The system ID
   */
  getSystemId(): string {
    return this.system.id;
  }

  /**
   * Gets the system version
   * 
   * @returns The system version
   */
  getSystemVersion(): string {
    return this.system.version;
  }

  /**
   * Checks if a process exists
   * 
   * @param processId The process ID
   * @returns Whether the process exists
   */
  hasProcess(processId: string): boolean {
    return this.system.processes ? processId in this.system.processes : false;
  }

  /**
   * Checks if a task exists
   * 
   * @param taskId The task ID
   * @returns Whether the task exists
   */
  hasTask(taskId: string): boolean {
    return this.system.tasks ? taskId in this.system.tasks : false;
  }

  /**
   * Checks if a flow exists
   * 
   * @param flowId The flow ID
   * @returns Whether the flow exists
   */
  hasFlow(flowId: string): boolean {
    return flowId in this.flows;
  }

  /**
   * Gets the current state of a process
   * 
   * @param processId The process ID
   * @returns The current state of the process
   * @throws Error if the process does not exist
   */
  getProcessState(processId: string): string {
    if (!this.hasProcess(processId)) {
      throw new Error(`Process ${processId} does not exist`);
    }

    return this.processStates[processId];
  }

  /**
   * Gets all process states
   * 
   * @returns All process states
   */
  getAllProcessStates(): Record<string, string> {
    return { ...this.processStates };
  }

  /**
   * Registers a task implementation
   * 
   * @param taskId The task ID
   * @param implementation The task implementation
   * @throws Error if the task does not exist
   */
  registerTaskImplementation(taskId: string, implementation: TaskImplementation): void {
    if (!this.hasTask(taskId)) {
      throw new Error(`Task ${taskId} does not exist`);
    }

    this.taskImplementations[taskId] = implementation;
  }

  /**
   * Registers multiple task implementations
   * 
   * @param implementations The task implementations
   */
  registerTaskImplementations(implementations: Record<string, TaskImplementation>): void {
    for (const [taskId, implementation] of Object.entries(implementations)) {
      this.registerTaskImplementation(taskId, implementation);
    }
  }

  /**
   * Registers a flow
   * 
   * @param flow The flow definition
   */
  registerFlow(flow: Flow): void {
    this.flows[flow.id] = flow;
  }

  /**
   * Registers multiple flows
   * 
   * @param flows The flow definitions
   */
  registerFlows(flows: Flow[]): void {
    for (const flow of flows) {
      this.registerFlow(flow);
    }
  }

  /**
   * Executes a task
   * 
   * @param taskId The task ID
   * @param input The task input
   * @param options Task execution options
   * @returns The task execution result
   * @throws Error if the task does not exist or has no implementation
   */
  async executeTask(
    taskId: string,
    input: any,
    options: TaskExecutionOptions = {}
  ): Promise<TaskExecutionResult> {
    if (!this.hasTask(taskId)) {
      throw new Error(`Task ${taskId} does not exist`);
    }

    if (!this.taskImplementations[taskId]) {
      throw new Error(`Task ${taskId} has no implementation`);
    }

    const mergedOptions = {
      ...DEFAULT_TASK_EXECUTION_OPTIONS,
      ...this.options.taskExecutionOptions,
      ...options
    };

    const startTime = Date.now();
    let retries = 0;
    let success = false;
    let output: any;
    let error: string | undefined;

    this.emitEvent(RuntimeEvent.TASK_STARTED, { taskId, input });

    while (retries <= mergedOptions.maxRetries!) {
      try {
        // Execute the task with timeout
        output = await this.executeWithTimeout(
          () => this.taskImplementations[taskId](input),
          mergedOptions.timeout!
        );
        success = true;
        break;
      } catch (err) {
        retries++;
        error = err instanceof Error ? err.message : String(err);

        if (retries <= mergedOptions.maxRetries!) {
          this.emitEvent(RuntimeEvent.TASK_RETRYING, {
            taskId,
            error,
            retries,
            maxRetries: mergedOptions.maxRetries
          });

          // Wait before retrying
          const delay = mergedOptions.retryDelay! * Math.pow(mergedOptions.retryBackoffFactor!, retries - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const result: TaskExecutionResult = {
      taskId,
      output,
      success,
      error,
      retries,
      executionTime
    };

    if (success) {
      this.emitEvent(RuntimeEvent.TASK_COMPLETED, result);
    } else {
      this.emitEvent(RuntimeEvent.TASK_FAILED, result);
    }

    return result;
  }

  /**
   * Executes a flow
   * 
   * @param flowId The flow ID
   * @param input The flow input
   * @param options Flow execution options
   * @returns The flow execution result
   * @throws Error if the flow does not exist
   */
  async executeFlow(
    flowId: string,
    input: any,
    options: FlowExecutionOptions = {}
  ): Promise<FlowExecutionResult> {
    if (!this.hasFlow(flowId)) {
      throw new Error(`Flow ${flowId} does not exist`);
    }

    const flow = this.flows[flowId];
    const mergedOptions = {
      ...DEFAULT_FLOW_EXECUTION_OPTIONS,
      ...this.options.flowExecutionOptions,
      ...options
    };

    const startTime = Date.now();
    const stepResults: Record<string, TaskExecutionResult> = {};
    let success = true;
    let error: string | undefined;

    this.emitEvent(RuntimeEvent.FLOW_STARTED, { flowId, input });

    try {
      // Execute flow steps
      const output = await this.executeFlowSteps(
        flow.steps,
        input,
        stepResults,
        mergedOptions
      );

      const executionTime = Date.now() - startTime;
      const result: FlowExecutionResult = {
        flowId,
        success,
        stepResults,
        output,
        executionTime
      };

      this.emitEvent(RuntimeEvent.FLOW_COMPLETED, result);
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);

      const executionTime = Date.now() - startTime;
      const result: FlowExecutionResult = {
        flowId,
        success,
        stepResults,
        output: null,
        error,
        executionTime
      };

      this.emitEvent(RuntimeEvent.FLOW_FAILED, result);
      return result;
    }
  }

  /**
   * Executes flow steps
   * 
   * @param steps The flow steps
   * @param flowInput The flow input
   * @param stepResults The step results
   * @param options Flow execution options
   * @returns The output of the last step
   */
  private async executeFlowSteps(
    steps: FlowStep[],
    flowInput: any,
    stepResults: Record<string, TaskExecutionResult>,
    options: FlowExecutionOptions
  ): Promise<any> {
    let output: any = null;

    for (const step of steps) {
      this.emitEvent(RuntimeEvent.FLOW_STEP_STARTED, { stepId: step.id, flowInput });

      try {
        switch (step.type) {
          case FlowStepType.TASK:
            output = await this.executeTaskStep(step, flowInput, stepResults, options);
            break;
          case FlowStepType.PARALLEL:
            output = await this.executeParallelStep(step, flowInput, stepResults, options);
            break;
          case FlowStepType.CONDITION:
            output = await this.executeConditionStep(step, flowInput, stepResults, options);
            break;
          case FlowStepType.WAIT:
            output = await this.executeWaitStep(step);
            break;
          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        this.emitEvent(RuntimeEvent.FLOW_STEP_COMPLETED, {
          stepId: step.id,
          output
        });
      } catch (err) {
        this.emitEvent(RuntimeEvent.FLOW_STEP_FAILED, {
          stepId: step.id,
          error: err instanceof Error ? err.message : String(err)
        });

        if (!options.continueOnError) {
          throw err;
        }
      }
    }

    return output;
  }

  /**
   * Executes a task step
   * 
   * @param step The task step
   * @param flowInput The flow input
   * @param stepResults The step results
   * @param options Flow execution options
   * @returns The task output
   */
  private async executeTaskStep(
    step: FlowStep,
    flowInput: any,
    stepResults: Record<string, TaskExecutionResult>,
    options: FlowExecutionOptions
  ): Promise<any> {
    if (!step.taskId) {
      throw new Error(`Task step ${step.id} has no task ID`);
    }

    // Map input
    const previousOutputs = this.getPreviousOutputs(stepResults);
    const taskInput = step.inputMapping
      ? step.inputMapping(flowInput, previousOutputs)
      : flowInput;

    // Execute task
    const result = await this.executeTask(
      step.taskId,
      taskInput,
      {
        ...options.taskExecutionOptions,
        ...step.executionOptions
      }
    );

    stepResults[step.id] = result;

    if (!result.success) {
      throw new Error(`Task ${step.taskId} failed: ${result.error}`);
    }

    // Map output
    return step.outputMapping
      ? step.outputMapping(result.output)
      : result.output;
  }

  /**
   * Executes a parallel step
   * 
   * @param step The parallel step
   * @param flowInput The flow input
   * @param stepResults The step results
   * @param options Flow execution options
   * @returns The outputs of all parallel steps
   */
  private async executeParallelStep(
    step: FlowStep,
    flowInput: any,
    stepResults: Record<string, TaskExecutionResult>,
    options: FlowExecutionOptions
  ): Promise<any[]> {
    if (!step.parallelSteps || step.parallelSteps.length === 0) {
      throw new Error(`Parallel step ${step.id} has no parallel steps`);
    }

    // Execute parallel steps with concurrency limit
    const parallelSteps = step.parallelSteps;
    const concurrencyLimit = options.maxParallelExecutions!;
    const results: any[] = [];

    // Process steps in batches based on concurrency limit
    for (let i = 0; i < parallelSteps.length; i += concurrencyLimit) {
      const batch = parallelSteps.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (parallelStep) => {
        const parallelStepResults: Record<string, TaskExecutionResult> = {};
        const result = await this.executeFlowSteps(
          [parallelStep],
          flowInput,
          parallelStepResults,
          options
        );
        
        // Merge step results
        Object.assign(stepResults, parallelStepResults);
        
        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Executes a condition step
   * 
   * @param step The condition step
   * @param flowInput The flow input
   * @param stepResults The step results
   * @param options Flow execution options
   * @returns The output of the executed branch
   */
  private async executeConditionStep(
    step: FlowStep,
    flowInput: any,
    stepResults: Record<string, TaskExecutionResult>,
    options: FlowExecutionOptions
  ): Promise<any> {
    if (!step.condition) {
      throw new Error(`Condition step ${step.id} has no condition`);
    }

    const previousOutputs = this.getPreviousOutputs(stepResults);
    const conditionResult = step.condition(flowInput, previousOutputs);

    if (conditionResult) {
      if (!step.thenSteps || step.thenSteps.length === 0) {
        return null;
      }
      return this.executeFlowSteps(step.thenSteps, flowInput, stepResults, options);
    } else {
      if (!step.elseSteps || step.elseSteps.length === 0) {
        return null;
      }
      return this.executeFlowSteps(step.elseSteps, flowInput, stepResults, options);
    }
  }

  /**
   * Executes a wait step
   * 
   * @param step The wait step
   * @returns null
   */
  private async executeWaitStep(step: FlowStep): Promise<null> {
    if (!step.waitTime || step.waitTime <= 0) {
      throw new Error(`Wait step ${step.id} has invalid wait time`);
    }

    await new Promise(resolve => setTimeout(resolve, step.waitTime));
    return null;
  }

  /**
   * Gets the outputs of previous steps
   * 
   * @param stepResults The step results
   * @returns The outputs of previous steps
   */
  private getPreviousOutputs(stepResults: Record<string, TaskExecutionResult>): Record<string, any> {
    const outputs: Record<string, any> = {};
    
    for (const [stepId, result] of Object.entries(stepResults)) {
      if (result.success) {
        outputs[stepId] = result.output;
      }
    }
    
    return outputs;
  }

  /**
   * Executes a function with a timeout
   * 
   * @param fn The function to execute
   * @param timeout The timeout in milliseconds
   * @returns The function result
   * @throws Error if the function times out
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);

      fn().then(
        (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }

  /**
   * Registers an event handler
   * 
   * @param event The event to handle
   * @param handler The event handler
   */
  registerEventHandler(event: string, handler: EventHandler): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }

    this.eventHandlers[event].push(handler);
  }

  /**
   * Emits an event
   * 
   * @param event The event to emit
   * @param payload The event payload
   */
  private emitEvent(event: string, payload: any): void {
    const handlers = this.eventHandlers[event] || [];
    
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  /**
   * Sends an event to the runtime
   * 
   * @param event The event to send
   * @param payload The event payload
   */
  sendEvent(event: string, payload: any): void {
    // Emit the event
    this.emitEvent(event, payload);

    // Handle process state transitions
    if (payload && payload.processId && this.hasProcess(payload.processId)) {
      const processId = payload.processId;
      const currentState = this.processStates[processId];
      
      // Find the process
      const process = this.system.processes?.[processId];
      
      if (process && process.transitions) {
        // Find a transition that matches the current state and event
        const transition = process.transitions.find(t => 
          t.from === currentState && t.on === event
        );
        
        if (transition) {
          this.handleProcessTransition(process, transition.to, payload);
        }
      }
    }
  }

  /**
   * Handles a process state transition
   * 
   * @param process The process
   * @param newState The new state
   * @param payload The event payload
   */
  private handleProcessTransition(process: Process, newState: string, payload: any): void {
    const oldState = this.processStates[process.id];
    
    // Update the process state
    this.processStates[process.id] = newState;
    
    // Emit a process state changed event
    this.emitEvent(RuntimeEvent.PROCESS_STATE_CHANGED, {
      processId: process.id,
      oldState,
      newState,
      payload
    });
  }
} 