import { ReactiveEventBus } from '../implementations/event-bus.js';
import { RuntimeOptions } from './runtime.js';

export interface TaskContext {
  processId: string;
  taskId: string;
  input: any;
  eventBus: ReactiveEventBus;
  logger: RuntimeOptions['logger'];
  emitEvent: (type: string, payload: any) => void;
  getTaskResult: (depId: string) => any;
  isCancelled: () => boolean;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  dependencies?: string[];
  handler: (context: TaskContext) => Promise<any>;
  maxRetries?: number;
  retryDelay?: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  input: any;
  result?: any;
  error?: string;
  retryCount: number;
  processId?: string;
} 