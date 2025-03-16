/**
 * Mock implementations of the extension interfaces
 * 
 * These mocks provide simple implementations of the extension interfaces
 * for testing and demonstration purposes. They are not intended for production use.
 */

import { v4 as uuidv4 } from 'uuid';
import { ProcessInstance, Event } from '../types';
import {
  SagaCoordinator, SagaDefinition, SagaInstance, SagaStatus, SagaStepStatus, SagaEventType, SagaEvent,
  Scheduler, ScheduledTaskConfig, RecurringTaskConfig, ScheduledTask, ScheduledTaskStatus, ScheduledTaskFilter,
  Supervisor, ProcessSupervisionConfig, TaskSupervisionConfig, SupervisionStatus, SupervisionStatusType, SupervisionEventType, SupervisionEvent,
  LoadManager, ResourceConfig, ResourceStatus, CircuitStatus, LoadEventType, LoadEvent, ResourceType
} from './types';

/**
 * Mock Saga Coordinator
 */
export class MockSagaCoordinator implements SagaCoordinator {
  private sagas: Map<string, SagaDefinition> = new Map();
  private instances: Map<string, SagaInstance> = new Map();
  private eventHandlers: Map<SagaEventType, Array<(event: SagaEvent) => void>> = new Map();

  defineSaga(config: SagaDefinition): SagaDefinition {
    this.sagas.set(config.id, config);
    return config;
  }

  async startSaga(sagaId: string, input: any): Promise<SagaInstance> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const instance: SagaInstance = {
      id: uuidv4(),
      sagaId,
      status: SagaStatus.CREATED,
      steps: saga.steps.map(step => ({
        id: uuidv4(),
        stepId: step.id,
        status: SagaStepStatus.PENDING
      })),
      startedAt: new Date(),
      context: input
    };

    this.instances.set(instance.id, instance);
    this.emitEvent(SagaEventType.SAGA_STARTED, {
      sagaId,
      instanceId: instance.id
    });

    // Simulate saga execution
    setTimeout(() => {
      instance.status = SagaStatus.RUNNING;
      
      // Simulate step execution
      let stepIndex = 0;
      const executeNextStep = () => {
        if (stepIndex >= instance.steps.length) {
          instance.status = SagaStatus.COMPLETED;
          instance.completedAt = new Date();
          this.emitEvent(SagaEventType.SAGA_COMPLETED, {
            sagaId,
            instanceId: instance.id
          });
          return;
        }

        const step = instance.steps[stepIndex];
        step.status = SagaStepStatus.RUNNING;
        step.startedAt = new Date();
        
        this.emitEvent(SagaEventType.STEP_STARTED, {
          sagaId,
          instanceId: instance.id,
          stepId: step.id
        });

        // Simulate step completion
        setTimeout(() => {
          step.status = SagaStepStatus.COMPLETED;
          step.completedAt = new Date();
          step.result = { success: true };
          
          this.emitEvent(SagaEventType.STEP_COMPLETED, {
            sagaId,
            instanceId: instance.id,
            stepId: step.id
          });
          
          stepIndex++;
          executeNextStep();
        }, 100);
      };

      executeNextStep();
    }, 100);

