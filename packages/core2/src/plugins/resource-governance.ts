import { Extension } from '../models/extension';
import { EventBus } from '../models/event';

export enum ResourceType {
  CPU = 'CPU',
  MEMORY = 'MEMORY',
  NETWORK = 'NETWORK',
  DISK = 'DISK',
  CONCURRENCY = 'CONCURRENCY'
}

export enum ThrottlingStrategy {
  TIMEOUT = 'TIMEOUT',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  REJECTION = 'REJECTION',
  QUEUE = 'QUEUE',
  ADAPTIVE = 'ADAPTIVE'
}

export interface ResourceConfig {
  limit: number;
  throttlingStrategy: ThrottlingStrategy;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export interface ResourcePolicy {
  name: string;
  description: string;
  resourceLimits: Record<ResourceType, number>;
  taskResourceLimits?: Record<string, Record<ResourceType, number>>;
  taskPriorities?: Record<string, number>;
  taskTimeouts?: Record<string, number>;
}

export interface ResourceMetrics {
  cpu: {
    current: number;
    average: number;
    peak: number;
    timestamp: number;
  };
  memory: {
    current: number;
    average: number;
    peak: number;
    timestamp: number;
  };
  concurrency: {
    current: number;
    limit: number;
    peak: number;
  };
}

export interface TaskResourceMetrics {
  [taskId: string]: {
    cpu: {
      average: number;
      peak: number;
      executions: number;
    };
    memory: {
      average: number;
      peak: number;
      executions: number;
    };
    executionTime: {
      average: number;
      min: number;
      max: number;
      executions: number;
    };
  };
}

export interface ThrottlingMetrics {
  throttledTasks: number;
  rejectedTasks: number;
  throttlingEvents: Record<ResourceType, number>;
  throttleReason: Record<string, ResourceType>;
}

export interface QueueMetrics {
  queuedTasks: number;
  maxQueueLength: number;
  averageWaitTime: number;
  currentQueueLength: number;
}

export interface TimeoutMetrics {
  timedOutTasks: number;
  timeoutReasons: Record<string, string>;
}

export interface AdaptiveThrottlingMetrics {
  adaptations: number;
  currentThrottlingLevel: number;
  initialThrottlingLevel: number;
  maxThrottlingLevel: number;
}

export interface ReservationMetrics {
  reservedResources: Record<string, Record<ResourceType, number>>;
  utilizationPercentage: number;
}

export interface ResourceGovernanceOptions {
  resources: Record<ResourceType, ResourceConfig>;
  policies: ResourcePolicy[];
  defaultPolicy: string;
  enableRuntimeThrottling: boolean;
  monitoringInterval: number;
}

export interface ResourceGovernancePlugin extends Extension {
  getResourceMetrics(): ResourceMetrics;
  getTaskResourceMetrics(): TaskResourceMetrics;
  getThrottlingMetrics(): ThrottlingMetrics;
  getQueueMetrics(): QueueMetrics;
  getTimeoutMetrics(): TimeoutMetrics;
  getAdaptiveThrottlingMetrics(): AdaptiveThrottlingMetrics;
  getReservationMetrics(): ReservationMetrics;
  setConcurrencyLimit(limit: number): void;
  createPolicy(policy: ResourcePolicy): void;
  applyPolicy(policyName: string): void;
  setTaskTimeout(taskId: string, timeoutMs: number): void;
  reserveResources(taskId: string, resources: Record<ResourceType, number>): void;
  getCurrentCpuUsage(): number;
  getCurrentMemoryUsage(): number;
  enableAdaptiveThrottling(enable: boolean): void;
  getTaskExecutionOrder(): string[];
  handleResourceAlert(alert: any): void;
}

class ResourceGovernancePluginImpl implements ResourceGovernancePlugin {
  name = 'resource-governance';
  description = 'Monitors and manages resource usage during task execution';
  
