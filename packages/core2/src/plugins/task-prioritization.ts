import { Extension, ExtensionContext, ExtensionHandler } from '../models/extension';

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
  name = 'task-prioritization-plugin';
  description = 'Manages task execution order based on priority';

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
    this.maxConcurrentTasks = config.maxConcurrentTasks ?? 2;
    this.schedulingPolicy = config.schedulingPolicy ?? SchedulingPolicy.PRIORITY;
    this.preemptionEnabled = config.preemptionEnabled ?? true;
    this.priorityAgingEnabled = config.priorityAgingEnabled ?? false;
    this.waitingTimeThreshold = config.waitingTimeThreshold ?? 5000;
    this.priorityBoostAmount = config.priorityBoostAmount ?? 1;
  }

  private debug(method: string, message: string, data?: any) {
    console.debug(`[TaskPrioritization][${method}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  initialize(): void {
    this.taskStates.clear();
    this.runningTasks.clear();
    this.taskQueue = [];
    this.executionOrder = [];
    this.completedTasks = [];
    this.taskGroups.clear();
    this.resourceCapacity.clear();
    this.resourceAllocations.clear();

    // Initialize default resource capacities
    this.defineResource('cpu', 2);
    this.defineResource('memory', 1);

    // Initialize default task groups
    this.createTaskGroup('database', { priority: TaskPriority.HIGH, maxConcurrent: 1 });
    this.createTaskGroup('cpu', { priority: TaskPriority.NORMAL, maxConcurrent: 2 });
  }

  private addTaskToRunning(taskId: string): void {
    const state = this.taskStates.get(taskId);
    if (!state) return;

    // Remove from queue if present
    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    // Add to running tasks
    this.runningTasks.add(taskId);
    state.startTime = Date.now();
    state.preempted = false;
    this.updateResourceAllocations(taskId, true);

    // Update execution order
    if (!this.executionOrder.includes(taskId)) {
      if (state.priority === TaskPriority.CRITICAL) {
        // Insert critical task at the beginning
        this.executionOrder = [taskId, ...this.executionOrder];
      } else {
        this.executionOrder.push(taskId);
      }
    }
  }

  private removeTaskFromRunning(taskId: string): void {
    const state = this.taskStates.get(taskId);
    this.runningTasks.delete(taskId);
    this.updateResourceAllocations(taskId, false);
    
    // Don't add to completedTasks if it was preempted
    if (state && !state.preempted) {
      if (state.priority === TaskPriority.CRITICAL) {
        // Insert critical task at the beginning of completed tasks
        this.completedTasks = [taskId, ...this.completedTasks];
      } else {
        this.completedTasks.push(taskId);
      }
    }

    // Remove from execution order if preempted
    if (state?.preempted) {
      this.executionOrder = this.executionOrder.filter(id => id !== taskId);
    }
  }

  private preemptTask(taskId: string): void {
    const state = this.taskStates.get(taskId);
    if (!state) return;

    state.preempted = true;
    this.removeTaskFromRunning(taskId);
    
    // Add back to queue with appropriate priority
    if (state.priority === TaskPriority.CRITICAL) {
      this.taskQueue.unshift(taskId);
    } else {
      this.taskQueue.push(taskId);
    }
  }

  private canRunTask(taskId: string): boolean {
    const state = this.taskStates.get(taskId);
    if (!state) return false;

    // Critical tasks can always run
    if (state.priority === TaskPriority.CRITICAL) {
      return true;
    }

    // Check concurrent task limit
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      // Check if we can preempt a lower priority task
      if (this.preemptionEnabled && state.priority === TaskPriority.HIGH) {
        const lowestPriorityTask = Array.from(this.runningTasks)
          .map(id => this.taskStates.get(id)!)
          .filter(t => t.preemptible && t.priority < state.priority)
          .sort((a, b) => a.priority - b.priority)[0];

        if (lowestPriorityTask) {
          this.preemptTask(lowestPriorityTask.taskId);
          return true;
        }
      }
      return false;
    }

    // Check group constraints
    if (state.groupId) {
      const group = this.taskGroups.get(state.groupId);
      if (group) {
        const groupTasks = Array.from(this.runningTasks)
          .filter(id => this.taskStates.get(id)?.groupId === state.groupId);
        if (groupTasks.length >= group.maxConcurrent) {
          return false;
        }
      }
    }

    // Check resource constraints
    if (state.resourceAffinity) {
      for (const resource of state.resourceAffinity) {
        const capacity = this.resourceCapacity.get(resource) ?? 0;
        const current = this.resourceAllocations.get(resource) ?? 0;
        if (current >= capacity) {
          return false;
        }
      }
    }

    return true;
  }

  private updateResourceAllocations(taskId: string, isAdding: boolean): void {
    const state = this.taskStates.get(taskId);
    if (!state?.resourceAffinity) return;

    for (const resource of state.resourceAffinity) {
      const current = this.resourceAllocations.get(resource) ?? 0;
      this.resourceAllocations.set(resource, isAdding ? current + 1 : current - 1);
    }
  }

  private getEffectivePriority(state: TaskState): number {
    if (!this.priorityAgingEnabled || !state.waitingSince) return state.priority;

    const waitingTime = Date.now() - state.waitingSince;
    if (waitingTime > this.waitingTimeThreshold) {
      return state.priority + this.priorityBoostAmount;
    }

    return state.priority;
  }

  private getNextTask(): string | undefined {
    if (this.taskQueue.length === 0) return undefined;

    // Critical tasks always run first
    const criticalTask = this.taskQueue.find(taskId => 
      this.taskStates.get(taskId)?.priority === TaskPriority.CRITICAL);
    if (criticalTask) return criticalTask;

    // Filter tasks that can run based on constraints
    const eligibleTasks = this.taskQueue.filter(taskId => {
      const state = this.taskStates.get(taskId);
      if (!state) return false;

      // Check resource constraints
      if (state.resourceAffinity) {
        for (const resource of state.resourceAffinity) {
          const capacity = this.resourceCapacity.get(resource) ?? 0;
          const current = this.resourceAllocations.get(resource) ?? 0;
          if (current >= capacity) return false;
        }
      }

      // Check group constraints
      if (state.groupId) {
        const group = this.taskGroups.get(state.groupId);
        if (group) {
          const groupTasks = Array.from(this.runningTasks)
            .filter(id => this.taskStates.get(id)?.groupId === state.groupId);
          if (groupTasks.length >= group.maxConcurrent) return false;
        }
      }

      return true;
    });

    if (eligibleTasks.length === 0) return undefined;

    switch (this.schedulingPolicy) {
      case SchedulingPolicy.FIFO:
        return eligibleTasks[0];

      case SchedulingPolicy.SJF:
        return eligibleTasks
          .sort((a, b) => {
            const stateA = this.taskStates.get(a)!;
            const stateB = this.taskStates.get(b)!;
            return (stateA.executionTime ?? Infinity) - (stateB.executionTime ?? Infinity);
          })[0];

      case SchedulingPolicy.DEADLINE:
        return eligibleTasks
          .sort((a, b) => {
            const stateA = this.taskStates.get(a)!;
            const stateB = this.taskStates.get(b)!;
            return (stateA.deadline ?? Infinity) - (stateB.deadline ?? Infinity);
          })[0];

      default: // PRIORITY
        return eligibleTasks
          .sort((a, b) => {
            const stateA = this.taskStates.get(a)!;
            const stateB = this.taskStates.get(b)!;
            const priorityA = this.getEffectivePriority(stateA);
            const priorityB = this.getEffectivePriority(stateB);
            return priorityB - priorityA;
          })[0];
    }
  }

  hooks: Record<string, ExtensionHandler> = {
    'task:beforeExecution': async (context: ExtensionContext): Promise<ExtensionContext> => {
      const taskId = context.taskId as string;
      const metadata = context.metadata as TaskMetadata;

      // Initialize task state if needed
      if (!this.taskStates.has(taskId)) {
        const state: TaskState = {
          taskId,
          priority: metadata?.priority ?? TaskPriority.NORMAL,
          executionTime: metadata?.executionTime,
          deadline: metadata?.deadline,
          preemptible: metadata?.preemptible ?? true,
          groupId: metadata?.groupId,
          resourceAffinity: metadata?.resourceAffinity,
          waitingSince: Date.now(),
          preempted: false,
          boostedPriority: metadata?.priority ?? TaskPriority.NORMAL
        };
        this.taskStates.set(taskId, state);
      }

      const state = this.taskStates.get(taskId)!;

      // Handle critical tasks
      if (state.priority === TaskPriority.CRITICAL) {
        // Preempt lower priority tasks if needed
        while (this.runningTasks.size >= this.maxConcurrentTasks) {
          const tasksToPreempt = Array.from(this.runningTasks)
            .map(id => this.taskStates.get(id)!)
            .filter(t => t.preemptible && t.priority < TaskPriority.CRITICAL)
            .sort((a, b) => a.priority - b.priority);

          if (tasksToPreempt.length === 0) break;
          this.preemptTask(tasksToPreempt[0].taskId);
        }

        // Add critical task to running
        this.addTaskToRunning(taskId);
        return context;
      }

      // Check if we can run this task
      if (!this.canRunTask(taskId)) {
        if (!this.taskQueue.includes(taskId)) {
          this.taskQueue.push(taskId);
        }
        return { ...context, skipExecution: true };
      }

      // Add task to running
      this.addTaskToRunning(taskId);
      return context;
    },

    'task:afterCompletion': async (context: ExtensionContext): Promise<ExtensionContext> => {
      const taskId = context.taskId as string;
      const state = this.taskStates.get(taskId);
      
      if (state) {
        state.preempted = false;
      }

      this.removeTaskFromRunning(taskId);

      // Try to run next tasks if we have capacity
      while (this.runningTasks.size < this.maxConcurrentTasks && this.taskQueue.length > 0) {
        const nextTask = this.getNextTask();
        if (!nextTask || !this.canRunTask(nextTask)) break;

        const nextState = this.taskStates.get(nextTask);
        if (!nextState) break;

        const taskIndex = this.taskQueue.indexOf(nextTask);
        if (taskIndex !== -1) {
          this.taskQueue.splice(taskIndex, 1);
          this.addTaskToRunning(nextTask);
        }
      }

      return context;
    }
  };

  getRunningTasks(): string[] {
    return Array.from(this.runningTasks);
  }

  getExecutionOrder(): string[] {
    return [...this.completedTasks];
  }

  setTaskPriority(taskId: string, priority: TaskPriority): void {
    const state = this.taskStates.get(taskId) ?? {
      taskId,
      priority,
      preemptible: true
    };
    state.priority = priority;
    this.taskStates.set(taskId, state);
  }

  getTaskPriority(taskId: string): TaskPriority {
    return this.taskStates.get(taskId)?.priority ?? TaskPriority.NORMAL;
  }

  setSchedulingPolicy(policy: SchedulingPolicy): void {
    this.schedulingPolicy = policy;
  }

  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = max;
  }

  enablePreemption(enabled: boolean): void {
    this.preemptionEnabled = enabled;
  }

  setTaskExecutionTime(taskId: string, time: number): void {
    const state = this.taskStates.get(taskId) ?? {
      taskId,
      priority: TaskPriority.NORMAL,
      preemptible: true
    };
    state.executionTime = time;
    this.taskStates.set(taskId, state);
  }

  setTaskDeadline(taskId: string, deadline: number): void {
    const state = this.taskStates.get(taskId) ?? {
      taskId,
      priority: TaskPriority.NORMAL,
      preemptible: true
    };
    state.deadline = deadline;
    this.taskStates.set(taskId, state);
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
    this.resourceAllocations.set(resourceId, 0);
  }

  setTaskResourceRequirements(taskId: string, requirements: Record<string, number>): void {
    const state = this.taskStates.get(taskId) ?? {
      taskId,
      priority: TaskPriority.NORMAL,
      preemptible: true
    };
    state.resourceAffinity = Object.keys(requirements);
    this.taskStates.set(taskId, state);
  }

  public assignTaskToGroup(taskId: string, groupId: string): void {
    const state = this.taskStates.get(taskId);
    if (!state) return;

    state.groupId = groupId;
    this.debug('assignTaskToGroup', `Assigned task ${taskId} to group ${groupId}`);
  }

  public getResourceAllocations(resourceId: string): number {
    return this.resourceAllocations.get(resourceId) ?? 0;
  }
} 