    return instance;
  }

  async getSagaStatus(instanceId: string): Promise<SagaInstance | undefined> {
    return this.instances.get(instanceId);
  }

  async completeSaga(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Saga instance not found: ${instanceId}`);
    }
    
    // Complete all pending steps
    for (const step of instance.steps) {
      if (step.status === SagaStepStatus.PENDING || step.status === SagaStepStatus.RUNNING) {
        step.status = SagaStepStatus.COMPLETED;
        step.completedAt = new Date();
        step.result = { success: true };
      }
    }
    
    // Complete the saga
    instance.status = SagaStatus.COMPLETED;
    instance.completedAt = new Date();
    
    // Emit completion event
    this.emitEvent(SagaEventType.SAGA_COMPLETED, {
      sagaId: instance.sagaId,
      instanceId: instance.id
    });
  }

  async compensateSaga(instanceId: string, reason?: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Saga instance not found: ${instanceId}`);
    }

    instance.status = SagaStatus.COMPENSATING;
    
    // Simulate compensation
    setTimeout(() => {
      instance.status = SagaStatus.COMPENSATED;
      this.emitEvent(SagaEventType.COMPENSATION_COMPLETED, {
        sagaId: instance.sagaId,
        instanceId: instance.id
      });
    }, 200);
  }

  onSagaEvent(eventType: SagaEventType, handler: (event: SagaEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  private emitEvent(type: SagaEventType, data: any): void {
    const event: SagaEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      sagaId: data.sagaId,
      instanceId: data.instanceId,
      stepId: data.stepId,
      payload: data
    };

    // Call handlers for this event type
    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in saga event handler for ${type}:`, error);
      }
    });

    // Call handlers for all events
    const allHandlers = this.eventHandlers.get('*' as SagaEventType) || [];
    allHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in saga event handler for *:`, error);
      }
    });
  }
}

/**
 * Mock Scheduler
 */
export class MockScheduler implements Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async scheduleTask(config: ScheduledTaskConfig): Promise<string> {
    const id = uuidv4();
    const task: ScheduledTask = {
      id,
      taskId: config.taskId,
      status: ScheduledTaskStatus.SCHEDULED,
      executeAt: new Date(config.executeAt),
      input: config.input,
      description: config.description,
      metadata: config.metadata
    };

    this.tasks.set(id, task);

    // Schedule execution
    const now = Date.now();
    const executeAt = task.executeAt.getTime();
    const delay = Math.max(0, executeAt - now);

    const timer = setTimeout(() => {
      this.executeTask(id);
    }, delay);

    this.timers.set(id, timer);

    return id;
  }

  async scheduleRecurringTask(config: RecurringTaskConfig): Promise<string> {
    const id = uuidv4();
    const task: ScheduledTask = {
      id,
      taskId: config.taskId,
      status: ScheduledTaskStatus.SCHEDULED,
      executeAt: new Date(config.executeAt),
      pattern: config.pattern,
      remainingExecutions: config.maxExecutions,
      input: config.input,
      description: config.description,
      metadata: config.metadata
    };

    this.tasks.set(id, task);

    // Schedule first execution
    const now = Date.now();
    const executeAt = task.executeAt.getTime();
    const delay = Math.max(0, executeAt - now);

    const timer = setTimeout(() => {
      this.executeRecurringTask(id);
    }, delay);

    this.timers.set(id, timer);

    return id;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Clear timer
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }

    // Update task status
    task.status = ScheduledTaskStatus.CANCELLED;

    return true;
  }

  async pauseTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Clear timer
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }

    // Update task status
    task.status = ScheduledTaskStatus.PAUSED;

    return true;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== ScheduledTaskStatus.PAUSED) {
      return false;
    }

    // Update task status
    task.status = ScheduledTaskStatus.SCHEDULED;

    // Reschedule execution
    const now = Date.now();
    const executeAt = task.executeAt.getTime();
    const delay = Math.max(0, executeAt - now);

    const timer = setTimeout(() => {
      if (task.pattern) {
        this.executeRecurringTask(taskId);
      } else {
        this.executeTask(taskId);
      }
    }, delay);

    this.timers.set(taskId, timer);

    return true;
  }

  async getTasks(filter?: ScheduledTaskFilter): Promise<ScheduledTask[]> {
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        tasks = tasks.filter(task => statuses.includes(task.status));
      }

      if (filter.taskId) {
        const taskIds = Array.isArray(filter.taskId) ? filter.taskId : [filter.taskId];
        tasks = tasks.filter(task => taskIds.includes(task.taskId));
      }

      if (filter.from) {
        const from = typeof filter.from === 'number' ? filter.from : filter.from.getTime();
        tasks = tasks.filter(task => task.executeAt.getTime() >= from);
      }

      if (filter.to) {
        const to = typeof filter.to === 'number' ? filter.to : filter.to.getTime();
        tasks = tasks.filter(task => task.executeAt.getTime() <= to);
      }

      if (filter.recurring !== undefined) {
        tasks = tasks.filter(task => !!task.pattern === filter.recurring);
      }
    }

    return tasks;
  }

  async getTask(taskId: string): Promise<ScheduledTask | undefined> {
    return this.tasks.get(taskId);
  }

  private executeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== ScheduledTaskStatus.SCHEDULED) {
      return;
    }

    // Update task status
    task.status = ScheduledTaskStatus.RUNNING;
    
    // Simulate task execution
    setTimeout(() => {
      task.status = ScheduledTaskStatus.COMPLETED;
      task.executedAt = new Date();
      task.result = { success: true };
    }, 100);
  }

  private executeRecurringTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== ScheduledTaskStatus.SCHEDULED) {
      return;
    }

    // Update task status
    task.status = ScheduledTaskStatus.RUNNING;
    
    // Simulate task execution
    setTimeout(() => {
      task.status = ScheduledTaskStatus.SCHEDULED;
      task.executedAt = new Date();
      task.result = { success: true };

      // Decrement remaining executions if set
      if (task.remainingExecutions !== undefined) {
        task.remainingExecutions--;
        if (task.remainingExecutions <= 0) {
          task.status = ScheduledTaskStatus.COMPLETED;
          return;
        }
      }

      // Schedule next execution
      // In a real implementation, this would parse the cron pattern
      // For this mock, we'll just schedule it 5 seconds later
      const nextExecuteAt = new Date(Date.now() + 5000);
      task.executeAt = nextExecuteAt;
      task.nextExecutionAt = nextExecuteAt;

      const timer = setTimeout(() => {
        this.executeRecurringTask(taskId);
      }, 5000);

      this.timers.set(taskId, timer);
    }, 100);
  }
}