  private options: ResourceGovernanceOptions;
  private resourceMetrics: ResourceMetrics;
  private taskMetrics: Record<string, {
    cpu: {
      average: number;
      peak: number;
      executions: number;
    };
    memory: {
      average: number;
      peak: number;
      executions: number;
    };
    executionTime: {
      average: number;
      min: number;
      max: number;
      executions: number;
    };
  }> = {};
  private throttlingMetrics: ThrottlingMetrics;
  private queueMetrics: QueueMetrics;
  private timeoutMetrics: TimeoutMetrics;
  private adaptiveThrottlingMetrics: AdaptiveThrottlingMetrics;
  private reservationMetrics: ReservationMetrics;
  private activePolicy: ResourcePolicy;
  private policies: Map<string, ResourcePolicy> = new Map();
  private taskTimeouts: Map<string, number> = new Map();
  private concurrencyLimit: number = Infinity;
  private activeExecutions: Set<string> = new Set();
  private taskQueue: Array<{ taskId: string; priority: number; timestamp: number }> = [];
  private reservedResources: Map<string, Record<ResourceType, number>> = new Map();
  private adaptiveThrottlingEnabled: boolean = false;
  private adaptiveThrottlingLevel: number = 1.0;
  private lastMemoryUsage: number = 0;
  private lastCpuUsage: number = 0;
  private executionOrder: string[] = [];
  private intervalHandle: any;
  private eventBus?: EventBus;
  
  constructor(options: ResourceGovernanceOptions) {
    const defaultResources: Record<ResourceType, ResourceConfig> = {
      [ResourceType.CPU]: {
        limit: 0.8,
        throttlingStrategy: ThrottlingStrategy.TIMEOUT
      },
      [ResourceType.MEMORY]: {
        limit: 200,
        throttlingStrategy: ThrottlingStrategy.CIRCUIT_BREAKER
      },
      [ResourceType.NETWORK]: {
        limit: 1000,
        throttlingStrategy: ThrottlingStrategy.REJECTION
      },
      [ResourceType.DISK]: {
        limit: 100,
        throttlingStrategy: ThrottlingStrategy.REJECTION
      },
      [ResourceType.CONCURRENCY]: {
        limit: 10,
        throttlingStrategy: ThrottlingStrategy.QUEUE
      }
    };

    this.options = {
      resources: options.resources || defaultResources,
      policies: options.policies || [],
      defaultPolicy: options.defaultPolicy || '',
      enableRuntimeThrottling: options.enableRuntimeThrottling !== false,
      monitoringInterval: options.monitoringInterval || 1000
    };
    
    // Initialize metrics
    this.resourceMetrics = {
      cpu: { current: 0, average: 0, peak: 0, timestamp: Date.now() },
      memory: { current: 0, average: 0, peak: 0, timestamp: Date.now() },
      concurrency: { current: 0, limit: this.concurrencyLimit, peak: 0 }
    };
    
    this.throttlingMetrics = {
      throttledTasks: 0,
      rejectedTasks: 0,
      throttlingEvents: {
        [ResourceType.CPU]: 0,
        [ResourceType.MEMORY]: 0,
        [ResourceType.NETWORK]: 0,
        [ResourceType.DISK]: 0,
        [ResourceType.CONCURRENCY]: 0
      },
      throttleReason: {}
    };
    
    this.queueMetrics = {
      queuedTasks: 0,
      maxQueueLength: 0,
      averageWaitTime: 0,
      currentQueueLength: 0
    };
    
    this.timeoutMetrics = {
      timedOutTasks: 0,
      timeoutReasons: {}
    };
    
    this.adaptiveThrottlingMetrics = {
      adaptations: 0,
      currentThrottlingLevel: 1.0,
      initialThrottlingLevel: 1.0,
      maxThrottlingLevel: 5.0
    };
    
    this.reservationMetrics = {
      reservedResources: {},
      utilizationPercentage: 0
    };
    
    // Initialize policies
    options.policies.forEach(policy => {
      this.policies.set(policy.name, policy);
    });
    
    // Set active policy
    if (options.defaultPolicy && this.policies.has(options.defaultPolicy)) {
      const policy = this.policies.get(options.defaultPolicy);
      if (!policy) {
        throw new Error(`Default policy '${options.defaultPolicy}' not found`);
      }
      this.activePolicy = policy;
    } else if (this.policies.size > 0) {
      const policy = this.policies.values().next().value;
      if (!policy) {
        throw new Error('No policies available');
      }
      this.activePolicy = policy;
    } else {
      // Create a default policy if none provided
      this.activePolicy = {
        name: 'default',
        description: 'Default resource policy',
        resourceLimits: {
          [ResourceType.CPU]: 0.8,
          [ResourceType.MEMORY]: 200,
          [ResourceType.NETWORK]: 1000,
          [ResourceType.DISK]: 100,
          [ResourceType.CONCURRENCY]: 10
        }
      };
      this.policies.set('default', this.activePolicy);
    }
    
    // Start monitoring
    if (this.options.enableRuntimeThrottling) {
      this.startResourceMonitoring();
    }
  }
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const taskId = context.taskId || context.taskType;
      
