import { Runtime } from '../models/runtime.js';
import { ProcessDefinition, TaskDefinition, ProcessInstance, TaskExecution, ProcessTransition, TaskContext } from '../models/index.js';
import { ExtensionSystem } from '../models/extension.js';
import { EventBus } from '../models/event.js';

export class RuntimeImpl implements Runtime {
  private processes: Map<string, ProcessInstance> = new Map();
  private processDefinitions: Map<string, ProcessDefinition>;
  private taskDefinitions: Map<string, TaskDefinition>;
  private extensionSystem: ExtensionSystem;
  private eventBus: EventBus;

  constructor(
    processDefinitions: Record<string, ProcessDefinition>,
    taskDefinitions: Record<string, TaskDefinition>,
    options: { extensionSystem: ExtensionSystem; eventBus: EventBus }
  ) {
    this.processDefinitions = new Map(Object.entries(processDefinitions));
    this.taskDefinitions = new Map(Object.entries(taskDefinitions));
    this.extensionSystem = options.extensionSystem;
    this.eventBus = options.eventBus;
  }

  async createProcess(processType: string, data: any): Promise<ProcessInstance> {
    const definition = this.processDefinitions.get(processType);
    if (!definition) {
      throw new Error(`Unknown process type: ${processType}`);
    }

    // Execute beforeCreate extension point
    const context = await this.extensionSystem.executeExtensionPoint('process:beforeCreate', {
      processType,
      data,
      definition
    });

    const process: ProcessInstance = {
      id: `process-${Date.now()}`,
      type: processType,
      state: definition.initialState,
      data: context.data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.processes.set(process.id, process);
    this.eventBus.publish('process:created', { processId: process.id, processType });

    return process;
  }

  async getProcess(processId: string): Promise<ProcessInstance | undefined> {
    return this.processes.get(processId);
  }

  async transitionProcess(processId: string, event: string): Promise<ProcessInstance> {
    const process = this.processes.get(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    const definition = this.processDefinitions.get(process.type);
    if (!definition) {
      throw new Error(`Process definition not found: ${process.type}`);
    }

    const transition = definition.transitions.find((t: ProcessTransition) => t.from === process.state && t.on === event);
    if (!transition) {
      throw new Error(`Invalid transition: ${process.state} -> ${event}`);
    }

    // Execute beforeTransition extension point
    const context = await this.extensionSystem.executeExtensionPoint('process:beforeTransition', {
      process,
      event,
      fromState: process.state,
      toState: transition.to,
      data: process.data
    });

    process.state = transition.to;
    process.updatedAt = Date.now();
    process.data = context.data;

    this.eventBus.publish('process:transitioned', {
      processId: process.id,
      fromState: transition.from,
      toState: transition.to,
      event
    });

    return process;
  }

  async executeTask(taskType: string, input: any): Promise<TaskExecution> {
    const definition = this.taskDefinitions.get(taskType);
    if (!definition) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    // Execute beforeExecution extension point
    const context = await this.extensionSystem.executeExtensionPoint('task:beforeExecution', {
      taskType,
      input,
      definition,
      skipExecution: false,
      result: undefined
    });

    // Check if execution should be skipped
    if (context.skipExecution) {
      return {
        id: `task-${Date.now()}`,
        type: taskType,
        input: context.input,
        result: context.result,
        status: 'completed',
        startedAt: Date.now(),
        completedAt: Date.now()
      };
    }

    const execution: TaskExecution = {
      id: `task-${Date.now()}`,
      type: taskType,
      input: context.input,
      status: 'running',
      startedAt: Date.now()
    };

    try {
      const result = await definition.handler(context);
      execution.result = result;
      execution.status = 'completed';
      execution.completedAt = Date.now();
    } catch (error) {
      execution.status = 'failed';
      execution.error = error;
      execution.completedAt = Date.now();
      throw error;
    }

    return execution;
  }

  subscribe(eventType: string, handler: (event: any) => void): void {
    this.eventBus.subscribe(eventType, handler);
  }

  unsubscribe(eventType: string, handler: (event: any) => void): void {
    this.eventBus.unsubscribe(eventType, handler);
  }

  publish(eventType: string, payload: any): void {
    this.eventBus.publish(eventType, payload);
  }
}

export function createRuntime(
  processDefinitions: Record<string, ProcessDefinition>,
  taskDefinitions: Record<string, TaskDefinition>,
  options: { extensionSystem: ExtensionSystem; eventBus: EventBus }
): Runtime {
  return new RuntimeImpl(processDefinitions, taskDefinitions, options);
} 