/**
 * Mock Supervisor
 */
export class MockSupervisor implements Supervisor {
  private processConfigs: Map<string, ProcessSupervisionConfig> = new Map();
  private taskConfigs: Map<string, TaskSupervisionConfig> = new Map();
  private processStatuses: Map<string, SupervisionStatus> = new Map();
  private taskStatuses: Map<string, SupervisionStatus> = new Map();
  private eventHandlers: Map<SupervisionEventType, Array<(event: SupervisionEvent) => void>> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  superviseProcess(config: ProcessSupervisionConfig): void {
    this.processConfigs.set(config.processId, config);
  }

  superviseTask(config: TaskSupervisionConfig): void {
    this.taskConfigs.set(config.taskId, config);
  }

  async getProcessSupervisionStatus(instanceId: string): Promise<SupervisionStatus | undefined> {
    return this.processStatuses.get(instanceId);
  }

  async getTaskSupervisionStatus(executionId: string): Promise<SupervisionStatus | undefined> {
    return this.taskStatuses.get(executionId);
  }

  async recoverProcess(instanceId: string): Promise<ProcessInstance> {
    const status = this.processStatuses.get(instanceId);
    if (!status) {
      throw new Error(`Process supervision status not found: ${instanceId}`);
    }

    status.status = SupervisionStatusType.RECOVERING;
    status.recoveryAttempts++;
    status.lastRecoveryAt = new Date();

    this.emitEvent(SupervisionEventType.RECOVERY_STARTED, {
      targetId: instanceId,
      targetType: 'process',
      status: status.status,
      recoveryAttempts: status.recoveryAttempts,
      maxRecoveryAttempts: status.maxRecoveryAttempts
    });

    // Simulate recovery
    return {
      id: instanceId,
      processId: 'mock-process',
      state: 'recovered',
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      history: []
    };
  }

  async recoverTask(executionId: string): Promise<any> {
    const status = this.taskStatuses.get(executionId);
    if (!status) {
      throw new Error(`Task supervision status not found: ${executionId}`);
    }

    status.status = SupervisionStatusType.RECOVERING;
    status.recoveryAttempts++;
    status.lastRecoveryAt = new Date();

    this.emitEvent(SupervisionEventType.RECOVERY_STARTED, {
      targetId: executionId,
      targetType: 'task',
      status: status.status,
      recoveryAttempts: status.recoveryAttempts,
      maxRecoveryAttempts: status.maxRecoveryAttempts
    });

    // Simulate recovery
    return { success: true };
  }