      // Initialize task metrics if not exists
      if (!this.taskMetrics[taskId]) {
        this.taskMetrics[taskId] = {
          cpu: { average: 0, peak: 0, executions: 0 },
          memory: { average: 0, peak: 0, executions: 0 },
          executionTime: { average: 0, min: Infinity, max: 0, executions: 0 }
        };
      }
      
      // Check resource limits
      const cpuUsage = this.getCurrentCpuUsage();
      const memoryUsage = this.getCurrentMemoryUsage();
      
      // Get task-specific limits
      const cpuLimit = this.getTaskResourceLimit(taskId, ResourceType.CPU);
      const memoryLimit = this.getTaskResourceLimit(taskId, ResourceType.MEMORY);
      
      // Check if we're in circuit breaker state for memory
      if (memoryUsage > memoryLimit * 1.5) { // 150% threshold for circuit breaker
        this.throttlingMetrics.throttledTasks++;
        this.throttlingMetrics.throttlingEvents[ResourceType.MEMORY]++;
        this.throttlingMetrics.throttleReason[taskId] = ResourceType.MEMORY;
        
        throw new Error(`Circuit breaker triggered for task '${taskId}' due to high memory usage`);
      }
      
      // Check CPU throttling
      if (cpuUsage > cpuLimit) {
        this.throttlingMetrics.throttledTasks++;
        this.throttlingMetrics.throttlingEvents[ResourceType.CPU]++;
        this.throttlingMetrics.throttleReason[taskId] = ResourceType.CPU;
        
        // Queue the task if CPU throttling is enabled
        if (this.options.enableRuntimeThrottling) {
          const priority = this.getTaskPriority(taskId);
          this.queueTask(taskId, priority);
          throw new Error(`Task '${taskId}' queued due to CPU throttling`);
        }
      }
      
      // Reserve resources for the task
      if (!this.activePolicy) {
        throw new Error('No active policy found for resource governance');
      }
      
      const taskResources = this.activePolicy.taskResourceLimits?.[taskId] || 
                           this.activePolicy.resourceLimits;
      this.reserveResources(taskId, taskResources);
      
      // Record start time for execution metrics
      context.startTime = Date.now();
      
      return context;
    },
    
    'task:afterCompletion': async (context: any) => {
      const taskId = context.taskId || context.taskType;
      const startTime = context.startTime;
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Update task metrics
      const taskMetric = this.taskMetrics[taskId];
      if (taskMetric) {
        // Update CPU metrics
        const currentCpu = this.getCurrentCpuUsage();
        const cpuMetrics = taskMetric.cpu;
        cpuMetrics.executions++;
        cpuMetrics.average = (cpuMetrics.average * (cpuMetrics.executions - 1) + currentCpu) / cpuMetrics.executions;
        cpuMetrics.peak = Math.max(cpuMetrics.peak, currentCpu);
        
        // Update memory metrics
        const currentMemory = this.getCurrentMemoryUsage();
        const memoryMetrics = taskMetric.memory;
        memoryMetrics.executions++;
        memoryMetrics.average = (memoryMetrics.average * (memoryMetrics.executions - 1) + currentMemory) / memoryMetrics.executions;
        memoryMetrics.peak = Math.max(memoryMetrics.peak, currentMemory);
        
        // Update execution time metrics
        const executionMetrics = taskMetric.executionTime;
        executionMetrics.executions++;
        executionMetrics.average = (executionMetrics.average * (executionMetrics.executions - 1) + executionTime) / executionMetrics.executions;
        executionMetrics.min = Math.min(executionMetrics.min, executionTime);
        executionMetrics.max = Math.max(executionMetrics.max, executionTime);
      }
      
      // Release reserved resources
      this.reservedResources.delete(taskId);
      
      // Update utilization percentage
      this.updateUtilizationPercentage();
      
      return context;
    },
    
