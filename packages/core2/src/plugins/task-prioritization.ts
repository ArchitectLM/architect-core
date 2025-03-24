import { Extension, ExtensionContext, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum SchedulingPolicy {
  FIFO = 'fifo',
  SJF = 'shortest-job-first',
  DEADLINE = 'deadline',
  PRIORITY = 'priority'
}

export interface TaskMetadata {
  priority: TaskPriority;
  executionTime?: number;
  deadline?: number;
  preemptible?: boolean;
  groupId?: string;
  resourceAffinity?: string[];
}

export interface TaskPrioritizationOptions {
  maxConcurrentTasks?: number;
  schedulingPolicy?: SchedulingPolicy;
  preemptionEnabled?: boolean;
  priorityAgingEnabled?: boolean;
  waitingTimeThreshold?: number;
  priorityBoostAmount?: number;
  defaultPriority?: TaskPriority;
}

interface TaskState {
  taskId: string;
  priority: TaskPriority;
  executionTime?: number;
  deadline?: number;
  preemptible: boolean;
  startTime?: number;
  waitingSince?: number;
  groupId?: string;
  resourceAffinity?: string[];
  boostedPriority?: number;
  preempted?: boolean;
}

interface TaskGroup {
  priority: TaskPriority;
  maxConcurrent: number;
}

export class TaskPrioritizationPlugin implements Extension {
  id = 'task-prioritization-plugin';
  name = 'task-prioritization-plugin';
  description = 'Manages task execution order based on priority';
  dependencies: string[] = [];

  private taskStates = new Map<string, TaskState>();
  private runningTasks = new Set<string>();
  private taskQueue: string[] = [];
  private executionOrder: string[] = [];
  private completedTasks: string[] = [];
  private taskGroups = new Map<string, TaskGroup>();
  private resourceCapacity = new Map<string, number>();
  private resourceAllocations = new Map<string, number>();

  private maxConcurrentTasks: number;
  private schedulingPolicy: SchedulingPolicy;
  private preemptionEnabled: boolean;
  private priorityAgingEnabled: boolean;
  private waitingTimeThreshold: number;
  private priorityBoostAmount: number;

  constructor(private config: TaskPrioritizationOptions = {}) {
    this.maxConcurrentTasks = config.maxConcurrentTasks || 5;
    this.schedulingPolicy = config.schedulingPolicy || SchedulingPolicy.PRIORITY;
    this.preemptionEnabled = config.preemptionEnabled || false;
    this.priorityAgingEnabled = config.priorityAgingEnabled || false;
    this.waitingTimeThreshold = config.waitingTimeThreshold || 30000; // 30 seconds
    this.priorityBoostAmount = config.priorityBoostAmount || 1;
  }

  private debug(method: string, message: string, data?: any) {
    // Optional: Add logging here
  }

  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return [
      {
        pointName: 'task:beforeExecution' as ExtensionPointName,
        hook: async (context: unknown): Promise<{ success: boolean; value: unknown }> => {
          const ctx = context as any;
          const taskId = ctx.taskId as string;
          const metadata = ctx.metadata as Partial<TaskMetadata> || {};
          
          // Initialize task state if needed
          if (!this.taskStates.has(taskId)) {
            this.taskStates.set(taskId, {
              taskId,
              priority: metadata.priority || TaskPriority.NORMAL,
              executionTime: metadata.executionTime,
              deadline: metadata.deadline,
              preemptible: metadata.preemptible || false,
              waitingSince: Date.now(),
              groupId: metadata.groupId,
              resourceAffinity: metadata.resourceAffinity
            });
          }
          
          // Check if there's capacity to run this task
          if (!this.canRunTask(taskId)) {
            this.debug('beforeExecution', `No capacity for task ${taskId}, queueing`, {
              runningTasks: this.runningTasks.size,
              maxConcurrentTasks: this.maxConcurrentTasks
            });
            
            // If preemption is enabled, check if we can preempt a lower priority task
            if (this.preemptionEnabled) {
              const state = this.taskStates.get(taskId)!;
              const lowestPriorityRunningTask = this.getLowestPriorityRunningTask();
              
              if (lowestPriorityRunningTask &&
                  this.getEffectivePriority(state) > 
                  this.getEffectivePriority(this.taskStates.get(lowestPriorityRunningTask)!)) {
                this.debug('beforeExecution', `Preempting task ${lowestPriorityRunningTask} for ${taskId}`);
                this.preemptTask(lowestPriorityRunningTask);
              } else {
                // Can't preempt, add to queue
                this.taskQueue.push(taskId);
                return { success: true, value: { ...ctx, skipExecution: true } };
              }
            } else {
              // Add to queue
              this.taskQueue.push(taskId);
              return { success: true, value: { ...ctx, skipExecution: true } };
            }
          }
          
          // Add task to running
          this.addTaskToRunning(taskId);
          
          return { success: true, value: ctx };
        }
      },
      
      {
        pointName: 'task:afterCompletion' as ExtensionPointName,
        hook: async (context: unknown): Promise<{ success: boolean; value: unknown }> => {
          const ctx = context as any;
          const taskId = ctx.taskId as string;
          const state = this.taskStates.get(taskId);
          
          if (state) {
            // Record completion
            this.completedTasks.push(taskId);
            
            // Remove from running tasks
            this.removeTaskFromRunning(taskId);
            
            // Process next task from queue if any
            if (this.taskQueue.length > 0) {
              this.processNextTask();
            }
          }
          
          return { success: true, value: ctx };
        }
      }
    ];
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): string[] {
    return ['task-prioritization', 'scheduling'];
  }

  private addTaskToRunning(taskId: string): void {
    const state = this.taskStates.get(taskId);
    if (!state) return;
    
    // Record start time
    state.startTime = Date.now();
    state.waitingSince = undefined;
    
    // Add to running tasks
    this.runningTasks.add(taskId);
    
    // Add to execution order
    this.executionOrder.push(taskId);
    
    // Update resource allocations if needed
    this.updateResourceAllocations(taskId, true);
    
    this.debug('addTaskToRunning', `Added task ${taskId} to running tasks`, {
      runningTasks: this.runningTasks.size,
      executionOrder: this.executionOrder
    });
  }

  private removeTaskFromRunning(taskId: string): void {
    // Remove from running tasks
    this.runningTasks.delete(taskId);
    
    // Update resource allocations
    this.updateResourceAllocations(taskId, false);
    
    this.debug('removeTaskFromRunning', `Removed task ${taskId} from running tasks`, {
      runningTasks: this.runningTasks.size
    });
  }

  private preemptTask(taskId: string): void {
    const state = this.taskStates.get(taskId);
    if (!state) return;
    
    // Mark as preempted
    state.preempted = true;
    
    // Remove from running
    this.removeTaskFromRunning(taskId);
    
    // Add back to front of queue
    this.taskQueue.unshift(taskId);
    
    this.debug('preemptTask', `Preempted task ${taskId}`, {
      taskQueue: this.taskQueue
    });
  }

  private canRunTask(taskId: string): boolean {
    const state = this.taskStates.get(taskId);
    if (!state) return false;
    
    // Check max concurrent tasks
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      return false;
    }
    
    // Check group limits
    if (state.groupId && this.taskGroups.has(state.groupId)) {
      const group = this.taskGroups.get(state.groupId)!;
      
      // Count running tasks in this group
      const runningInGroup = [...this.runningTasks].filter(id => {
        const t = this.taskStates.get(id);
        return t && t.groupId === state.groupId;
      }).length;
      
      if (runningInGroup >= group.maxConcurrent) {
        return false;
      }
    }
    
    // Check resource availability
    if (state.resourceAffinity && state.resourceAffinity.length > 0) {
      for (const resource of state.resourceAffinity) {
        if (this.resourceCapacity.has(resource)) {
          const currentAllocation = this.resourceAllocations.get(resource) || 0;
          const capacity = this.resourceCapacity.get(resource) || 0;
          
          if (currentAllocation >= capacity) {
            return false;
          }
        }
      }
    }
    
    return true;
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;
    
    // Sort queue based on scheduling policy
    this.sortQueue();
    
    // Try to schedule tasks from the queue
    while (this.taskQueue.length > 0) {
      const nextTaskId = this.taskQueue[0];
      
      if (this.canRunTask(nextTaskId)) {
        // Remove from queue
        this.taskQueue.shift();
        
        // Add to running
        this.addTaskToRunning(nextTaskId);
      } else {
        // Can't run the highest priority task, so can't run any
        break;
      }
    }
  }

  private sortQueue(): void {
    switch (this.schedulingPolicy) {
      case SchedulingPolicy.PRIORITY:
        this.taskQueue.sort((a, b) => {
          const stateA = this.taskStates.get(a);
          const stateB = this.taskStates.get(b);
          
          if (!stateA || !stateB) return 0;
          
          return this.getEffectivePriority(stateB) - this.getEffectivePriority(stateA);
        });
        break;
        
      case SchedulingPolicy.DEADLINE:
        this.taskQueue.sort((a, b) => {
          const stateA = this.taskStates.get(a);
          const stateB = this.taskStates.get(b);
          
          if (!stateA || !stateB) return 0;
          if (!stateA.deadline) return 1;
          if (!stateB.deadline) return -1;
          
          return stateA.deadline - stateB.deadline;
        });
        break;
        
      case SchedulingPolicy.SJF:
        this.taskQueue.sort((a, b) => {
          const stateA = this.taskStates.get(a);
          const stateB = this.taskStates.get(b);
          
          if (!stateA || !stateB) return 0;
          if (!stateA.executionTime) return 1;
          if (!stateB.executionTime) return -1;
          
          return stateA.executionTime - stateB.executionTime;
        });
        break;
        
      case SchedulingPolicy.FIFO:
      default:
        // Already in FIFO order
        break;
    }
  }

  private updateResourceAllocations(taskId: string, isAdding: boolean): void {
    const state = this.taskStates.get(taskId);
    if (!state || !state.resourceAffinity) return;
    
    for (const resource of state.resourceAffinity) {
      const current = this.resourceAllocations.get(resource) || 0;
      this.resourceAllocations.set(resource, isAdding ? current + 1 : Math.max(0, current - 1));
    }
  }

  private getEffectivePriority(state: TaskState): number {
    // Calculate effective priority with aging
    if (!this.priorityAgingEnabled || !state.waitingSince) {
      return state.boostedPriority || state.priority;
    }
    
    const waitingTime = Date.now() - state.waitingSince;
    const agingBoost = Math.floor(waitingTime / this.waitingTimeThreshold) * this.priorityBoostAmount;
    
    return state.priority + agingBoost;
  }

  private getLowestPriorityRunningTask(): string | undefined {
    if (this.runningTasks.size === 0) return undefined;
    
    return [...this.runningTasks].reduce((lowest, current) => {
      const lowestState = this.taskStates.get(lowest);
      const currentState = this.taskStates.get(current);
      
      if (!lowestState || !currentState) return lowest;
      
      if (this.getEffectivePriority(currentState) < this.getEffectivePriority(lowestState)) {
        return current;
      }
      
      return lowest;
    });
  }

  // Public API methods

  getRunningTasks(): string[] {
    return [...this.runningTasks];
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }

  setTaskPriority(taskId: string, priority: TaskPriority): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.priority = priority;
      
      // Re-sort queue if task is queued
      if (this.taskQueue.includes(taskId)) {
        this.sortQueue();
      }
    }
  }

  getTaskPriority(taskId: string): TaskPriority {
    return this.taskStates.get(taskId)?.priority || TaskPriority.NORMAL;
  }

  setSchedulingPolicy(policy: SchedulingPolicy): void {
    this.schedulingPolicy = policy;
    this.sortQueue();
  }

  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = max;
  }

  enablePreemption(enabled: boolean): void {
    this.preemptionEnabled = enabled;
  }

  setTaskExecutionTime(taskId: string, time: number): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.executionTime = time;
      
      // Re-sort queue if using SJF and task is queued
      if (this.schedulingPolicy === SchedulingPolicy.SJF && this.taskQueue.includes(taskId)) {
        this.sortQueue();
      }
    }
  }

  setTaskDeadline(taskId: string, deadline: number): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.deadline = deadline;
      
      // Re-sort queue if using deadline scheduling and task is queued
      if (this.schedulingPolicy === SchedulingPolicy.DEADLINE && this.taskQueue.includes(taskId)) {
        this.sortQueue();
      }
    }
  }

  enablePriorityAging(options: { waitingTimeThreshold: number; boostAmount: number }): void {
    this.priorityAgingEnabled = true;
    this.waitingTimeThreshold = options.waitingTimeThreshold;
    this.priorityBoostAmount = options.boostAmount;
  }

  createTaskGroup(groupId: string, options: { priority: TaskPriority; maxConcurrent: number }): void {
    this.taskGroups.set(groupId, {
      priority: options.priority,
      maxConcurrent: options.maxConcurrent
    });
  }

  defineResource(resourceId: string, capacity: number): void {
    this.resourceCapacity.set(resourceId, capacity);
  }

  setTaskResourceRequirements(taskId: string, requirements: Record<string, number>): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.resourceAffinity = Object.keys(requirements).filter(key => requirements[key] > 0);
    }
  }

  public assignTaskToGroup(taskId: string, groupId: string): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.groupId = groupId;
    }
  }

  public getResourceAllocations(resourceId: string): number {
    return this.resourceAllocations.get(resourceId) || 0;
  }
} 