  onSupervisionEvent(eventType: SupervisionEventType, handler: (event: SupervisionEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  // Method to simulate a process becoming unhealthy
  simulateUnhealthyProcess(instanceId: string, processId: string): void {
    // Create a supervision status if it doesn't exist
    if (!this.processStatuses.has(instanceId)) {
      this.processStatuses.set(instanceId, {
        id: uuidv4(),
        targetId: instanceId,
        targetType: 'process',
        status: SupervisionStatusType.HEALTHY,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 3,
        lastCheckAt: new Date()
      });
    }
    
    const status = this.processStatuses.get(instanceId)!;
    status.status = SupervisionStatusType.UNHEALTHY;
    status.lastCheckAt = new Date();
    
    // Emit unhealthy event
    this.emitEvent(SupervisionEventType.UNHEALTHY_DETECTED, {
      targetId: instanceId,
      targetType: 'process',
      status: SupervisionStatusType.UNHEALTHY,
      recoveryAttempts: status.recoveryAttempts,
      maxRecoveryAttempts: status.maxRecoveryAttempts
    });
    
    // Immediately start recovery
    status.status = SupervisionStatusType.RECOVERING;
    status.recoveryAttempts++;
    
    // Emit recovery started event
    this.emitEvent(SupervisionEventType.RECOVERY_STARTED, {
      targetId: instanceId,
      targetType: 'process',
      status: SupervisionStatusType.RECOVERING,
      recoveryAttempts: status.recoveryAttempts,
      maxRecoveryAttempts: status.maxRecoveryAttempts
    });
  }

  private emitEvent(type: SupervisionEventType, data: any): void {
    const event: SupervisionEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      targetId: data.targetId,
      targetType: data.targetType,
      status: data.status,
      recoveryAttempts: data.recoveryAttempts,
      maxRecoveryAttempts: data.maxRecoveryAttempts,
      payload: data
    };

    // Call handlers for this event type
    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in supervision event handler for ${type}:`, error);
      }
    });
  }
}

/**
 * Mock Load Manager
 */
export class MockLoadManager implements LoadManager {
  private resources: Map<string, ResourceConfig> = new Map();
  private resourceStatuses: Map<string, ResourceStatus> = new Map();
  private eventHandlers: Map<LoadEventType, Array<(event: LoadEvent) => void>> = new Map();

  registerResource(config: ResourceConfig): void {
    this.resources.set(config.id, config);
    
    const status: ResourceStatus = {
      id: config.id,
      type: config.type,
      capacity: config.capacity,
      used: 0,
      available: config.capacity,
      usagePercentage: 0,
      status: CircuitStatus.CLOSED,
      lastStatusChangeAt: new Date()
    };

    this.resourceStatuses.set(config.id, status);
  }

  async isResourceAvailable(resourceId: string): Promise<boolean> {
    const status = this.resourceStatuses.get(resourceId);
    if (!status) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    return status.status !== CircuitStatus.OPEN && status.available > 0;
  }

  async acquireResource(resourceId: string, units: number = 1): Promise<boolean> {
    const status = this.resourceStatuses.get(resourceId);
    if (!status) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    const config = this.resources.get(resourceId)!;

    if (status.status === CircuitStatus.OPEN) {
      return false;
    }

    if (status.available < units) {
      return false;
    }

    // Update resource status
    status.used += units;
    status.available -= units;
    status.usagePercentage = (status.used / status.capacity) * 100;

    // Check thresholds
    this.checkThresholds(resourceId, status, config);

    return true;
  }

  async releaseResource(resourceId: string, units: number = 1): Promise<void> {
    const status = this.resourceStatuses.get(resourceId);
    if (!status) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    const config = this.resources.get(resourceId)!;

    // Update resource status
    status.used = Math.max(0, status.used - units);
    status.available = status.capacity - status.used;
    status.usagePercentage = (status.used / status.capacity) * 100;

    // Check thresholds
    this.checkThresholds(resourceId, status, config);
  }

  async getResourceStatus(resourceId: string): Promise<ResourceStatus | undefined> {
    return this.resourceStatuses.get(resourceId);
  }

  async getAllResourceStatuses(): Promise<Record<string, ResourceStatus>> {
    const result: Record<string, ResourceStatus> = {};
    this.resourceStatuses.forEach((status, id) => {
      result[id] = status;
    });
    return result;
  }

  onLoadEvent(eventType: LoadEventType, handler: (event: LoadEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  private checkThresholds(resourceId: string, status: ResourceStatus, config: ResourceConfig): void {
    const previousStatus = status.status;
    
    // Check circuit threshold
    if (config.thresholds.circuit && status.usagePercentage >= config.thresholds.circuit) {
      status.status = CircuitStatus.OPEN;
      status.lastStatusChangeAt = new Date();
      
      if (config.resetTimeout) {
        status.resetAt = new Date(Date.now() + config.resetTimeout);
        
        // Schedule circuit reset
        setTimeout(() => {
          this.resetCircuit(resourceId);
        }, config.resetTimeout);
      }
      
      if (previousStatus !== CircuitStatus.OPEN) {
        this.emitEvent(LoadEventType.CIRCUIT_OPEN, {
          resourceId,
          resourceType: status.type,
          capacity: status.capacity,
          used: status.used,
          available: status.available,
          usagePercentage: status.usagePercentage,
          status: status.status
        });
      }
      
      return;
    }
    
    // Check critical threshold
    if (config.thresholds.critical && status.usagePercentage >= config.thresholds.critical) {
      status.status = CircuitStatus.CRITICAL;
      status.lastStatusChangeAt = new Date();
      
      if (previousStatus !== CircuitStatus.CRITICAL) {
        this.emitEvent(LoadEventType.THRESHOLD_CRITICAL, {
          resourceId,
          resourceType: status.type,
          capacity: status.capacity,
          used: status.used,
          available: status.available,
          usagePercentage: status.usagePercentage,
          status: status.status
        });
      }
      
      return;
    }
    
    // Check warning threshold
    if (config.thresholds.warning && status.usagePercentage >= config.thresholds.warning) {
      status.status = CircuitStatus.WARNING;
      status.lastStatusChangeAt = new Date();
      
      if (previousStatus !== CircuitStatus.WARNING) {
        this.emitEvent(LoadEventType.THRESHOLD_WARNING, {
          resourceId,
          resourceType: status.type,
          capacity: status.capacity,
          used: status.used,
          available: status.available,
          usagePercentage: status.usagePercentage,
          status: status.status
        });
      }
      
      return;
    }
    
    // Normal operation
    if (previousStatus !== CircuitStatus.CLOSED) {
      status.status = CircuitStatus.CLOSED;
      status.lastStatusChangeAt = new Date();
      
      this.emitEvent(LoadEventType.CIRCUIT_CLOSED, {
        resourceId,
        resourceType: status.type,
        capacity: status.capacity,
        used: status.used,
        available: status.available,
        usagePercentage: status.usagePercentage,
        status: status.status
      });
    }
  }

  private resetCircuit(resourceId: string): void {
    const status = this.resourceStatuses.get(resourceId);
    if (!status || status.status !== CircuitStatus.OPEN) {
      return;
    }

    // Set to half-open state
    status.status = CircuitStatus.HALF_OPEN;
    status.lastStatusChangeAt = new Date();
    status.resetAt = undefined;

    this.emitEvent(LoadEventType.CIRCUIT_HALF_OPEN, {
      resourceId,
      resourceType: status.type,
      capacity: status.capacity,
      used: status.used,
      available: status.available,
      usagePercentage: status.usagePercentage,
      status: status.status
    });
  }

  private emitEvent(type: LoadEventType, data: any): void {
    const event: LoadEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      capacity: data.capacity,
      used: data.used,
      available: data.available,
      usagePercentage: data.usagePercentage,
      status: data.status,
      payload: data
    };

    // Call handlers for this event type
    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in load event handler for ${type}:`, error);
      }
    });
  }
} 