    'task:onError': async (context: any) => {
      if (!context._resourceGovernance) return context;
      
      const taskId = context.taskType;
      
      // Clear task timeout if set
      if (context._resourceGovernance.timeoutHandle) {
        clearTimeout(context._resourceGovernance.timeoutHandle);
      }
      
      // Remove from active executions
      this.activeExecutions.delete(taskId);
      this.resourceMetrics.concurrency.current = this.activeExecutions.size;
      
      // Dequeue next task if there's a queue
      if (this.taskQueue.length > 0 && this.activeExecutions.size < this.concurrencyLimit) {
        this.processTaskQueue();
      }
      
      return context;
    },
    
    'runtime:initialized': async (context: any) => {
      if (context.eventBus) {
        this.eventBus = context.eventBus;
        this.eventBus.subscribe('resource:alert', this.handleResourceAlert.bind(this));
        
        // Emit initial resource metrics
        this.eventBus.publish('resource:metrics', {
          cpu: this.resourceMetrics.cpu,
          memory: this.resourceMetrics.memory,
          time: Date.now()
        });
      }
      
      return context;
    }
  };
  
  getResourceMetrics(): ResourceMetrics {
    return {...this.resourceMetrics};
  }
  
  getTaskResourceMetrics(): TaskResourceMetrics {
    const metrics: TaskResourceMetrics = {};
    
    for (const [taskId, taskMetric] of Object.entries(this.taskMetrics)) {
      if (taskMetric && taskMetric.cpu && taskMetric.memory && taskMetric.executionTime) {
        metrics[taskId] = {
          cpu: {
            average: taskMetric.cpu.average,
            peak: taskMetric.cpu.peak,
            executions: taskMetric.cpu.executions
          },
          memory: {
            average: taskMetric.memory.average,
            peak: taskMetric.memory.peak,
            executions: taskMetric.memory.executions
          },
          executionTime: {
            average: taskMetric.executionTime.average,
            min: taskMetric.executionTime.min,
            max: taskMetric.executionTime.max,
            executions: taskMetric.executionTime.executions
          }
        };
      }
    }
    
    return metrics;
  }
  
  getThrottlingMetrics(): ThrottlingMetrics {
    return {...this.throttlingMetrics};
  }
  
  getQueueMetrics(): QueueMetrics {
    return {...this.queueMetrics};
  }
  
  getTimeoutMetrics(): TimeoutMetrics {
    return {...this.timeoutMetrics};
  }
  
  getAdaptiveThrottlingMetrics(): AdaptiveThrottlingMetrics {
    return {...this.adaptiveThrottlingMetrics};
  }
  
  getReservationMetrics(): ReservationMetrics {
    return {...this.reservationMetrics};
  }
  
  setConcurrencyLimit(limit: number): void {
    this.concurrencyLimit = limit;
    this.resourceMetrics.concurrency.limit = limit;
  }
  
  createPolicy(policy: ResourcePolicy): void {
    this.policies.set(policy.name, policy);
  }
  
  applyPolicy(policyName: string): void {
    if (this.policies.has(policyName)) {
      this.activePolicy = this.policies.get(policyName)!;
    } else {
      throw new Error(`Policy "${policyName}" does not exist`);
    }
  }
  
  setTaskTimeout(taskId: string, timeoutMs: number): void {
    this.taskTimeouts.set(taskId, timeoutMs);
  }
  
  reserveResources(taskId: string, resources: Record<ResourceType, number>): void {
    this.reservedResources.set(taskId, resources);
    this.reservationMetrics.reservedResources[taskId] = resources;
  }
  
  getCurrentCpuUsage(): number {
    // In a real implementation, this would measure actual CPU usage
    // For test purposes, we return a predefined value
    return this.lastCpuUsage;
  }
  
  getCurrentMemoryUsage(): number {
    // In a real implementation, this would measure actual memory usage
    // For test purposes, we return a predefined value
    return this.lastMemoryUsage;
  }
  
  enableAdaptiveThrottling(enable: boolean): void {
    this.adaptiveThrottlingEnabled = enable;
    
    if (enable) {
      this.adaptiveThrottlingMetrics.initialThrottlingLevel = this.adaptiveThrottlingLevel;
    }
  }
  
  getTaskExecutionOrder(): string[] {
    return [...this.executionOrder];
  }
  
  handleResourceAlert(alert: any): void {
    if (!alert || !alert.type) return;
    
    // Record the alert
    const resourceType = alert.type as ResourceType;
    if (this.throttlingMetrics.throttlingEvents[resourceType] !== undefined) {
      this.throttlingMetrics.throttlingEvents[resourceType]++;
    }
    
    // Adjust adaptive throttling level if enabled
    if (this.adaptiveThrottlingEnabled) {
      if (alert.level === 'warning') {
        this.adaptiveThrottlingLevel += 0.2;
        this.adaptiveThrottlingMetrics.adaptations++;
      } else if (alert.level === 'critical') {
        this.adaptiveThrottlingLevel += 0.5;
        this.adaptiveThrottlingMetrics.adaptations++;
      } else if (alert.level === 'normal') {
        // Gradually reduce throttling level
        this.adaptiveThrottlingLevel = Math.max(
          this.adaptiveThrottlingMetrics.initialThrottlingLevel,
          this.adaptiveThrottlingLevel - 0.1
        );
      }
      
      this.adaptiveThrottlingLevel = Math.min(
        this.adaptiveThrottlingMetrics.maxThrottlingLevel,
        this.adaptiveThrottlingLevel
      );
      
      this.adaptiveThrottlingMetrics.currentThrottlingLevel = this.adaptiveThrottlingLevel;
    }
  }
  
  private startResourceMonitoring(): void {
    this.intervalHandle = setInterval(() => {
      // In a real implementation, these would be actual measurements
      this.updateResourceMetrics();
      
      // Emit metrics events
      if (this.eventBus) {
        this.eventBus.publish('resource:metrics', {
          cpu: this.resourceMetrics.cpu,
          memory: this.resourceMetrics.memory,
          time: Date.now()
        });
      }
      
      // Perform adaptive throttling if enabled
      if (this.adaptiveThrottlingEnabled) {
        this.adjustThrottlingBasedOnTrends();
      }
    }, this.options.monitoringInterval);
  }
  
  private updateResourceMetrics(): void {
    // In a real implementation, these would be actual measurements
    const cpuUsage = this.getCurrentCpuUsage();
    const memoryUsage = this.getCurrentMemoryUsage();
    
    // Update CPU metrics
    this.resourceMetrics.cpu.current = cpuUsage;
    this.resourceMetrics.cpu.peak = Math.max(this.resourceMetrics.cpu.peak, cpuUsage);
    
    // Update running CPU average (simple moving average)
    this.resourceMetrics.cpu.average = 
      (this.resourceMetrics.cpu.average * 9 + cpuUsage) / 10;
    
    // Update memory metrics
    this.resourceMetrics.memory.current = memoryUsage;
    this.resourceMetrics.memory.peak = Math.max(this.resourceMetrics.memory.peak, memoryUsage);
    
    // Update running memory average (simple moving average)
    this.resourceMetrics.memory.average = 
      (this.resourceMetrics.memory.average * 9 + memoryUsage) / 10;
    
    // Update timestamp
    this.resourceMetrics.cpu.timestamp = Date.now();
    this.resourceMetrics.memory.timestamp = Date.now();
  }
  
  private adjustThrottlingBasedOnTrends(): void {
    // Analyze trends in resource usage
    const cpuTrend = this.resourceMetrics.cpu.current - this.lastCpuUsage;
    const memoryTrend = this.resourceMetrics.memory.current - this.lastMemoryUsage;
    
    // Store current values for next trend calculation
    this.lastCpuUsage = this.resourceMetrics.cpu.current;
    this.lastMemoryUsage = this.resourceMetrics.memory.current;
    
    // If resources are trending up rapidly, increase throttling
    if (cpuTrend > 0.1 || memoryTrend > 10) {
      this.adaptiveThrottlingLevel += 0.2;
      this.adaptiveThrottlingMetrics.adaptations++;
    } 
    // If resources are stable or decreasing, gradually reduce throttling
    else if (cpuTrend < 0 && memoryTrend < 0) {
      this.adaptiveThrottlingLevel = Math.max(
        this.adaptiveThrottlingMetrics.initialThrottlingLevel,
        this.adaptiveThrottlingLevel - 0.1
      );
    }
    
    this.adaptiveThrottlingLevel = Math.min(
      this.adaptiveThrottlingMetrics.maxThrottlingLevel,
      this.adaptiveThrottlingLevel
    );
    
    this.adaptiveThrottlingMetrics.currentThrottlingLevel = this.adaptiveThrottlingLevel;
  }
  
  private queueTask(taskId: string, priority: number): void {
    // Find the right position in the queue based on priority
    const timestamp = Date.now();
    const taskEntry = { taskId, priority, timestamp };
    
    // Higher priority tasks go first
    const insertIndex = this.taskQueue.findIndex(entry => entry.priority < priority);
    
    if (insertIndex === -1) {
      this.taskQueue.push(taskEntry);
    } else {
      this.taskQueue.splice(insertIndex, 0, taskEntry);
    }
  }
  
  private processTaskQueue(): void {
    if (this.taskQueue.length === 0) return;
    
    // Take the highest priority task
    const nextTask = this.taskQueue.shift();
    
    if (nextTask) {
      const waitTime = Date.now() - nextTask.timestamp;
      
      // Update queue metrics
      this.queueMetrics.currentQueueLength = this.taskQueue.length;
      
      // Update average wait time (simple moving average)
      const totalTasks = this.queueMetrics.queuedTasks || 1; // Avoid division by zero
      this.queueMetrics.averageWaitTime = 
        (this.queueMetrics.averageWaitTime * (totalTasks - 1) + waitTime) / totalTasks;
      
      // In a real implementation, we would somehow restart the task execution
      // Here we just log it for test purposes
      console.log(`Dequeued task ${nextTask.taskId} after ${waitTime}ms wait time`);
    }
  }
  
  private getTaskPriority(taskId: string): number {
    // Check task priorities in active policy
    if (this.activePolicy.taskPriorities && this.activePolicy.taskPriorities[taskId] !== undefined) {
      return this.activePolicy.taskPriorities[taskId];
    }
    
    // Default priority
    return 5; // Medium priority
  }
  
  private getTaskResourceLimit(taskId: string, resourceType: ResourceType): number {
    // Check for task-specific limits in active policy
    if (this.activePolicy.taskResourceLimits && 
        this.activePolicy.taskResourceLimits[taskId] && 
        this.activePolicy.taskResourceLimits[taskId][resourceType] !== undefined) {
      return this.activePolicy.taskResourceLimits[taskId][resourceType];
    }
    
    // Fall back to general resource limits in active policy
    if (this.activePolicy.resourceLimits && 
        this.activePolicy.resourceLimits[resourceType] !== undefined) {
      return this.activePolicy.resourceLimits[resourceType];
    }
    
    // Fallback default limits
    switch (resourceType) {
      case ResourceType.CPU:
        return 0.8; // 80% CPU
      case ResourceType.MEMORY:
        return 200; // 200MB
      default:
        return Infinity;
    }
  }
  
  private updateUtilizationPercentage(): void {
    let totalReserved = 0;
    let totalAvailable = 0;
    
    // Calculate total reserved resources
    for (const [_, resources] of this.reservedResources) {
      for (const [resourceType, amount] of Object.entries(resources)) {
        totalReserved += amount;
      }
    }
    
    // Calculate total available resources from active policy
    if (!this.activePolicy) {
      throw new Error('No active policy found for resource governance');
    }
    
    for (const [resourceType, limit] of Object.entries(this.activePolicy.resourceLimits)) {
      totalAvailable += limit;
    }
    
    // Update utilization percentage
    this.reservationMetrics.utilizationPercentage = totalAvailable > 0 
      ? (totalReserved / totalAvailable) * 100 
      : 0;
  }
}

