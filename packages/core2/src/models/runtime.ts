import { ProcessInstance, TaskExecution, ProcessMetrics, TaskMetrics, EventMetrics, HealthCheckResult } from './index.js';
import { EventBus } from './event.js';

export interface Runtime {
  // Process Management
  createProcess(processType: string, data: any, options?: { version?: string }): Promise<ProcessInstance>;
  getProcess(processId: string): Promise<ProcessInstance | undefined>;
  transitionProcess(processId: string, event: string): Promise<ProcessInstance>;
  saveProcessCheckpoint(processId: string, checkpointId: string): Promise<ProcessInstance>;
  restoreProcessFromCheckpoint(processId: string, checkpointId: string): Promise<ProcessInstance>;
  
  // Task Management
  executeTask(taskType: string, input: any): Promise<TaskExecution>;
  cancelTask(taskId: string): Promise<boolean>;
  scheduleTask(taskType: string, input: any, scheduledTime: number): Promise<string>;
  executeTaskWithDependencies(taskType: string, input: any, dependencies: string[]): Promise<TaskExecution>;
  
  // Event Management
  subscribe(eventType: string, handler: (event: any) => void): () => void;
  unsubscribe(eventType: string, handler: (event: any) => void): void;
  publish(eventType: string, payload: any): void;
  
  // Event Persistence and Replay
  persistEvent(event: any): Promise<void>;
  replayEvents(fromTimestamp: number, toTimestamp: number, eventTypes?: string[]): Promise<void>;
  correlateEvents(correlationId: string): Promise<any[]>;
  
  // Metrics and Health
  getTaskMetrics(taskId?: string): Promise<TaskMetrics[]>;
  getProcessMetrics(processType?: string): Promise<ProcessMetrics[]>;
  getEventMetrics(eventType?: string): Promise<EventMetrics[]>;
  getHealthStatus(): Promise<HealthCheckResult>;
} 