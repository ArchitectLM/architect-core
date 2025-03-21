export interface ProcessDefinition {
  id: string;
  name: string;
  description: string;
  initialState: string;
  transitions: ProcessTransition[];
  version?: string;
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
  version?: string;
  recovery?: {
    checkpointId: string;
    lastSavedAt: number;
  };
}

export interface TaskRetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  backoffDelay: number;
  retryableErrors?: string[];
  maxDelay?: number;
}

export interface CancellationToken {
  isCancelled: boolean;
  onCancel(callback: () => void): void;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  handler: (context: TaskContext) => Promise<any>;
  retry?: TaskRetryPolicy;
  timeout?: number;
  dependencies?: string[];
}

export interface TaskContext {
  input: any;
  attemptNumber?: number;
  previousError?: Error;
  cancellationToken?: CancellationToken;
  [key: string]: any;
}

export interface TaskExecution {
  id: string;
  type: string;
  input: any;
  result?: any;
  error?: any;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  attempts?: number;
  dependency?: {
    dependsOn: string[];
    waitingFor: string[];
  };
  metadata?: any;
}

export interface TaskMetrics {
  taskId: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  averageDuration: number;
  lastExecutionTime: number;
}

export interface ProcessMetrics {
  processType: string;
  instanceCount: number;
  averageDuration: number;
  stateDistribution: Record<string, number>;
  lastProcessedTime: number;
}

export interface EventMetrics {
  eventType: string;
  publishCount: number;
  subscriberCount: number;
  averageProcessingTime: number;
  lastPublishedTime: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    processes: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeCount: number;
    };
    tasks: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      runningCount: number;
      failedCount: number;
    };
    events: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      queueDepth: number;
    };
  };
  timestamp: number;
}

export * from './event.js';
export * from './extension.js';
export * from './runtime.js'; 