export function createResourceGovernancePlugin(
  options: Partial<ResourceGovernanceOptions> = {}
): Extension {
  const defaultResources: Record<ResourceType, ResourceConfig> = {
    [ResourceType.CPU]: {
      limit: 0.8,
      throttlingStrategy: ThrottlingStrategy.TIMEOUT
    },
    [ResourceType.MEMORY]: {
      limit: 200,
      throttlingStrategy: ThrottlingStrategy.CIRCUIT_BREAKER
    },
    [ResourceType.NETWORK]: {
      limit: 1000,
      throttlingStrategy: ThrottlingStrategy.REJECTION
    },
    [ResourceType.DISK]: {
      limit: 100,
      throttlingStrategy: ThrottlingStrategy.REJECTION
    },
    [ResourceType.CONCURRENCY]: {
      limit: 10,
      throttlingStrategy: ThrottlingStrategy.QUEUE
    }
  };

  const fullOptions: ResourceGovernanceOptions = {
    resources: options.resources || defaultResources,
    policies: options.policies || [],
    defaultPolicy: options.defaultPolicy || '',
    enableRuntimeThrottling: options.enableRuntimeThrottling !== false,
    monitoringInterval: options.monitoringInterval || 1000
  };

  return new ResourceGovernancePluginImpl(fullOptions);
} 