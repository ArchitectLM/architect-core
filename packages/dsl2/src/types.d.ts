/**
 * Type declarations for @architectlm/core
 */

declare module '@architectlm/core' {
  export interface ProcessDefinition {
    id: string;
    name: string;
    description: string;
    initialState: string;
    transitions: ProcessTransition[];
  }

  export interface ProcessTransition {
    from: string;
    to: string;
    on: string;
  }

  export interface ProcessInstance {
    id: string;
    type: string;
    state: string;
    data: any;
    createdAt: number;
    updatedAt: number;
  }

  export interface TaskDefinition {
    id: string;
    name: string;
    description: string;
    handler: (context: TaskContext) => Promise<any>;
  }

  export interface TaskContext {
    input: any;
    [key: string]: any;
  }

  export interface TaskExecution {
    id: string;
    type: string;
    input: any;
    result?: any;
    error?: any;
    status: 'running' | 'completed' | 'failed';
    startedAt: number;
    completedAt?: number;
  }

  export interface Event<T = any> {
    type: string;
    payload: T;
    timestamp: number;
  }

  export type EventHandler = (event: Event) => void;

  export interface BackpressureStrategy {
    shouldProcess(event: Event): boolean;
  }

  export interface EventBus {
    subscribe(eventType: string, handler: EventHandler): void;
    unsubscribe(eventType: string, handler: EventHandler): void;
    publish(eventType: string, payload: any): void;
    applyBackpressure(eventType: string, strategy: BackpressureStrategy): void;
  }

  export interface ExtensionPoint {
    name: string;
    description: string;
    handlers: ExtensionHandler[];
  }

  export interface Extension {
    name: string;
    description: string;
    hooks: Record<string, ExtensionHandler>;
  }

  export interface ExtensionContext {
    [key: string]: any;
  }

  export type ExtensionHandler = (context: ExtensionContext) => Promise<ExtensionContext> | ExtensionContext;

  export type EventInterceptor = (event: any) => any;

  export interface ExtensionSystem {
    registerExtensionPoint(point: ExtensionPoint): void;
    registerExtension(extension: Extension): void;
    registerEventInterceptor(interceptor: EventInterceptor): void;
    executeExtensionPoint<T extends ExtensionContext>(pointName: string, context: T): Promise<T>;
    interceptEvent(event: any): any;
  }

  export interface Runtime {
    createProcess(processType: string, data: any): Promise<ProcessInstance>;
    getProcess(processId: string): Promise<ProcessInstance | undefined>;
    transitionProcess(processId: string, event: string): Promise<ProcessInstance>;
    executeTask(taskType: string, input: any): Promise<TaskExecution>;
    subscribe(eventType: string, handler: (event: any) => void): void;
    unsubscribe(eventType: string, handler: (event: any) => void): void;
    publish(eventType: string, payload: any): void;
  }

  export function createRuntime(
    processDefinitions: Record<string, ProcessDefinition>,
    taskDefinitions: Record<string, TaskDefinition>,
    options: { extensionSystem: ExtensionSystem; eventBus: EventBus }
  ): Runtime;
} 