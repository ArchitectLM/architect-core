import { Extension } from '../models/extension.js';

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum SchedulingPolicy {
  FIFO = 'fifo',
  SJF = 'shortest-job-first',
  DEADLINE = 'deadline'
}

export interface TaskMetadata {
  priority: TaskPriority;
  executionTime?: number;
  deadline?: number;
  groupId?: string;
  resourceAffinity?: string[];
  preemptible?: boolean;
}

export interface TaskPrioritizationOptions {
  maxConcurrentTasks?: number;
  defaultPriority?: TaskPriority;
  schedulingPolicy?: SchedulingPolicy;
  priorityBoostInterval?: number;
  priorityBoostAmount?: number;
  preemptionEnabled?: boolean;
}

export interface TaskExecutionState {
  taskId: string;
  priority: TaskPriority;
  startTime?: number;
  executionTime?: number;
  deadline?: number;
  groupId?: string;
  resourceAffinity?: string[];
  preemptible: boolean;
  waitingSince?: number;
  boostedPriority?: number;
}

export class TaskPrioritizationPlugin implements Extension {
  name = 'task-prioritization-plugin';
  description = 'Manages task execution order based on priority and scheduling policies';

  private options: Required<TaskPrioritizationOptions>;
  private taskStates: Map<string, TaskExecutionState> = new Map();
  private activeTasks: Set<string> = new Set();
  private taskQueue: string[] = [];
  private priorityBoostTimer?: NodeJS.Timeout;

  constructor(options: TaskPrioritizationOptions = {}) {
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks ?? 5,
      defaultPriority: options.defaultPriority ?? TaskPriority.NORMAL,
      schedulingPolicy: options.schedulingPolicy ?? SchedulingPolicy.FIFO,
      priorityBoostInterval: options.priorityBoostInterval ?? 30000, // 30 seconds
      priorityBoostAmount: options.priorityBoostAmount ?? 1,
      preemptionEnabled: options.preemptionEnabled ?? true
    };
  }

  hooks = {
    'task:beforeExecution': async (context: any) => {
      const { taskId, task, metadata } = context;
      const taskState = this.initializeTaskState(taskId, task, metadata);
      
      if (this.activeTasks.size >= this.options.maxConcurrentTasks) {
        this.taskQueue.push(taskId);
        return { shouldWait: true };
      }

      return this.executeTask(taskId, taskState);
    },

    'task:afterExecution': async (context: any) => {
      const { taskId } = context;
      this.completeTask(taskId);
      this.processNextTask();
    },

    'task:error': async (context: any) => {
      const { taskId } = context;
      this.completeTask(taskId);
      this.processNextTask();
    }
  };

  private initializeTaskState(
    taskId: string,
    task: any,
    metadata: TaskMetadata
  ): TaskExecutionState {
    const state: TaskExecutionState = {
      taskId,
      priority: metadata.priority ?? this.options.defaultPriority,
      executionTime: metadata.executionTime,
      deadline: metadata.deadline,
      groupId: metadata.groupId,
      resourceAffinity: metadata.resourceAffinity,
      preemptible: metadata.preemptible ?? true,
      waitingSince: Date.now()
    };

    this.taskStates.set(taskId, state);
    return state;
  }

  private async executeTask(
    taskId: string,
    state: TaskExecutionState
  ): Promise<{ shouldWait: boolean }> {
    if (this.shouldPreemptTask(taskId, state)) {
      return { shouldWait: true };
    }

    this.activeTasks.add(taskId);
    state.startTime = Date.now();
    return { shouldWait: false };
  }

  private shouldPreemptTask(
    taskId: string,
    state: TaskExecutionState
  ): boolean {
    if (!this.options.preemptionEnabled || !state.preemptible) {
      return false;
    }

    const currentPriority = this.getEffectivePriority(state);
    const activeTasks = Array.from(this.activeTasks);

    for (const activeTaskId of activeTasks) {
      const activeState = this.taskStates.get(activeTaskId);
      if (!activeState) continue;

      const activePriority = this.getEffectivePriority(activeState);
      if (currentPriority > activePriority) {
        return true;
      }
    }

    return false;
  }

  private getEffectivePriority(state: TaskExecutionState): number {
    let priority = state.priority;

    // Apply priority boost based on waiting time
    if (state.waitingSince) {
      const waitTime = Date.now() - state.waitingSince;
      const boosts = Math.floor(waitTime / this.options.priorityBoostInterval);
      priority += boosts * this.options.priorityBoostAmount;
    }

    // Apply deadline-based boost
    if (state.deadline) {
      const timeToDeadline = state.deadline - Date.now();
      if (timeToDeadline < 0) {
        priority += 2; // Significant boost for overdue tasks
      } else if (timeToDeadline < 60000) { // Within 1 minute of deadline
        priority += 1;
      }
    }

    return priority;
  }

  private completeTask(taskId: string): void {
    this.activeTasks.delete(taskId);
    this.taskStates.delete(taskId);
    this.taskQueue = this.taskQueue.filter(id => id !== taskId);
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    const nextTaskId = this.selectNextTask();
    if (!nextTaskId) return;

    const state = this.taskStates.get(nextTaskId);
    if (!state) return;

    this.executeTask(nextTaskId, state);
  }

  private selectNextTask(): string | undefined {
    if (this.taskQueue.length === 0) return undefined;

    switch (this.options.schedulingPolicy) {
      case SchedulingPolicy.SJF:
        return this.selectShortestJob();
      case SchedulingPolicy.DEADLINE:
        return this.selectEarliestDeadline();
      case SchedulingPolicy.FIFO:
      default:
        return this.taskQueue[0];
    }
  }

  private selectShortestJob(): string | undefined {
    return this.taskQueue.reduce((shortest, taskId) => {
      const current = this.taskStates.get(taskId);
      const shortestState = shortest ? this.taskStates.get(shortest) : undefined;

      if (!current?.executionTime) return shortest;
      if (!shortestState?.executionTime) return taskId;

      return current.executionTime < shortestState.executionTime ? taskId : shortest;
    }, undefined as string | undefined);
  }

  private selectEarliestDeadline(): string | undefined {
    return this.taskQueue.reduce((earliest, taskId) => {
      const current = this.taskStates.get(taskId);
      const earliestState = earliest ? this.taskStates.get(earliest) : undefined;

      if (!current?.deadline) return earliest;
      if (!earliestState?.deadline) return taskId;

      return current.deadline < earliestState.deadline ? taskId : earliest;
    }, undefined as string | undefined);
  }

  setTaskPriority(taskId: string, priority: TaskPriority): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.priority = priority;
    }
  }

  setTaskDeadline(taskId: string, deadline: number): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.deadline = deadline;
    }
  }

  setTaskGroup(taskId: string, groupId: string): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.groupId = groupId;
    }
  }

  setResourceAffinity(taskId: string, resources: string[]): void {
    const state = this.taskStates.get(taskId);
    if (state) {
      state.resourceAffinity = resources;
    }
  }

  getTaskState(taskId: string): TaskExecutionState | undefined {
    return this.taskStates.get(taskId);
  }

  getActiveTasks(): string[] {
    return Array.from(this.activeTasks);
  }

  getQueuedTasks(): string[] {
    return [...this.taskQueue];
  }

  clearQueue(): void {
    this.taskQueue = [];
  }

  setMaxConcurrentTasks(max: number): void {
    this.options.maxConcurrentTasks = max;
    this.processNextTask();
  }

  setSchedulingPolicy(policy: SchedulingPolicy): void {
    this.options.schedulingPolicy = policy;
    this.processNextTask();
  }
} 