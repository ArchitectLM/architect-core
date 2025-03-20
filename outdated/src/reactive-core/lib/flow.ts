/**
 * Flow Engine
 * 
 * This module provides an implementation of the flow engine for the reactive system.
 * The flow engine is responsible for executing flows and managing their state.
 */

import { EventBus } from '../types/events';
import { Flow, FlowExecutionOptions, FlowExecutionResult, FlowExecutionTrace, FlowStep } from '../types/flows';
import { TaskImplementation, TaskResult } from '../types/tasks';

/**
 * Flow engine implementation
 */
export class ReactiveFlowEngine {
  /**
   * Flow definitions
   */
  private flows: Map<string, Flow> = new Map();
  
  /**
   * Task implementations
   */
  private taskImplementations: Map<string, TaskImplementation> = new Map();
  
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Default execution options
   */
  private defaultOptions: FlowExecutionOptions = {
    timeout: 30000,
    continueOnError: false,
    trace: false
  };
  
  /**
   * Constructor
   * @param eventBus Event bus
   */
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Register a flow
   * @param flow Flow definition
   */
  registerFlow(flow: Flow): void {
    this.flows.set(flow.id, flow);
    console.log(`[FlowEngine] Registered flow: ${flow.id}`);
  }
  
  /**
   * Register a task implementation
   * @param taskImpl Task implementation
   */
  registerTaskImplementation(taskImpl: TaskImplementation): void {
    this.taskImplementations.set(taskImpl.taskId, taskImpl);
    console.log(`[FlowEngine] Registered task implementation: ${taskImpl.taskId}`);
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
    // Get the flow
    const flow = this.flows.get(flowId);
    if (!flow) {
      return {
        success: false,
        error: `Flow not found: ${flowId}`
      };
    }
    
    // Merge options with defaults
    const execOptions: FlowExecutionOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    // Initialize execution context
    const context = {
      flowId,
      input,
      output: {},
      variables: {},
      currentStepId: null as string | null,
      trace: [] as FlowExecutionTrace[]
    };
    
    // Emit flow started event
    this.eventBus.emit({
      type: 'FLOW_STARTED',
      payload: {
        flowId,
        input
      }
    });
    
    try {
      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | null = null;
      if (execOptions.timeout) {
        timeoutId = setTimeout(() => {
          throw new Error(`Flow execution timed out after ${execOptions.timeout}ms`);
        }, execOptions.timeout);
      }
      
      // Find the first step
      const firstStep = flow.steps[0];
      if (!firstStep) {
        throw new Error(`Flow has no steps: ${flowId}`);
      }
      
      // Execute the flow
      const result = await this.executeStep(flow, firstStep.id, context, execOptions);
      
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Emit flow completed event
      this.eventBus.emit({
        type: 'FLOW_COMPLETED',
        payload: {
          flowId,
          success: result.success,
          output: result.output
        }
      });
      
      // Return the result
      return {
        success: result.success,
        output: result.output as TOutput,
        error: result.error,
        trace: execOptions.trace ? context.trace : undefined
      };
    } catch (error) {
      // Emit flow failed event
      this.eventBus.emit({
        type: 'FLOW_FAILED',
        payload: {
          flowId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      // Return the error
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        trace: execOptions.trace ? context.trace : undefined
      };
    }
  }
  
  /**
   * Execute a step
   * @param flow Flow definition
   * @param stepId Step ID
   * @param context Execution context
   * @param options Flow execution options
   * @returns Step execution result
   */
  private async executeStep(
    flow: Flow,
    stepId: string,
    context: any,
    options: FlowExecutionOptions
  ): Promise<TaskResult> {
    // Find the step
    const step = flow.steps.find(s => s.id === stepId);
    if (!step) {
      return {
        success: false,
        error: `Step not found: ${stepId}`
      };
    }
    
    // Update current step
    context.currentStepId = stepId;
    
    // Emit step started event
    this.eventBus.emit({
      type: 'FLOW_STEP_STARTED',
      payload: {
        flowId: flow.id,
        stepId,
        stepType: step.type
      }
    });
    
    // Initialize trace if enabled
    let trace: FlowExecutionTrace | null = null;
    if (options.trace) {
      trace = {
        stepId,
        stepName: step.name,
        stepType: step.type,
        startTime: Date.now(),
        endTime: 0,
        input: null,
        output: null
      };
      context.trace.push(trace);
    }
    
    try {
      // Execute the step based on its type
      let result: TaskResult;
      
      switch (step.type) {
        case 'task':
          result = await this.executeTaskStep(flow, step, context, options);
          break;
        
        case 'condition':
          result = await this.executeConditionStep(flow, step, context, options);
          break;
        
        case 'parallel':
          result = await this.executeParallelStep(flow, step, context, options);
          break;
        
        case 'wait':
          result = await this.executeWaitStep(flow, step, context, options);
          break;
        
        default:
          result = {
            success: false,
            error: `Unsupported step type: ${step.type}`
          };
      }
      
      // Update trace if enabled
      if (trace) {
        trace.endTime = Date.now();
        trace.output = result.output;
      }
      
      // Emit step completed event
      this.eventBus.emit({
        type: 'FLOW_STEP_COMPLETED',
        payload: {
          flowId: flow.id,
          stepId,
          success: result.success,
          output: result.output
        }
      });
      
      // If the step failed and we're not continuing on error, return the error
      if (!result.success && !options.continueOnError) {
        return result;
      }
      
      // If the step has a next step, execute it
      if (step.next) {
        return this.executeStep(flow, step.next, context, options);
      }
      
      // Otherwise, return the result
      return result;
    } catch (error) {
      // Update trace if enabled
      if (trace) {
        trace.endTime = Date.now();
        trace.error = error instanceof Error ? error.message : String(error);
      }
      
      // Emit step failed event
      this.eventBus.emit({
        type: 'FLOW_STEP_FAILED',
        payload: {
          flowId: flow.id,
          stepId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      // If we're continuing on error, execute the next step if there is one
      if (options.continueOnError && step.next) {
        return this.executeStep(flow, step.next, context, options);
      }
      
      // Otherwise, return the error
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Execute a task step
   * @param flow Flow definition
   * @param step Step definition
   * @param context Execution context
   * @param options Flow execution options
   * @returns Task execution result
   */
  private async executeTaskStep(
    flow: Flow,
    step: FlowStep,
    context: any,
    options: FlowExecutionOptions
  ): Promise<TaskResult> {
    // Check if the step has a task ID
    if (!step.taskId) {
      return {
        success: false,
        error: `Task step has no task ID: ${step.id}`
      };
    }
    
    // Get the task implementation
    const taskImpl = this.taskImplementations.get(step.taskId);
    if (!taskImpl) {
      return {
        success: false,
        error: `Task implementation not found: ${step.taskId}`
      };
    }
    
    // Prepare the input
    const input = this.prepareStepInput(step, context);
    
    // Update trace if enabled
    if (options.trace) {
      const trace = context.trace.find((t: FlowExecutionTrace) => t.stepId === step.id);
      if (trace) {
        trace.input = input;
      }
    }
    
    // Execute the task
    const result = await taskImpl.execute(input);
    
    // If the step has an output mapping, map the output to the context
    if (step.outputMapping && result.success) {
      this.mapStepOutput(step, result.output, context);
    }
    
    return result;
  }
  
  /**
   * Execute a condition step
   * @param flow Flow definition
   * @param step Step definition
   * @param context Execution context
   * @param options Flow execution options
   * @returns Condition execution result
   */
  private async executeConditionStep(
    flow: Flow,
    step: FlowStep,
    context: any,
    options: FlowExecutionOptions
  ): Promise<TaskResult> {
    // Check if the step has a condition
    if (!step.condition) {
      return {
        success: false,
        error: `Condition step has no condition: ${step.id}`
      };
    }
    
    // Prepare the input
    const input = this.prepareStepInput(step, context);
    
    // Update trace if enabled
    if (options.trace) {
      const trace = context.trace.find((t: FlowExecutionTrace) => t.stepId === step.id);
      if (trace) {
        trace.input = input;
      }
    }
    
    // Evaluate the condition
    let conditionResult: boolean;
    try {
      // Use Function constructor to evaluate the condition
      const conditionFn = new Function('input', 'context', `return ${step.condition}`);
      conditionResult = conditionFn(input, context);
    } catch (error) {
      return {
        success: false,
        error: `Error evaluating condition: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    
    // Determine the next steps based on the condition result
    const nextSteps = conditionResult
      ? step.trueBranch
      : step.falseBranch;
    
    // If there are no next steps, return success
    if (!nextSteps || nextSteps.length === 0) {
      return {
        success: true,
        output: { conditionResult }
      };
    }
    
    // Execute the next steps
    let result: TaskResult = {
      success: true,
      output: { conditionResult }
    };
    
    for (const nextStepId of nextSteps) {
      result = await this.executeStep(flow, nextStepId, context, options);
      
      // If the step failed and we're not continuing on error, return the error
      if (!result.success && !options.continueOnError) {
        return result;
      }
    }
    
    return result;
  }
  
  /**
   * Execute a parallel step
   * @param flow Flow definition
   * @param step Step definition
   * @param context Execution context
   * @param options Flow execution options
   * @returns Parallel execution result
   */
  private async executeParallelStep(
    flow: Flow,
    step: FlowStep,
    context: any,
    options: FlowExecutionOptions
  ): Promise<TaskResult> {
    // Check if the step has branches
    if (!step.branches || step.branches.length === 0) {
      return {
        success: false,
        error: `Parallel step has no branches: ${step.id}`
      };
    }
    
    // Prepare the input
    const input = this.prepareStepInput(step, context);
    
    // Update trace if enabled
    if (options.trace) {
      const trace = context.trace.find((t: FlowExecutionTrace) => t.stepId === step.id);
      if (trace) {
        trace.input = input;
      }
    }
    
    // Execute each branch in parallel
    const branchPromises = step.branches.map(async (branch, index) => {
      // Create a branch context
      const branchContext = {
        ...context,
        branchIndex: index,
        trace: options.trace ? [] : undefined
      };
      
      // Execute the branch
      let branchResult: TaskResult = {
        success: true,
        output: {}
      };
      
      for (const stepId of branch) {
        branchResult = await this.executeStep(flow, stepId, branchContext, options);
        
        // If the step failed and we're not continuing on error, return the error
        if (!branchResult.success && !options.continueOnError) {
          return branchResult;
        }
      }
      
      // If trace is enabled, add the branch trace to the main trace
      if (options.trace && branchContext.trace) {
        context.trace.push(...branchContext.trace);
      }
      
      return branchResult;
    });
    
    // Wait for all branches to complete
    const branchResults = await Promise.all(branchPromises);
    
    // Check if any branch failed
    const failedBranch = branchResults.find(result => !result.success);
    if (failedBranch && !options.continueOnError) {
      return failedBranch;
    }
    
    // Combine the branch outputs
    const output = branchResults.reduce((acc, result, index) => {
      if (result.success && result.output) {
        acc[`branch${index}`] = result.output;
      }
      return acc;
    }, {} as Record<string, any>);
    
    return {
      success: true,
      output
    };
  }
  
  /**
   * Execute a wait step
   * @param flow Flow definition
   * @param step Step definition
   * @param context Execution context
   * @param options Flow execution options
   * @returns Wait execution result
   */
  private async executeWaitStep(
    flow: Flow,
    step: FlowStep,
    context: any,
    options: FlowExecutionOptions
  ): Promise<TaskResult> {
    // Check if the step has a wait time
    if (!step.waitTime) {
      return {
        success: false,
        error: `Wait step has no wait time: ${step.id}`
      };
    }
    
    // Prepare the input
    const input = this.prepareStepInput(step, context);
    
    // Update trace if enabled
    if (options.trace) {
      const trace = context.trace.find((t: FlowExecutionTrace) => t.stepId === step.id);
      if (trace) {
        trace.input = input;
      }
    }
    
    // Wait for the specified time
    await new Promise(resolve => setTimeout(resolve, step.waitTime));
    
    return {
      success: true,
      output: { waited: step.waitTime }
    };
  }
  
  /**
   * Prepare step input
   * @param step Step definition
   * @param context Execution context
   * @returns Step input
   */
  private prepareStepInput(step: FlowStep, context: any): any {
    // If the step has an input mapping, map the input
    if (step.inputMapping) {
      const input: Record<string, any> = {};
      
      // Process each input mapping
      for (const [key, value] of Object.entries(step.inputMapping)) {
        // If the value starts and ends with quotes, it's a literal
        if (value.startsWith('"') && value.endsWith('"')) {
          input[key] = JSON.parse(value);
        } else {
          // Otherwise, it's a path to a value in the context
          const path = value.split('.');
          let currentValue = path[0] === 'input' ? context.input : context.variables;
          
          // Navigate the path
          for (let i = path[0] === 'input' ? 1 : 0; i < path.length; i++) {
            if (currentValue === undefined || currentValue === null) {
              break;
            }
            currentValue = currentValue[path[i]];
          }
          
          input[key] = currentValue;
        }
      }
      
      return input;
    }
    
    // Otherwise, use the flow input
    return context.input;
  }
  
  /**
   * Map step output
   * @param step Step definition
   * @param output Step output
   * @param context Execution context
   */
  private mapStepOutput(step: FlowStep, output: any, context: any): void {
    // If the step has an output mapping, map the output
    if (step.outputMapping) {
      // Process each output mapping
      for (const [key, value] of Object.entries(step.outputMapping)) {
        // Get the output value
        const outputValue = output[key];
        
        // If the value is a path to a variable, set the variable
        if (value.startsWith('variables.')) {
          const path = value.split('.');
          let currentObj = context.variables;
          
          // Navigate the path
          for (let i = 1; i < path.length - 1; i++) {
            if (currentObj[path[i]] === undefined) {
              currentObj[path[i]] = {};
            }
            currentObj = currentObj[path[i]];
          }
          
          // Set the value
          currentObj[path[path.length - 1]] = outputValue;
        } else if (value === 'output') {
          // If the value is 'output', set the flow output
          context.output = outputValue;
        } else if (value.startsWith('output.')) {
          // If the value is a path to the output, set the output property
          const path = value.split('.');
          let currentObj = context.output;
          
          // Navigate the path
          for (let i = 1; i < path.length - 1; i++) {
            if (currentObj[path[i]] === undefined) {
              currentObj[path[i]] = {};
            }
            currentObj = currentObj[path[i]];
          }
          
          // Set the value
          currentObj[path[path.length - 1]] = outputValue;
        }
      }
    } else {
      // Otherwise, set the flow output to the step output
      context.output = output;
    }
  }
}