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

export * from './event.js';
export * from './extension.js';
export * from './runtime.js'; 