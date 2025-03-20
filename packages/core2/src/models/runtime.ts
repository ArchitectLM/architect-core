import { ProcessInstance, TaskExecution } from './index.js';
import { EventBus } from './event.js';

export interface Runtime {
  createProcess(processType: string, data: any): Promise<ProcessInstance>;
  getProcess(processId: string): Promise<ProcessInstance | undefined>;
  transitionProcess(processId: string, event: string): Promise<ProcessInstance>;
  executeTask(taskType: string, input: any): Promise<TaskExecution>;
  subscribe(eventType: string, handler: (event: any) => void): void;
  unsubscribe(eventType: string, handler: (event: any) => void): void;
  publish(eventType: string, payload: any): void;
} 