/**
 * Extension types
 */

/**
 * Event
 */
export interface Event {
  type: string;
  payload: any;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * Process instance
 */
export interface ProcessInstance {
  id: string;
  processId: string;
  state: string;
  data: any;
  events: Event[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Task implementation
 */
export type TaskImplementation<TInput = any, TOutput = any> = (
  input: TInput,
  context: any
) => Promise<TOutput>;

/**
 * Runtime
 */
export interface Runtime {
  createProcess: (processId: string, input: any) => Promise<ProcessInstance>;
  getProcess: (instanceId: string) => Promise<ProcessInstance | null>;
  executeTask: <TInput = any, TOutput = any>(taskId: string, input: TInput) => Promise<TOutput>;
  emitEvent: (event: Event) => void;
  on: (eventType: string, handler: (event: Event) => void) => void;
  off: (eventType: string, handler: (event: Event) => void) => void;
}

/**
 * Process definition
 */
export interface ProcessDefinition {
  id: string;
  name: string;
  description?: string;
  initialState: string;
  states: string[];
  transitions: any[];
  metadata?: Record<string, any>;
}

/**
 * Task definition
 */
export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  implementation?: TaskImplementation;
  errorHandler?: TaskImplementation;
  metadata?: Record<string, any>;
}

/**
 * System configuration
 */
export interface SystemConfig {
  id: string;
  name: string;
  description?: string;
  processes: ProcessDefinition[];
  tasks: TaskDefinition[];
  services?: any[];
  plugins?: any[];
  metadata?: Record<string, any>;
}

/**
 * Test definition
 */
export interface TestDefinition {
  id: string;
  name: string;
  description?: string;
  testCases: any[];
  metadata?: Record<string, any>;
}
